import os
from web3 import Web3
from web3.exceptions import ContractLogicError

from analyzers import ANALYZER_MAP
from analyzers.avalanche import AvalancheAnalyzer

# ERC-4337 EntryPoint addresses (same on all EVM chains)
ENTRYPOINT_V06_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
ENTRYPOINT_V07_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

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


def _parse_int(value) -> int:
    """Parse int or hex-string (e.g. '0x30D40') to int."""
    if isinstance(value, int):
        return value
    s = str(value).strip()
    if s.startswith("0x") or s.startswith("0X"):
        return int(s, 16)
    return int(s, 10)


def _collect_touched_addresses(transactions: list, agent_address: str, struct_logs: list) -> set:
    touched = set()
    if agent_address:
        touched.add(Web3.to_checksum_address(agent_address))
    for tx in transactions:
        if tx.get("to"):
            touched.add(Web3.to_checksum_address(tx["to"]))
    for log in struct_logs:
        op = log.get("op", "")
        if op in ["CALL", "DELEGATECALL", "STATICCALL", "CALLCODE"] and "stack" in log:
            stack = log["stack"]
            if len(stack) >= 2:
                try:
                    target_addr = Web3.to_checksum_address("0x" + stack[-2][-40:])
                    touched.add(target_addr)
                except Exception:
                    pass
    return touched


def analyze_execution_trace(session_id: str, trace_data: dict, rpc_url: str,
                             chain_config=None) -> dict:
    """
    Main analysis function. Delegates chain-specific logic to the appropriate
    ChainAnalyzer subclass selected via chain_config.
    Falls back to ArbitrumAnalyzer when chain_config is None (backwards-compat).
    """
    from analyzers.arbitrum import ArbitrumAnalyzer

    if chain_config is None:
        analyzer = ArbitrumAnalyzer()
    else:
        analyzer = ANALYZER_MAP[chain_config.analyzer_class]()

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise RuntimeError(f"Cannot connect to Anvil fork at {rpc_url}")

    transactions = trace_data.get("transactions", [])
    agent_address = trace_data.get("agent_address")
    struct_logs = trace_data.get("structLogs", [])

    touched_addresses = _collect_touched_addresses(transactions, agent_address, struct_logs)

    # Chain-specific ink / host I/O (Arbitrum only; zero on other chains)
    total_ink, host_io_penalty = analyzer.compute_stylus_ink(struct_logs, touched_addresses, w3)

    total_gas_used = trace_data.get("gas_used", 0)

    # Gas cost
    gas_report = analyzer.compute_gas(
        gas_used=total_gas_used,
        transactions=transactions,
        struct_logs=struct_logs,
        host_io_penalty=host_io_penalty,
        w3=w3,
    )

    # Token P&L
    tokens_to_track = analyzer.get_token_addresses()
    pre_bals = trace_data.get("pre_balances", {})
    post_bals = trace_data.get("post_balances", {})

    net_pnl_usd = 0.0
    balance_traces = []
    agent_checksum = Web3.to_checksum_address(agent_address) if agent_address else None

    for token_addr, symbol in tokens_to_track.items():
        pre_bal = pre_bals.get(token_addr, 0)
        post_bal = post_bals.get(token_addr, 0)
        if pre_bal == post_bal:
            continue

        try:
            token_contract = w3.eth.contract(
                address=Web3.to_checksum_address(token_addr), abi=ERC20_ABI
            )
            decimals = token_contract.functions.decimals().call()
        except Exception:
            decimals = 6 if symbol == "USDC" else 18

        diff = post_bal - pre_bal
        amount_diff = diff / (10 ** decimals)
        price = analyzer.get_price_usd(symbol, w3)
        value_usd = amount_diff * price
        net_pnl_usd += value_usd

        balance_traces.append({
            "token": token_addr,
            "symbol": symbol,
            "pre_balance": str(pre_bal),
            "post_balance": str(post_bal),
            "difference": str(diff),
            "difference_formatted": f"{amount_diff:+.6f} {symbol}",
            "value_usd": f"{value_usd:+.2f}",
        })

    # Slippage = abs(net loss) / total input value * 100
    # Denominator is the USD value of all tokens the agent held before the swap.
    # This is the correct definition: how much value was lost relative to what went in.
    input_value_usd = 0.0
    for token_addr, symbol in tokens_to_track.items():
        pre_bal = pre_bals.get(token_addr, 0)
        if pre_bal > 0:
            try:
                tc = w3.eth.contract(
                    address=Web3.to_checksum_address(token_addr), abi=ERC20_ABI
                )
                dec = tc.functions.decimals().call()
            except Exception:
                dec = 6 if symbol == "USDC" else 18
            price = analyzer.get_price_usd(symbol, w3)
            input_value_usd += (pre_bal / (10 ** dec)) * price

    slippage_pct = 0.0
    if net_pnl_usd < 0 and input_value_usd > 0:
        slippage_pct = (abs(net_pnl_usd) / input_value_usd) * 100.0

    # MEV risk
    mev_report = analyzer.compute_mev_risk(transactions, total_gas_used, chain_config)

    # Chain-specific extras (pass w3 so AvalancheAnalyzer can do ERC-8004 check inside fork)
    chain_extras = analyzer.chain_specific_report(transactions, chain_config, w3=w3)

    raw_status = trace_data.get("status", "SUCCESS")
    terminal_status = "APPROVED" if raw_status == "SUCCESS" else "REJECTED"

    breakdown = gas_report.gas_breakdown({
        "host_io_penalty_gas": host_io_penalty,
    })

    return {
        "session_id": session_id,
        "status": terminal_status,
        "gas_cost_eth": gas_report.gas_cost_eth(),
        "stylus_ink_consumed": total_ink,
        "net_pnl_usd": f"{net_pnl_usd:+.2f}",
        "slippage_detected": f"{slippage_pct:.2f}%",
        "revert_reason": trace_data.get("revert_reason"),
        "balance_traces": balance_traces,
        "token_transfers": trace_data.get("token_transfers", []),
        "gas_breakdown": breakdown,
        "timeboost_mev_telemetry": mev_report.to_telemetry(),
        "execution_traces": struct_logs,
        "chain_extras": chain_extras,
    }


