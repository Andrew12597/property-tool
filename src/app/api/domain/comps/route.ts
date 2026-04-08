import { NextRequest, NextResponse } from 'next/server'
import { searchSoldProperties } from '@/lib/domain'

export async function POST(req: NextRequest) {
  try {
    const params = await req.json()
    const data = await searchSoldProperties(params)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Comps search error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
