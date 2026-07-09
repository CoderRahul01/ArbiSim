"""
chain_config.py
Single source of truth for all chain-specific data.
Adding a new chain = one new entry in CHAIN_REGISTRY + one ChainAnalyzer subclass. Nothing else.
"""

import os
from dataclasses import dataclass, field
from typing import Optional

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../..', '.env'))


@dataclass
class ChainConfig:
    chain_id: int
    name: str
    display_name: str
    rpc_url: str
    block_explorer: str
    native_token: str
    native_token_usd_feed: str
    registry_address: Optional[str]
    testnet: bool
    analyzer_class: str
    registry_version: int = 2
    known_dex_routers: list = field(default_factory=list)
    extra: dict = field(default_factory=dict)


CHAIN_REGISTRY: dict[str, ChainConfig] = {

    # ── ARBITRUM ────────────────────────────────────────────────────────────────
    "arbitrum-one": ChainConfig(
        chain_id=42161,
        name="arbitrum-one",
        display_name="Arbitrum One",
        rpc_url=os.getenv("ARBITRUM_ONE_RPC", "https://arb1.arbitrum.io/rpc"),
        block_explorer="https://arbiscan.io",
        native_token="ETH",
        native_token_usd_feed="0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
        registry_address=os.getenv(
            "SIMULATION_REGISTRY_ADDRESS",
            "0x9784f7cA750f1301a2090eaDF8f27F78B1A326b2",
        ),
        testnet=False,
        analyzer_class="ArbitrumAnalyzer",
        known_dex_routers=[
            "0xE592427A0AEce92De3Edee1F18E0157C05861564",  # Uniswap V3
            "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",  # SushiSwap
            "0xc873fecbd354f5afca31422734b5267d343f117a",  # Camelot Router
            "0x3b123f1c1665ea07fab53363537950da84e1ba7d",  # GMX Vault
        ],
        extra={
            "arb_gas_info_precompile": "0x000000000000000000000000000000000000006C",
            "timeboost_enabled": True,
            "stylus_enabled": True,
            "l1_data_fee": True,
            "chainlink_btc_usd": "0x6ce18521331128284c21533Cd7d9Cc01086e8F35",
        },
    ),

    "arbitrum-sepolia": ChainConfig(
        chain_id=421614,
        name="arbitrum-sepolia",
        display_name="Arbitrum Sepolia",
        rpc_url=os.getenv("ARBITRUM_SEPOLIA_RPC", "https://sepolia-rollup.arbitrum.io/rpc"),
        block_explorer="https://sepolia.arbiscan.io",
        native_token="ETH",
        native_token_usd_feed="0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
        registry_address=os.getenv(
            "ARBITRUM_SEPOLIA_REGISTRY",
            "0x5Dfd08c3d44BEBfa61a24Af8c2EfbDB5A01dFA32",
        ),
        testnet=True,
        analyzer_class="ArbitrumAnalyzer",
        known_dex_routers=[],
        extra={
            "arb_gas_info_precompile": "0x000000000000000000000000000000000000006C",
            "timeboost_enabled": False,
            "stylus_enabled": True,
            "l1_data_fee": True,
        },
    ),

    # ── AVALANCHE ───────────────────────────────────────────────────────────────
    "avalanche-mainnet": ChainConfig(
        chain_id=43114,
        name="avalanche-mainnet",
        display_name="Avalanche C-Chain",
        rpc_url=os.getenv("AVALANCHE_MAINNET_RPC", "https://api.avax.network/ext/bc/C/rpc"),
        block_explorer="https://subnets.avax.network/c-chain",
        native_token="AVAX",
        native_token_usd_feed="0x0A77230d17318075983913bC2145DB16C7366156",
        registry_address=os.getenv(
            "AVALANCHE_MAINNET_REGISTRY",
            "0xb947B914fCb605D114E9f3C784a3fdE20B3f5CCc",
        ),
        testnet=False,
        analyzer_class="AvalancheAnalyzer",
        known_dex_routers=[
            "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",  # TraderJoe V1
            "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106",  # Pangolin
            "0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901",  # TraderJoe V2
        ],
        extra={
            "timeboost_enabled": False,
            "stylus_enabled": False,
            "l1_data_fee": False,
            "warp_messaging": True,
            "snowman_finality": True,
            "erc8004_registry": os.getenv("ERC8004_REGISTRY_MAINNET"),
            "chainlink_eth_usd": "0x976B3D034E162d8bD72D6b9C989d545b839003b0",
            "chainlink_btc_usd": "0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743",
        },
    ),

    "avalanche-fuji": ChainConfig(
        chain_id=43113,
        name="avalanche-fuji",
        display_name="Avalanche Fuji Testnet",
        rpc_url=os.getenv("AVALANCHE_FUJI_RPC", "https://api.avax-test.network/ext/bc/C/rpc"),
        block_explorer="https://subnets-test.avax.network/c-chain",
        native_token="AVAX",
        native_token_usd_feed="0x5498BB86BC934c8D34FDA08E81D444153d0D06aD",
        registry_address=os.getenv("AVALANCHE_FUJI_REGISTRY"),
        testnet=True,
        analyzer_class="AvalancheAnalyzer",
        registry_version=3,
        known_dex_routers=[],
        extra={
            "timeboost_enabled": False,
            "stylus_enabled": False,
            "l1_data_fee": False,
            "warp_messaging": True,
            "snowman_finality": True,
            "erc8004_registry": os.getenv("ERC8004_REGISTRY_FUJI"),
        },
    ),

    # ── INJECTIVE ───────────────────────────────────────────────────────────────
    # Chain family: Injective EVM (CosmosEVM). Native order book (CLOB) via Exchange
    # Precompile at 0x...0065. MEV resistance via Frequent Batch Auctions (FBA) at the
    # protocol level — no AMM pools, so known_dex_routers is intentionally empty.
    # Price oracle: Pyth pull model (feed ID stored here; InjectiveAnalyzer handles the
    # off-chain fetch + on-chain read pattern with fallback for fork contexts).
    # ERC-8004: uses the REAL Injective IdentityRegistry + ReputationRegistry, not
    # the ArbiSim MockERC8004Registry. Addresses are CREATE2-deterministic across EVM chains.
    "injective-testnet": ChainConfig(
        chain_id=1439,
        name="injective-testnet",
        display_name="Injective EVM Testnet",
        rpc_url=os.getenv("INJECTIVE_TESTNET_RPC", "https://k8s.testnet.json-rpc.injective.network/"),
        block_explorer="https://testnet.blockscout.injective.network",
        native_token="INJ",
        # Pyth INJ/USD price feed ID (bytes32). Used by InjectiveAnalyzer, not a Chainlink addr.
        native_token_usd_feed=os.getenv(
            "INJECTIVE_TESTNET_PYTH_FEED",
            "0x7a5bc1d2b56ad029048cd63964b3ad2776eadf812edc1a43a31406cb54bff592",
        ),
        registry_address=os.getenv("INJECTIVE_TESTNET_REGISTRY"),  # set after DeployInjective.s.sol
        testnet=True,
        analyzer_class="InjectiveAnalyzer",
        registry_version=3,
        known_dex_routers=[],  # No AMM pools — trades route through Exchange Precompile
        extra={
            "timeboost_enabled": False,
            "stylus_enabled": False,
            "l1_data_fee": False,
            "fba_mev_resistant": True,   # Frequent Batch Auctions — protocol-level MEV resistance
            "exchange_precompile": "0x0000000000000000000000000000000000000065",
            # Real ERC-8004 IdentityRegistry — CREATE2-deployed, same addr on all EVM chains
            "erc8004_identity_registry": os.getenv(
                "INJECTIVE_TESTNET_ERC8004_IDENTITY",
                "0x8004A818BFB912233c491871b3d84c89A494BD9e",
            ),
            # Real ERC-8004 ReputationRegistry
            "erc8004_reputation_registry": os.getenv(
                "INJECTIVE_TESTNET_ERC8004_REPUTATION",
                "0x8004B663056A597Dffe9eCcC1965A193B7388713",
            ),
            # Pyth contract on Injective EVM (upgraded address; confirm if integrating mainnet)
            "pyth_contract": os.getenv(
                "INJECTIVE_TESTNET_PYTH_CONTRACT",
                "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
            ),
        },
    ),

    "injective-mainnet": ChainConfig(
        chain_id=1776,
        name="injective-mainnet",
        display_name="Injective EVM Mainnet",
        rpc_url=os.getenv("INJECTIVE_MAINNET_RPC", "https://sentry.evm-rpc.injective.network/"),
        block_explorer="https://blockscout.injective.network",
        native_token="INJ",
        native_token_usd_feed=os.getenv(
            "INJECTIVE_MAINNET_PYTH_FEED",
            "0x7a5bc1d2b56ad029048cd63964b3ad2776eadf812edc1a43a31406cb54bff592",
        ),
        registry_address=os.getenv("INJECTIVE_MAINNET_REGISTRY"),  # deploy before use
        testnet=False,
        analyzer_class="InjectiveAnalyzer",
        registry_version=3,
        known_dex_routers=[],
        extra={
            "timeboost_enabled": False,
            "stylus_enabled": False,
            "l1_data_fee": False,
            "fba_mev_resistant": True,
            "exchange_precompile": "0x0000000000000000000000000000000000000065",
            "erc8004_identity_registry": os.getenv("INJECTIVE_MAINNET_ERC8004_IDENTITY"),
            "erc8004_reputation_registry": os.getenv("INJECTIVE_MAINNET_ERC8004_REPUTATION"),
            "pyth_contract": os.getenv("INJECTIVE_MAINNET_PYTH_CONTRACT"),
        },
    ),

    # ── ROBINHOOD ───────────────────────────────────────────────────────────────
    "robinhood-chain-testnet": ChainConfig(
        chain_id=46630,
        name="robinhood-chain-testnet",
        display_name="Robinhood Chain Testnet",
        rpc_url=os.getenv("ROBINHOOD_CHAIN_TESTNET_RPC", ""),
        block_explorer="",
        native_token="ETH",
        native_token_usd_feed="",
        registry_address=None,
        testnet=True,
        analyzer_class="ArbitrumAnalyzer",
        known_dex_routers=[],
        extra={
            "timeboost_enabled": False,
            "stylus_enabled": False,
            "l1_data_fee": True,
        },
    ),
}


def get_chain(network: str) -> ChainConfig:
    cfg = CHAIN_REGISTRY.get(network)
    if not cfg:
        supported = list(CHAIN_REGISTRY.keys())
        raise ValueError(f"Unsupported network: '{network}'. Supported: {supported}")
    return cfg


def get_chain_by_id(chain_id: int) -> ChainConfig:
    for cfg in CHAIN_REGISTRY.values():
        if cfg.chain_id == chain_id:
            return cfg
    raise ValueError(f"No chain registered for chain_id={chain_id}")


def list_chains(testnet: bool = None) -> list[str]:
    if testnet is None:
        return list(CHAIN_REGISTRY.keys())
    return [k for k, v in CHAIN_REGISTRY.items() if v.testnet == testnet]
