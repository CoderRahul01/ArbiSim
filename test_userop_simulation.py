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
    print("=== Starting ArbiSim Guard UserOperation Execution Test ===")
    
    network = "arbitrum-one"
    print(f"Initializing Anvil fork instance for network: {network}")
    
    anvil_instance = AnvilForkInstance(network)
    
    try:
        # Start anvil
        rpc_url = await anvil_instance.start()
        print("Anvil fork started successfully.")
        
        # Anvil Account #1 as the EOA agent/bundler
        agent_address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        
        # Define a mock EntryPoint v0.6 UserOperation
        # This userop has a dummy signature and is not deployed, so Entrypoint will revert,
        # which is exactly what we want to verify (that the trace is parsed and fails gracefully).
        user_op = {
            "sender": "0x1234567890123456789012345678901234567890",
            "nonce": "0x0",
            "initCode": "0x",
            "callData": "0x",
            "callGasLimit": "0x30000",
            "verificationGasLimit": "0x50000",
            "preVerificationGas": "0x10000",
            "maxFeePerGas": "0x3b9aca00",
            "maxPriorityFeePerGas": "0x3b9aca00",
            "paymasterAndData": "0x",
            "signature": "0x123456"
        }
        
        print(f"Initializing Analytical Brain for RPC: {rpc_url}")
        brain = AnalyticalBrain(rpc_url)
        
        print("Executing UserOperation handleOps simulation...")
        results = brain.execute_simulation(
            agent_address=agent_address,
            transactions=[],
            max_slippage=1.0,
            user_op=user_op,
            entrypoint_version="v0.6"
        )
        
        print("\n=== Simulation Result ===")
        print(f"Status: {results['status']}")
        print(f"Gas Cost (L2+L1): {results['gas_cost_eth']} ETH")
        print(f"Stylus Ink Consumed: {results['stylus_ink_consumed']} Ink")
        print(f"Net P&L (USD): {results['net_pnl_usd']}")
        print(f"Slippage Detected: {results['slippage_detected']}")
        print(f"Revert Reason: {results['revert_reason']}")
        
        if results['status'] == "REJECTED":
            print("\nTest SUCCESSFUL! Revert was caught and parsed correctly.")
        else:
            print(f"\nTest UNEXPECTED (Expected REJECTED, got {results['status']}).")
            
    except Exception as e:
        print(f"Error during UserOperation integration test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("Stopping Anvil fork...")
        await anvil_instance.stop()
        print("Test teardown complete.")

if __name__ == "__main__":
    asyncio.run(run_test())
