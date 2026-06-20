import os
import socket
import asyncio
import subprocess
import time
from dotenv import load_dotenv

from chain_config import get_chain

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../..', '.env'))


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


class AnvilForkInstance:
    def __init__(self, network: str, block_number: int | None = None):
        chain = get_chain(network)  # raises ValueError for unknown networks
        self.network = network
        self.chain_id = chain.chain_id
        self.rpc_url = chain.rpc_url
        self.block_number = block_number
        self.port = None
        self.process = None

    async def start(self) -> str:
        """Spawns a sandboxed Anvil fork process on a random free port."""
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
        return rpc_endpoint

    async def stop(self):
        """Kills the local Anvil subprocess."""
        if self.process:
            print(f"Terminating Anvil fork running on port {self.port}...")
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
