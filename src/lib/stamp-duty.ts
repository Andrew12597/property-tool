// Stamp duty calculators for NSW and QLD
// NSW: Revenue NSW transfer duty rates from 1 July 2025
// QLD: Queensland OSR transfer duty rates

export type State = 'NSW' | 'QLD'

export function calcStampDuty(price: number, state: State): number {
  if (state === 'NSW') return calcNSW(price)
  return calcQLD(price)
}

function calcNSW(price: number): number {
  if (price <= 17_000) return price * 0.0125
  if (price <= 36_000) return 212 + (price - 17_000) * 0.015
  if (price <= 97_000) return 497 + (price - 36_000) * 0.0175
  if (price <= 364_000) return 1_564 + (price - 97_000) * 0.035
  if (price <= 1_212_000) return 10_909 + (price - 364_000) * 0.045
  if (price <= 3_721_000) return 49_069 + (price - 1_212_000) * 0.055
  // Premium property duty over $3.721m
  return 187_064 + (price - 3_721_000) * 0.07
}

function calcQLD(price: number): number {
  if (price <= 5_000) return 0
  if (price <= 75_000) return (price - 5_000) * 0.015
  if (price <= 540_000) return 1_050 + (price - 75_000) * 0.035
  if (price <= 1_000_000) return 17_325 + (price - 540_000) * 0.045
  return 38_025 + (price - 1_000_000) * 0.0575
}
