import os
import brotli
from web3 import Web3
from web3.exceptions import ContractLogicError
import json

# Common Contract Addresses on Arbitrum One
GAS_PRICE_ORACLE = "0x00000000000000000000000000000000000000c8"
CHAINLINK_ETH_USD = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"
CHAINLINK_BTC_USD = "0x6ce18521331128284c21533Cd7d9Cc01086e8F35"

ENTRYPOINT_V06_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
ENTRYPOINT_V07_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

# ERC-20 Minimal ABIs
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    }
]

# Chainlink Aggregator Minimal ABI
CHAINLINK_ABI = [
    {
        "inputs": [],
        "name": "latestAnswer",
        "outputs": [{"name": "", "type": "int256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Gas Price Oracle Minimal ABI
GAS_ORACLE_ABI = [
    {
        "inputs": [],
        "name": "l1BaseFee",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

def evaluate_timeboost_and_mev_risk(calldata_bytes: bytes, target_contract: str, gas_used: int) -> dict:
    """
    Simulates transaction vulnerability under Arbitrum Timeboost constraints
    and estimates potential exposure to non-atomic MEV sandwich attacks.
    """
    # High-volume protocol entry points commonly targeted by searchers (e.g., Camelot, GMX, Uniswap)
    mev_prone_targets = [
        "0xc873fecbd354f5afca31422734b5267d343f117a", # Mock Camelot Router
        "0x3b123f1c1665ea07fab53363537950da84e1ba7d"  # Mock GMX Vault
    ]
    
    is_high_risk_target = target_contract.lower() in mev_prone_targets
    calldata_size = len(calldata_bytes)
    
    # Calculate a heuristic risk score based on calldata complexity and execution depth
    risk_score = 0.0
    if is_high_risk_target:
        risk_score += 0.5
    if gas_used > 150000:
        risk_score += 0.3
    if calldata_size > 512:
        risk_score += 0.2
        
    # Determine if the transaction bundle requires a 200ms Timeboost priority-lane injection
    requires_timeboost = risk_score >= 0.6
    estimated_priority_premium_wei = int(gas_used * 0.12) if requires_timeboost else 0

    return {
        "mev_sandwich_risk_score": round(risk_score, 2),
        "vulnerability_status": "HIGH" if risk_score >= 0.7 else "MEDIUM" if risk_score >= 0.4 else "LOW",
        "timeboost_fastlane_recommended": requires_timeboost,
        "estimated_timeboost_premium_wei": str(estimated_priority_premium_wei),
        "latency_advantage_ms": 200 if requires_timeboost else 0
    }

ENTRYPOINT_V06_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"name": "sender", "type": "address"},
                    {"name": "nonce", "type": "uint256"},
                    {"name": "initCode", "type": "bytes"},
                    {"name": "callData", "type": "bytes"},
                    {"name": "callGasLimit", "type": "uint256"},
                    {"name": "verificationGasLimit", "type": "uint256"},
                    {"name": "preVerificationGas", "type": "uint256"},
                    {"name": "maxFeePerGas", "type": "uint256"},
                    {"name": "maxPriorityFeePerGas", "type": "uint256"},
                    {"name": "paymasterAndData", "type": "bytes"},
                    {"name": "signature", "type": "bytes"}
                ],
                "name": "ops",
                "type": "tuple[]"
            },
            {"name": "beneficiary", "type": "address"}
        ],
        "name": "handleOps",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

ENTRYPOINT_V07_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"name": "sender", "type": "address"},
                    {"name": "nonce", "type": "uint256"},
                    {"name": "initCode", "type": "bytes"},
                    {"name": "callData", "type": "bytes"},
                    {"name": "accountGasLimits", "type": "bytes32"},
                    {"name": "preVerificationGas", "type": "uint32"},
                    {"name": "gasFees", "type": "bytes32"},
                    {"name": "paymasterAndData", "type": "bytes"},
                    {"name": "signature", "type": "bytes"}
                ],
                "name": "ops",
                "type": "tuple[]"
            },
            {"name": "beneficiary", "type": "address"}
        ],
        "name": "handleOps",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

