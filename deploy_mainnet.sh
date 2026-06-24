#!/bin/bash
set -a
source /Volumes/Powerhouse/Side\ Hustle/ArbiSim/.env
set +a

forge create \
  contracts/SimulationRegistry.sol:SimulationRegistry \
  --rpc-url "$ARBITRUM_ONE_RPC" \
  --private-key "0x$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --verify \
  --etherscan-api-key "$ARBISCAN_API_KEY"
