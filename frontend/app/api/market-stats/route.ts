import { NextResponse } from 'next/server'
import { getMarketStats } from '@/lib/dune'

export const revalidate = 3600

export async function GET() {
  const stats = await getMarketStats()
  return NextResponse.json(stats, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
    },
  })
}
