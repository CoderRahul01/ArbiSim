from .arbitrum import ArbitrumAnalyzer
from .avalanche import AvalancheAnalyzer
from .injective import InjectiveAnalyzer
from .solana import SolanaAnalyzer

ANALYZER_MAP = {
    "ArbitrumAnalyzer": ArbitrumAnalyzer,
    "AvalancheAnalyzer": AvalancheAnalyzer,
    "InjectiveAnalyzer": InjectiveAnalyzer,
    "SolanaAnalyzer": SolanaAnalyzer,
}

def register_analyzer(name: str, analyzer_cls) -> None:
    """Register a custom analyzer class at runtime."""
    ANALYZER_MAP[name] = analyzer_cls

def get_analyzer(name: str):
    """Retrieve an analyzer class by name, with safe fallback to Base/Arbitrum."""
    cls = ANALYZER_MAP.get(name)
    if not cls:
        logger_msg = f"Analyzer class '{name}' not found. Falling back to ArbitrumAnalyzer."
        print(logger_msg)
        return ArbitrumAnalyzer
    return cls

__all__ = [
    "ArbitrumAnalyzer",
    "AvalancheAnalyzer",
    "InjectiveAnalyzer",
    "SolanaAnalyzer",
    "ANALYZER_MAP",
    "register_analyzer",
    "get_analyzer",
]


