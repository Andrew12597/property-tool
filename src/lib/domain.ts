// Domain API client
// Docs: https://developer.domain.com.au/docs/latest

const DOMAIN_AUTH_URL = 'https://auth.domain.com.au/v1/connect/token'
const DOMAIN_API_URL = 'https://api.domain.com.au/v1'

let cachedToken: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token

  const res = await fetch(DOMAIN_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'api_listings_read api_properties_read',
      client_id: process.env.DOMAIN_CLIENT_ID!,
      client_secret: process.env.DOMAIN_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) throw new Error(`Domain auth failed: ${res.status}`)
  const data = await res.json()
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.token
}

async function domainFetch(path: string, options?: RequestInit) {
  const token = await getToken()
  const res = await fetch(`${DOMAIN_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Domain API ${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}

export interface CompsSearchParams {
  lat: number
  lng: number
  radiusKm: number
  minPrice?: number
  maxPrice?: number
  minLandSize?: number
  maxLandSize?: number
  soldAfter?: string   // ISO date string
  propertyTypes?: string[]
  pageSize?: number
}

export async function searchSoldProperties(params: CompsSearchParams) {
  const body = {
    listingType: 'Sold',
    propertyTypes: params.propertyTypes ?? ['House', 'Duplex'],
    locations: [{
      state: '',
      region: '',
      area: '',
      suburb: '',
      postCode: '',
      includeSurroundingSuburbs: false,
    }],
    geoWindow: {
      circle: {
        center: { lat: params.lat, lon: params.lng },
        radiusInMeters: params.radiusKm * 1000,
      },
    },
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minLandArea: params.minLandSize,
    maxLandArea: params.maxLandSize,
    soldAfter: params.soldAfter,
    pageSize: params.pageSize ?? 50,
    sort: { sortKey: 'SoldDate', direction: 'Descending' },
  }

  return domainFetch('/listings/residential/_search', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export interface ListingSearchParams {
  suburb: string
  state: string
  postcode?: string
  minPrice?: number
  maxPrice?: number
  minLandSize?: number
  maxLandSize?: number
  propertyTypes?: string[]
  pageSize?: number
}

export async function searchActiveListings(params: ListingSearchParams) {
  const body = {
    listingType: 'Sale',
    propertyTypes: params.propertyTypes ?? ['House', 'Duplex'],
    locations: [{
      state: params.state,
      suburb: params.suburb,
      postCode: params.postcode ?? '',
      includeSurroundingSuburbs: true,
    }],
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minLandArea: params.minLandSize,
    maxLandArea: params.maxLandSize,
    pageSize: params.pageSize ?? 50,
    sort: { sortKey: 'Price', direction: 'Ascending' },
  }

  return domainFetch('/listings/residential/_search', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function geocodeAddress(address: string) {
  return domainFetch(`/addressLocators?terms=${encodeURIComponent(address)}&pageSize=5`)
}
