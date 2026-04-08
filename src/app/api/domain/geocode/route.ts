import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/domain'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })
  try {
    const data = await geocodeAddress(address)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