def analyze_execution_trace(session_id: str, trace_data: dict, rpc_url: str) -> dict:
    """
    Main entry function for analyzing EVM transaction trace logs for Stylus WASM Ink,
    Host-to-VM transition points, and Nitro calldata compression buffer costs.
    """
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise RuntimeError(f"Cannot connect to Anvil fork at {rpc_url}")
        
    transactions = trace_data.get("transactions", [])
    agent_address = trace_data.get("agent_address")
    agent_checksum = Web3.to_checksum_address(agent_address) if agent_address else None
    
    # Track touched addresses in execution to query their bytecode
    touched_addresses = set()
    if agent_checksum:
        touched_addresses.add(agent_checksum)
        
    for tx in transactions:
        if tx.get("to"):
            touched_addresses.add(Web3.to_checksum_address(tx["to"]))

    # Scan structLogs from debug_traceTransaction if available
    struct_logs = trace_data.get("structLogs", [])
    for log in struct_logs:
        op = log.get("op", "")
        # Extract target addresses from calls
        if op in ["CALL", "DELEGATECALL", "STATICCALL", "CALLCODE"] and "stack" in log:
            stack = log["stack"]
            if len(stack) >= 2:
                try:
                    target_hex = stack[-2]
                    target_addr = Web3.to_checksum_address("0x" + target_hex[-40:])
                    touched_addresses.add(target_addr)
                except Exception:
                    pass

    # 1. Stylus WASM Verification Logic
    stylus_contracts = set()
    for addr in touched_addresses:
        try:
            code = w3.eth.get_code(addr)
            if code.startswith(b'\xef\xf0\x00'):
                stylus_contracts.add(addr)
                print(f"Detected Stylus WASM contract: {addr}")
        except Exception:
            pass

    # Trace through call frames to calculate Stylus runtime ink and Host I/O penalties
    total_ink = 0
    host_io_penalty_gas = 0.0
    
    call_stack = []
    if transactions:
        first_to = Web3.to_checksum_address(transactions[0]["to"]) if transactions[0].get("to") else None
        if first_to:
            call_stack.append(first_to)
            
    current_addr = call_stack[-1] if call_stack else None

    # Track gas differences between opcodes to count gas used inside WASM runtime
    for idx, log in enumerate(struct_logs):
        op = log.get("op", "")
        
        # Track call depth / contract execution frame
        if op in ["CALL", "DELEGATECALL", "STATICCALL", "CALLCODE"] and "stack" in log:
            try:
                target_hex = log["stack"][-2]
                target_addr = Web3.to_checksum_address("0x" + target_hex[-40:])
                call_stack.append(target_addr)
                current_addr = target_addr
            except Exception:
                pass
        elif op in ["RETURN", "STOP", "REVERT", "SELFDESTRUCT"]:
            if call_stack:
                call_stack.pop()
                current_addr = call_stack[-1] if call_stack else None

        # If executing inside a Stylus contract context, apply Stylus metrics
        if current_addr in stylus_contracts:
            gas_cost = log.get("gasCost", 0)
            # 1 EVM Gas = 10,000 Ink units
            total_ink += int(gas_cost * 10000)

            # Identify host-to-VM transition points (Host I/O events)
            if op in ["SLOAD", "SSTORE", "LOG0", "LOG1", "LOG2", "LOG3", "LOG4"]:
                host_io_penalty_gas += 0.84
                total_ink += int(0.84 * 10000)

    # 2. Nitro Gas Buffers and 2D Fee Equation
    total_l2_gas_used = trace_data.get("gas_used", 0)
    total_l2_fees_wei = 0
    total_l1_buffer_gas = 0.0

    try:
        l2_base_fee = w3.eth.get_block('latest')['baseFeePerGas']
    except Exception:
        l2_base_fee = w3.eth.gas_price

    for tx in transactions:
        calldata_hex = tx.get("data", "0x")
        calldata = calldata_hex[2:] if calldata_hex.startswith("0x") else calldata_hex
        calldata_bytes = bytes.fromhex(calldata) if calldata else b''
        
        if calldata_bytes:
            try:
                compressed = brotli.compress(calldata_bytes, quality=1)
                compressed_size = len(compressed)
            except Exception as e:
                print(f"Brotli compression failed: {e}. Falling back to uncompressed size.")
                compressed_size = len(calldata_bytes)
                
            data_footprint = compressed_size * 16
            l1_gas_buffer = data_footprint / max(l2_base_fee, 1)
            total_l1_buffer_gas += l1_gas_buffer

    # Total Transaction Fee = L2_Gas_Price * (L2_Gas_Used + L1_Calldata_Gas_Buffer)
    l2_gas_price = w3.eth.gas_price
    l2_gas_used_with_penalty = total_l2_gas_used + host_io_penalty_gas
    total_fees_wei = int(l2_gas_price * (l2_gas_used_with_penalty + total_l1_buffer_gas))

    # Calculate net USD P&L
    tokens_to_track = {
        "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": "USDC",
        "0x82aF49447D8a07e3bd95BD0d56f352415231aa11": "WETH",
        "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": "WBTC"
    }
    
    net_pnl_usd = 0.0
    balance_traces = []
    
    pre_bals = trace_data.get("pre_balances", {})
    post_bals = trace_data.get("post_balances", {})
    
    for token_addr, symbol in tokens_to_track.items():
        pre_bal = pre_bals.get(token_addr, 0)
        post_bal = post_bals.get(token_addr, 0)
        
        if pre_bal != post_bal:
            try:
                token_contract = w3.eth.contract(address=Web3.to_checksum_address(token_addr), abi=ERC20_ABI)
                decimals = token_contract.functions.decimals().call()
            except Exception:
                decimals = 18 if symbol != "USDC" else 6
                
            diff = post_bal - pre_bal
            amount_diff = diff / (10 ** decimals)
            
            prices = {"ETH": 3500.0, "WETH": 3500.0, "BTC": 65000.0, "WBTC": 65000.0, "USDC": 1.0}
            price = prices.get(symbol, 0.0)
            
            try:
                if symbol in ["ETH", "WETH"]:
                    feed = w3.eth.contract(address=CHAINLINK_ETH_USD, abi=CHAINLINK_ABI)
                    price = float(feed.functions.latestAnswer().call()) / 1e8
                elif symbol in ["BTC", "WBTC"]:
                    feed = w3.eth.contract(address=CHAINLINK_BTC_USD, abi=CHAINLINK_ABI)
                    price = float(feed.functions.latestAnswer().call()) / 1e8
            except Exception:
                pass
                
            value_usd = amount_diff * price
            net_pnl_usd += value_usd

            balance_traces.append({
                "token": token_addr,
                "symbol": symbol,
                "pre_balance": str(pre_bal),
                "post_balance": str(post_bal),
                "difference": str(diff),
                "difference_formatted": f"{amount_diff:+.6f} {symbol}",
                "value_usd": f"{value_usd:+.2f}"
            })

    slippage_pct = 0.0
    if net_pnl_usd < 0:
        slippage_pct = abs(net_pnl_usd) / max(abs(net_pnl_usd) + 1000, 1) * 100.0

    gas_cost_eth = float(total_fees_wei) / 1e18

    # Extract target and compute MEV/Timeboost analytics
    first_tx = transactions[0] if transactions else {}
    calldata_hex = first_tx.get("data", "0x")
    calldata = calldata_hex[2:] if calldata_hex.startswith("0x") else calldata_hex
    calldata_bytes = bytes.fromhex(calldata) if calldata else b''
    target_contract = first_tx.get("to", "0x0000000000000000000000000000000000000000")
    
    timeboost_mev_telemetry = evaluate_timeboost_and_mev_risk(calldata_bytes, target_contract, total_l2_gas_used)

    return {
        "session_id": session_id,
        "status": trace_data.get("status", "SUCCESS"),
        "gas_cost_eth": f"{gas_cost_eth:.8f}",
        "stylus_ink_consumed": total_ink,
        "net_pnl_usd": f"{net_pnl_usd:+.2f}",
        "slippage_detected": f"{slippage_pct:.2f}%",
        "revert_reason": trace_data.get("revert_reason"),
        "balance_traces": balance_traces,
        "token_transfers": trace_data.get("token_transfers", []),
        "gas_breakdown": {
            "l2_gas_used": total_l2_gas_used,
            "host_io_penalty_gas": host_io_penalty_gas,
            "l1_gas_buffer": total_l1_buffer_gas,
            "total_fees_wei": str(total_fees_wei)
        },
        "timeboost_mev_telemetry": timeboost_mev_telemetry,
        "execution_traces": struct_logs
    }

