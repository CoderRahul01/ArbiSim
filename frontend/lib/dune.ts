const DUNE_API_KEY = process.env.DUNE_API_KEY

export interface MarketStats {
  arbitrumSwaps90d: number | null
  avalancheSwaps90d: number | null
  arbitrumVolume90d: number | null
  avalancheVolume90d: number | null
}

export async function getMarketStats(): Promise<MarketStats> {
  if (!DUNE_API_KEY) {
    return { arbitrumSwaps90d: null, avalancheSwaps90d: null, arbitrumVolume90d: null, avalancheVolume90d: null }
  }

  const headers = { 'X-Dune-API-Key': DUNE_API_KEY }

  const [arbRes, avaxRes] = await Promise.all([
    fetch('https://api.dune.com/api/v1/query/7798598/results?limit=1', {
      headers,
      next: { revalidate: 3600 },
    }),
    fetch('https://api.dune.com/api/v1/query/7800100/results?limit=1', {
      headers,
      next: { revalidate: 3600 },
    }),
  ])

  if (!arbRes.ok || !avaxRes.ok) {
    return { arbitrumSwaps90d: null, avalancheSwaps90d: null, arbitrumVolume90d: null, avalancheVolume90d: null }
  }

  const [arb, avax] = await Promise.all([arbRes.json(), avaxRes.json()])

  return {
    arbitrumSwaps90d:   arb.result?.rows?.[0]?.total_swaps_90d   ?? null,
    avalancheSwaps90d:  avax.result?.rows?.[0]?.total_swaps_90d  ?? null,
    arbitrumVolume90d:  arb.result?.rows?.[0]?.total_volume_usd_90d  ?? null,
    avalancheVolume90d: avax.result?.rows?.[0]?.total_volume_usd_90d ?? null,
  }
}