class AnalyticalBrain:
    def __init__(self, rpc_url: str, chain_config=None):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise RuntimeError(f"Cannot connect to Anvil fork at {rpc_url}")
        self.chain_config = chain_config
        if chain_config is not None:
            self.analyzer = ANALYZER_MAP[chain_config.analyzer_class]()
        else:
            from analyzers.arbitrum import ArbitrumAnalyzer
            self.analyzer = ArbitrumAnalyzer()

    def execute_simulation(self, agent_address: str, transactions: list, max_slippage: float,
                           user_op: dict = None, entrypoint_version: str = 'v0.6') -> dict:
        """
        Executes transactions or UserOperations against the local fork, fetches traces,
        and delegates analysis to the chain-specific analyzer.
        """
        agent_checksum = Web3.to_checksum_address(agent_address)
        tokens_to_track = self.analyzer.get_token_addresses()

        pre_balances = {}
        for token_addr in tokens_to_track:
            try:
                token_contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(token_addr), abi=ERC20_ABI
                )
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
            entrypoint_address = ENTRYPOINT_V07_ADDRESS if entrypoint_version == 'v0.7' else ENTRYPOINT_V06_ADDRESS
            entrypoint_abi = ENTRYPOINT_V07_ABI if entrypoint_version == 'v0.7' else ENTRYPOINT_V06_ABI

            entrypoint_checksum = Web3.to_checksum_address(entrypoint_address)
            entrypoint_contract = self.w3.eth.contract(address=entrypoint_checksum, abi=entrypoint_abi)

            formatted_op = {}
            for k, v in user_op.items():
                if isinstance(v, str) and v.startswith("0x"):
                    if k in ["nonce", "callGasLimit", "verificationGasLimit", "preVerificationGas",
                              "maxFeePerGas", "maxPriorityFeePerGas"]:
                        formatted_op[k] = int(v, 16)
                    elif k in ["sender"]:
                        formatted_op[k] = Web3.to_checksum_address(v)
                    else:
                        formatted_op[k] = bytes.fromhex(v[2:])
                elif isinstance(v, int):
                    formatted_op[k] = v
                else:
                    formatted_op[k] = v

            executor_address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
            self.w3.provider.make_request("anvil_impersonateAccount", [executor_address])
            self.w3.provider.make_request("anvil_setBalance", [executor_address, "0x56BC75E2D63100000"])

            # Fund the smart account sender so it passes gas checks during handleOps
            sender_addr = formatted_op.get("sender")
            if sender_addr:
                self.w3.provider.make_request("anvil_setBalance", [sender_addr, "0x56BC75E2D63100000"])

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
                    "data": entrypoint_contract.encode_abi(
                        "handleOps",
                        [[formatted_op], "0x0000000000000000000000000000000000000000"]
                    ),
                    "value": "0"
                })

                if receipt["status"] == 0:
                    execution_status = "REVERT"
                    revert_reason = "EntryPoint execution reverted during handleOps."
                else:
                    total_gas_used += receipt["gasUsed"]
                    try:
                        trace_res = self.w3.provider.make_request(
                            "debug_traceTransaction",
                            [tx_hash.hex(), {"disableStorage": True}]
                        )
                        if "result" in trace_res and "structLogs" in trace_res["result"]:
                            struct_logs.extend(trace_res["result"]["structLogs"])
                    except Exception as trace_err:
                        print(f"Could not get handleOps trace: {trace_err}")

                    for log in receipt.get("logs", []):
                        if log["topics"] and log["topics"][0].hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
                            try:
                                token_transfers.append({
                                    "token": log["address"],
                                    "from": "0x" + log["topics"][1].hex()[-40:],
                                    "to": "0x" + log["topics"][2].hex()[-40:],
                                    "amount": str(
                                        int(log["data"].hex(), 16)
                                        if isinstance(log["data"], bytes)
                                        else int(log["data"], 16)
                                    ),
                                })
                            except Exception:
                                pass
            except Exception as e:
                execution_status = "REVERT"
                revert_reason = str(e)
            finally:
                self.w3.provider.make_request("anvil_stopImpersonatingAccount", [executor_address])
        else:
            self.w3.provider.make_request("anvil_impersonateAccount", [agent_address])
            self.w3.provider.make_request("anvil_setBalance", [agent_address, "0x56BC75E2D63100000"])

            for idx, tx in enumerate(transactions):
                to_addr = Web3.to_checksum_address(tx["to"])
                simulated_txs.append(tx)
                try:
                    tx_hash = self.w3.eth.send_transaction({
                        "from": agent_checksum,
                        "to": to_addr,
                        "data": tx["data"],
                        "value": _parse_int(tx.get("value", "0")),
                        "gas": _parse_int(tx.get("gas", tx.get("gasLimit", 5_000_000))),
                        "gasPrice": self.w3.eth.gas_price,
                    })
                    receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=5)
                    receipts.append(receipt)

                    if receipt["status"] == 0:
                        execution_status = "REVERT"
                        # Try to decode exact revert string via eth_call simulation
                        try:
                            self.w3.eth.call({
                                "from": agent_checksum,
                                "to": to_addr,
                                "data": tx["data"],
                                "value": _parse_int(tx.get("value", "0")),
                            })
                            revert_reason = f"Transaction at index {idx} reverted."
                        except Exception as call_err:
                            revert_reason = f"Tx #{idx} reverted: {str(call_err)}"
                        break

                    total_gas_used += receipt["gasUsed"]

                    try:
                        trace_res = self.w3.provider.make_request(
                            "debug_traceTransaction",
                            [tx_hash.hex(), {"disableStorage": True}]
                        )
                        if "result" in trace_res and "structLogs" in trace_res["result"]:
                            struct_logs.extend(trace_res["result"]["structLogs"])
                    except Exception as trace_err:
                        print(f"Could not get transaction trace: {trace_err}")

                    for log in receipt.get("logs", []):
                        if log["topics"] and log["topics"][0].hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
                            try:
                                token_transfers.append({
                                    "token": log["address"],
                                    "from": "0x" + log["topics"][1].hex()[-40:],
                                    "to": "0x" + log["topics"][2].hex()[-40:],
                                    "amount": str(
                                        int(log["data"].hex(), 16)
                                        if isinstance(log["data"], bytes)
                                        else int(log["data"], 16)
                                    ),
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

        post_balances = {}
        for token_addr in tokens_to_track:
            try:
                token_contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(token_addr), abi=ERC20_ABI
                )
                post_balances[token_addr] = token_contract.functions.balanceOf(agent_checksum).call()
            except Exception:
                post_balances[token_addr] = 0

        trace_data = {
            "transactions": simulated_txs,
            "agent_address": agent_address,
            "gas_used": total_gas_used,
            "status": execution_status,
            "revert_reason": revert_reason,
            "structLogs": struct_logs,
            "token_transfers": token_transfers,
            "pre_balances": pre_balances,
            "post_balances": post_balances,
        }

        session_id = "synctest_" + os.urandom(4).hex()
        return analyze_execution_trace(
            session_id,
            trace_data,
            self.w3.provider.endpoint_uri,
            chain_config=self.chain_config,
        )
