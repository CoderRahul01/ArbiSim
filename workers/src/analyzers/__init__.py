from .arbitrum import ArbitrumAnalyzer
from .avalanche import AvalancheAnalyzer
from .injective import InjectiveAnalyzer

ANALYZER_MAP = {
    "ArbitrumAnalyzer": ArbitrumAnalyzer,
    "AvalancheAnalyzer": AvalancheAnalyzer,
    "InjectiveAnalyzer": InjectiveAnalyzer,
}

__all__ = ["ArbitrumAnalyzer", "AvalancheAnalyzer", "InjectiveAnalyzer", "ANALYZER_MAP"]