class AnalyticalBrain:
    def __init__(self, rpc_url: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise RuntimeError(f"Cannot connect to Anvil fork at {rpc_url}")

    def execute_simulation(self, agent_address: str, transactions: list, max_slippage: float, user_op: dict = None, entrypoint_version: str = 'v0.6') -> dict:
        """
        Executes transactions or UserOperations against the local fork, fetches traces, and calls
        analyze_execution_trace to parse internal Nitro & Stylus metrics.
        """
        agent_checksum = Web3.to_checksum_address(agent_address)
        tokens_to_track = {
            "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": "USDC",
            "0x82aF49447D8a07e3bd95BD0d56f352415231aa11": "WETH",
            "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": "WBTC"
        }
        
        pre_balances = {}
        for token_addr in tokens_to_track:
            try:
                token_contract = self.w3.eth.contract(address=Web3.to_checksum_address(token_addr), abi=ERC20_ABI)
                pre_balances[token_addr] = token_contract.functions.balanceOf(agent_checksum).call()
            except Exception:
                pre_balances[token_addr] = 0

        receipts = []
        struct_logs = []
        total_gas_used = 0
        execution_status = "SUCCESS"
        revert_reason = None
        token_transfers = []
        simulated_txs = []

        if user_op:
            # Execute UserOperation handleOps directly
            entrypoint_address = ENTRYPOINT_V07_ADDRESS if entrypoint_version == 'v0.7' else ENTRYPOINT_V06_ADDRESS
            entrypoint_abi = ENTRYPOINT_V07_ABI if entrypoint_version == 'v0.7' else ENTRYPOINT_V06_ABI
            
            entrypoint_checksum = Web3.to_checksum_address(entrypoint_address)
            entrypoint_contract = self.w3.eth.contract(address=entrypoint_checksum, abi=entrypoint_abi)
            
            # Format UserOperation structure types for Web3.py
            formatted_op = {}
            for k, v in user_op.items():
                if isinstance(v, str) and v.startswith("0x"):
                    if k in ["nonce", "callGasLimit", "verificationGasLimit", "preVerificationGas", "maxFeePerGas", "maxPriorityFeePerGas", "preVerificationGas"]:
                        formatted_op[k] = int(v, 16)
                    elif k in ["sender"]:
                        formatted_op[k] = Web3.to_checksum_address(v)
                    else:
                        formatted_op[k] = bytes.fromhex(v[2:])
                elif isinstance(v, int):
                    formatted_op[k] = v
                else:
                    formatted_op[k] = v
            
            # Re-fund and Impersonate standard executor to submit handleOps
            executor_address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
            self.w3.provider.make_request("anvil_impersonateAccount", [executor_address])
            self.w3.provider.make_request("anvil_setBalance", [executor_address, "0x56BC75E2D63100000"])
            
            try:
                tx_hash = entrypoint_contract.functions.handleOps(
                    [formatted_op],
                    Web3.to_checksum_address("0x0000000000000000000000000000000000000000")
                ).transact({
                    "from": executor_address,
                    "gas": 8_000_000,
                    "gasPrice": self.w3.eth.gas_price
                })
                
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=5)
                receipts.append(receipt)
                
                simulated_txs.append({
                    "to": entrypoint_address,
                    "data": entrypoint_contract.encode_abi("handleOps", [[formatted_op], "0x0000000000000000000000000000000000000000"]),
                    "value": "0"
                })

                if receipt["status"] == 0:
                    execution_status = "REVERT"
                    revert_reason = "EntryPoint execution reverted during handleOps."
                else:
                    total_gas_used += receipt["gasUsed"]
                    
                    # Fetch debug trace
                    try:
                        trace_res = self.w3.provider.make_request("debug_traceTransaction", [tx_hash.hex(), {"disableStorage": True}])
                        if "result" in trace_res and "structLogs" in trace_res["result"]:
                            struct_logs.extend(trace_res["result"]["structLogs"])
                    except Exception as trace_err:
                        print(f"Could not get handleOps trace: {trace_err}")

                    # Extract ERC20 transfer events
                    for log in receipt.get("logs", []):
                        if log["topics"] and log["topics"][0].hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
                            try:
                                from_addr = "0x" + log["topics"][1].hex()[-40:]
                                to_addr = "0x" + log["topics"][2].hex()[-40:]
                                val_raw = int(log["data"].hex(), 16) if isinstance(log["data"], bytes) else int(log["data"], 16)
                                token_transfers.append({
                                    "token": log["address"],
                                    "from": from_addr,
                                    "to": to_addr,
                                    "amount": str(val_raw)
                                })
                            except Exception:
                                pass
            except Exception as e:
                execution_status = "REVERT"
                revert_reason = str(e)
            finally:
                self.w3.provider.make_request("anvil_stopImpersonatingAccount", [executor_address])
        else:
            # EOA Simulation Batch Mode
            self.w3.provider.make_request("anvil_impersonateAccount", [agent_address])
            self.w3.provider.make_request("anvil_setBalance", [agent_address, "0x56BC75E2D63100000"])
            
            for idx, tx in enumerate(transactions):
                to_addr = Web3.to_checksum_address(tx["to"])
                data_hex = tx["data"]
                val_wei = int(tx["value"])
                gas_limit = int(tx.get("gasLimit", 5_000_000))
                simulated_txs.append(tx)

                try:
                    tx_params = {
                        "from": agent_checksum,
                        "to": to_addr,
                        "data": data_hex,
                        "value": val_wei,
                        "gas": gas_limit,
                        "gasPrice": self.w3.eth.gas_price
                    }

                    tx_hash = self.w3.eth.send_transaction(tx_params)
                    receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=5)
                    receipts.append(receipt)

                    if receipt["status"] == 0:
                        execution_status = "REVERT"
                        revert_reason = f"Transaction at index {idx} reverted."
                        break

                    total_gas_used += receipt["gasUsed"]

                    # Fetch trace logs
                    try:
                        trace_res = self.w3.provider.make_request("debug_traceTransaction", [tx_hash.hex(), {"disableStorage": True}])
                        if "result" in trace_res and "structLogs" in trace_res["result"]:
                            struct_logs.extend(trace_res["result"]["structLogs"])
                    except Exception as trace_err:
                        print(f"Could not get transaction trace: {trace_err}")

                    # Extract transfers
                    for log in receipt.get("logs", []):
                        if log["topics"] and log["topics"][0].hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
                            try:
                                from_addr = "0x" + log["topics"][1].hex()[-40:]
                                to_addr = "0x" + log["topics"][2].hex()[-40:]
                                val_raw = int(log["data"].hex(), 16) if isinstance(log["data"], bytes) else int(log["data"], 16)
                                token_transfers.append({
                                    "token": log["address"],
                                    "from": from_addr,
                                    "to": to_addr,
                                    "amount": str(val_raw)
                                })
                            except Exception:
                                pass

                except ContractLogicError as cle:
                    execution_status = "REVERT"
                    revert_reason = str(cle)
                    break
                except Exception as e:
                    execution_status = "REVERT"
                    revert_reason = str(e)
                    break

            self.w3.provider.make_request("anvil_stopImpersonatingAccount", [agent_address])

        # Read post balances
        post_balances = {}
        for token_addr in tokens_to_track:
            try:
                token_contract = self.w3.eth.contract(address=Web3.to_checksum_address(token_addr), abi=ERC20_ABI)
                post_balances[token_addr] = token_contract.functions.balanceOf(agent_checksum).call()
            except Exception:
                post_balances[token_addr] = 0

        # Construct trace payload to send to analyze_execution_trace
        trace_data = {
            "transactions": simulated_txs,
            "agent_address": agent_address,
            "gas_used": total_gas_used,
            "status": execution_status,
            "revert_reason": revert_reason,
            "structLogs": struct_logs,
            "token_transfers": token_transfers,
            "pre_balances": pre_balances,
            "post_balances": post_balances
        }

        session_id = "synctest_" + os.urandom(4).hex()
        return analyze_execution_trace(session_id, trace_data, self.w3.provider.endpoint_uri)
