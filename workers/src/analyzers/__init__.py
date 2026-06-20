from .arbitrum import ArbitrumAnalyzer
from .avalanche import AvalancheAnalyzer

ANALYZER_MAP = {
    "ArbitrumAnalyzer": ArbitrumAnalyzer,
    "AvalancheAnalyzer": AvalancheAnalyzer,
}

__all__ = ["ArbitrumAnalyzer", "AvalancheAnalyzer", "ANALYZER_MAP"]
