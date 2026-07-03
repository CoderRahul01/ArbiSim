import os
import socket
import asyncio
import subprocess
import time
import threading
from dotenv import load_dotenv

from chain_config import get_chain

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../..', '.env'))


# ── RPC Pool: round-robin across multiple Avalanche endpoints ─────────────────
# Public api.avax.network throttles at ~50 req/sec. Under high simulation load
# (6 Anvil forks in sequence per stress test) this ceiling gets hit.
# Set AVALANCHE_MAINNET_RPC_2 / _3 (Ankr, Infura, dRPC) as backup endpoints.
_RPC_COUNTER_LOCK = threading.Lock()
_rpc_counters: dict[str, int] = {}

_RPC_POOLS: dict[str, list[str]] = {
    "avalanche-mainnet": [
        u for u in [
            os.getenv("AVALANCHE_MAINNET_RPC", "https://api.avax.network/ext/bc/C/rpc"),
            os.getenv("AVALANCHE_MAINNET_RPC_2", ""),
            os.getenv("AVALANCHE_MAINNET_RPC_3", ""),
        ] if u
    ],
    "avalanche-fuji": [
        u for u in [
            os.getenv("AVALANCHE_FUJI_RPC", "https://api.avax-test.network/ext/bc/C/rpc"),
            os.getenv("AVALANCHE_FUJI_RPC_2", ""),
        ] if u
    ],
}


def get_rpc_url(network: str, chain_rpc: str) -> str:
    """Returns the next RPC URL from the pool for Avalanche networks.
    Falls back to chain_rpc for all other networks."""
    pool = _RPC_POOLS.get(network)
    if not pool:
        return chain_rpc
    with _RPC_COUNTER_LOCK:
        idx = _rpc_counters.get(network, 0)
        _rpc_counters[network] = (idx + 1) % len(pool)
    return pool[idx % len(pool)]



def find_free_port(start: int = 8545, end: int = 8600) -> int:
    """Finds an unused local port within the specified range."""
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    raise IOError(f"No free ports available in range {start}-{end}")


_RUNNING_FORKS = {}


class AnvilForkInstance:
    def __init__(self, network: str, block_number: int | None = None):
        chain = get_chain(network)  # raises ValueError for unknown networks
        self.network = network
        self.chain_id = chain.chain_id
        # Use RPC pool for Avalanche; single endpoint for all other chains
        self.rpc_url = get_rpc_url(network, chain.rpc_url)
        self.block_number = block_number
        self.port = None
        self.process = None
        self.is_shared = False

    async def start(self) -> str:
        """Spawns a sandboxed Anvil fork process on a random free port, or reuses a running one if block_number is None."""
        global _RUNNING_FORKS

        # Only share/cache if block_number is None (latest fork)
        if self.block_number is None and self.network in _RUNNING_FORKS:
            entry = _RUNNING_FORKS[self.network]
            # Check if process is still alive
            if entry["process"] and entry["process"].returncode is None:
                self.port = entry["port"]
                self.process = entry["process"]
                self.is_shared = True
                print(f"Reusing persistent Anvil fork for {self.network} on port {self.port}")
                return entry["rpc_endpoint"]
            else:
                # Process died, remove it
                _RUNNING_FORKS.pop(self.network, None)

        self.port = find_free_port()

        if "YOUR_ALCHEMY_KEY" in self.rpc_url or "YOUR_KEY" in self.rpc_url:
            print(f"WARNING: RPC URL for {self.network} contains template placeholder: {self.rpc_url}")

        cmd = [
            "anvil",
            "--fork-url", self.rpc_url,
            "--port", str(self.port),
            "--chain-id", str(self.chain_id),
            "--silent",
        ]

        if self.block_number is not None:
            cmd.extend(["--fork-block-number", str(self.block_number)])

        block_msg = f" at block {self.block_number}" if self.block_number is not None else ""
        print(f"Starting Anvil fork for {self.network}{block_msg} (Chain ID: {self.chain_id}) on port {self.port}...")
        print(f"Command: {' '.join(cmd)}")

        try:
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except Exception as e:
            raise RuntimeError(f"Could not launch Anvil: {e}")

        retries = 30
        connected = False
        while retries > 0:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.connect(('127.0.0.1', self.port))
                    connected = True
                    break
                except OSError:
                    await asyncio.sleep(0.2)
                    retries -= 1

        if not connected:
            stdout, stderr = await self.process.communicate()
            err_msg = stderr.decode() if stderr else "No error output"
            raise RuntimeError(
                f"Anvil failed to start on port {self.port} within timeout. Output: {err_msg}"
            )

        rpc_endpoint = f"http://127.0.0.1:{self.port}"
        print(f"Anvil fork running at {rpc_endpoint}")

        if self.block_number is None:
            _RUNNING_FORKS[self.network] = {
                "port": self.port,
                "process": self.process,
                "rpc_endpoint": rpc_endpoint
            }
            self.is_shared = True

        return rpc_endpoint

    async def take_snapshot(self) -> str | None:
        """Takes a snapshot of the EVM state and returns the snapshot ID."""
        if not self.port:
            return None
        url = f"http://127.0.0.1:{self.port}"
        payload = {
            "jsonrpc": "2.0",
            "method": "evm_snapshot",
            "params": [],
            "id": 1
        }
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=5) as resp:
                    res = await resp.json()
                    snapshot_id = res.get("result")
                    print(f"[{self.network}] Created EVM snapshot: {snapshot_id}")
                    return snapshot_id
        except Exception as e:
            print(f"[{self.network}] Failed to create snapshot: {e}")
            return None

    async def revert_snapshot(self, snapshot_id: str) -> bool:
        """Reverts the EVM state to a previously saved snapshot ID."""
        if not self.port or snapshot_id is None:
            return False
        url = f"http://127.0.0.1:{self.port}"
        payload = {
            "jsonrpc": "2.0",
            "method": "evm_revert",
            "params": [snapshot_id],
            "id": 1
        }
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=5) as resp:
                    res = await resp.json()
                    success = res.get("result", False)
                    print(f"[{self.network}] Reverted EVM snapshot {snapshot_id}: {success}")
                    return success
        except Exception as e:
            print(f"[{self.network}] Failed to revert snapshot {snapshot_id}: {e}")
            return False

    async def stop(self, force: bool = False):
        """Kills the local Anvil subprocess if not shared, or if forced."""
        global _RUNNING_FORKS
        if self.process:
            if self.is_shared and not force:
                print(f"Leaving persistent Anvil fork running for {self.network} on port {self.port}.")
                return

            print(f"Terminating Anvil fork running on port {self.port}...")
            # Remove from running forks cache if present
            if self.block_number is None and self.network in _RUNNING_FORKS:
                _RUNNING_FORKS.pop(self.network, None)

            try:
                self.process.terminate()
                await self.process.wait()
            except Exception as e:
                print(f"Error terminating Anvil process: {e}")
                try:
                    self.process.kill()
                except Exception as ex:
                    print(f"Force-kill also failed: {ex}")
            finally:
                self.process = None
                self.port = None
