import asyncio
import os
import sys
from dotenv import load_dotenv

# Ensure workers/src is in path
sys.path.append(os.path.join(os.path.dirname(__file__), "workers", "src"))

from simulation_engine import AnvilForkInstance
from analytical_brain import AnalyticalBrain

load_dotenv()

async def run_test():
    print("=== Starting ArbiSim Guard Integration Test ===")
    
    # We will run this on Arbitrum One fork using public RPC
    network = "arbitrum-one"
    print(f"Initializing Anvil fork instance for network: {network}")
    
    anvil_instance = AnvilForkInstance(network)
    
    try:
        # Start anvil
        rpc_url = await anvil_instance.start()
        print("Anvil fork started successfully.")
        
        # We need an agent address (e.g. a random active address on Arbitrum)
        # We will use a known active account for testing, e.g., a Uniswap router or standard EOA
        agent_address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" # vitalik.eth
        
        # Let's verify a standard transaction batch
        # 1. Transfer some ETH from Vitalik to a random receiver
        # 2. Call a standard ERC-20 contract or swap
        transactions = [
            {
                "to": "0x0000000000000000000000000000000000000000",
                "data": "0x",
                "value": str(1 * 10**15), # 0.001 ETH
                "gasLimit": "21000"
            }
        ]
        
        print(f"Initializing Analytical Brain for RPC: {rpc_url}")
        brain = AnalyticalBrain(rpc_url)
        
        print("Executing transaction simulation batch...")
        results = brain.execute_simulation(agent_address, transactions, max_slippage=1.0)
        
        print("\n=== Simulation Result ===")
        print(f"Status: {results['status']}")
        print(f"Gas Cost (L2+L1): {results['gas_cost_eth']} ETH")
        print(f"Stylus Ink Consumed: {results['stylus_ink_consumed']} Ink")
        print(f"Net P&L (USD): {results['net_pnl_usd']}")
        print(f"Slippage Detected: {results['slippage_detected']}")
        print(f"Revert Reason: {results['revert_reason']}")
        print("Gas Breakdown:")
        print(json.dumps(results['gas_breakdown'], indent=2))
        print(f"Balance Traces count: {len(results['balance_traces'])}")
        print(f"Token Transfers count: {len(results['token_transfers'])}")
        
        if results['status'] == "APPROVED":
            print("\nTest SUCCESSFUL!")
        else:
            print(f"\nTest FAILED (Expected APPROVED, got {results['status']}). Revert reason: {results['revert_reason']}")
            
    except Exception as e:
        print(f"Error during integration test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up Anvil
        print("Stopping Anvil fork...")
        await anvil_instance.stop()
        print("Test teardown complete.")

if __name__ == "__main__":
    import json
    asyncio.run(run_test())
