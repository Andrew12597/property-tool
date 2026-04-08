import { calcStampDuty, State } from './stamp-duty'

// ─── Shared inputs ─────────────────────────────────────────────────────────────

export interface SharedInputs {
  state: State
  numDwellings: number
  sellingFeePercent: number
  // Build cost — toggle between per-m² or flat total
  buildCostMode: 'per-m2' | 'flat'
  buildAreaPerDwelling: number   // m² per dwelling (always needed)
  buildCostPerM2: number         // used when mode = 'per-m2'
  buildCostFlat: number          // used when mode = 'flat'
  // Finance
  landLVR: number
  landInterestRate: number
  buildInterestRate: number
  buildFundedPercent: number
  buildTimeMonths: number
  purchaseToSaleMonths: number
  // Soft costs
  consultantsDA: number
  demolitionSiteworks: number
  legalAccounting: number
  contingency: number
  otherMisc: number
  bankFees: number
  // Investor split
  numInvestors: number
}

// ─── Max Buy Price ─────────────────────────────────────────────────────────────

export interface MaxBuyInputs extends SharedInputs {
  salePricePerDwelling: number   // expected sale price per dwelling
  targetMarginOnGRV: number      // e.g. 0.18
}

export interface MaxBuyResult {
  // Revenue
  totalGRV: number
  sellingCosts: number
  netSales: number
  // Build
  totalBuildArea: number
  buildCostTotal: number
  buildCostPerM2Effective: number
  // Costs
  softCostsTotal: number
  buildInterest: number
  targetProfit: number
  // Ideal buy price outputs
  idealBuyPrice: number
  stampDuty: number
  landLoan: number
  landEquityDeposit: number
  landInterest: number
  buildEquityGap: number
  minEquityRequired: number
  equityPerInvestor: number
  totalProjectCost: number
  expectedProfit: number
  expectedMarginOnGRV: number
  roiOnEquity: number
}

export function calcMaxBuyPrice(inputs: MaxBuyInputs): MaxBuyResult {
  const {
    state, salePricePerDwelling, numDwellings, sellingFeePercent,
    buildAreaPerDwelling, buildCostMode, buildCostPerM2, buildCostFlat,
    landLVR, landInterestRate, buildInterestRate, buildFundedPercent,
    buildTimeMonths, purchaseToSaleMonths,
    consultantsDA, demolitionSiteworks, legalAccounting,
    contingency, otherMisc, bankFees,
    targetMarginOnGRV, numInvestors,
  } = inputs

  const totalBuildArea = buildAreaPerDwelling * numDwellings
  const buildCostTotal = buildCostMode === 'flat' ? buildCostFlat : totalBuildArea * buildCostPerM2
  const buildCostPerM2Effective = buildCostMode === 'flat' ? buildCostTotal / totalBuildArea : buildCostPerM2

  const totalGRV = salePricePerDwelling * numDwellings
  const sellingCosts = totalGRV * sellingFeePercent
  const netSales = totalGRV - sellingCosts
  const softCostsTotal = consultantsDA + demolitionSiteworks + legalAccounting + contingency + otherMisc + bankFees
  const buildInterest = buildCostTotal * buildFundedPercent * buildInterestRate * (buildTimeMonths / 12) * 0.5
  const targetProfit = totalGRV * targetMarginOnGRV

  // Binary search for ideal buy price in $500 increments
  let idealBuyPrice = 500
  for (let candidate = 500; candidate <= 50_000_000; candidate += 500) {
    const sd = calcStampDuty(candidate, state)
    const landLoanC = candidate * landLVR
    const landInterestC = landLoanC * landInterestRate * (purchaseToSaleMonths / 12)
    const totalProjectCostC = candidate + sd + buildCostTotal + softCostsTotal + buildInterest + landInterestC + sellingCosts
    if (totalProjectCostC + targetProfit <= totalGRV) {
      idealBuyPrice = candidate
    } else {
      break
    }
  }

  const stampDuty = calcStampDuty(idealBuyPrice, state)
  const landLoan = idealBuyPrice * landLVR
  const landEquityDeposit = idealBuyPrice * (1 - landLVR)
  const landInterest = landLoan * landInterestRate * (purchaseToSaleMonths / 12)
  const buildEquityGap = buildCostTotal * (1 - buildFundedPercent)
  const minEquityRequired = landEquityDeposit + stampDuty + softCostsTotal + buildInterest + landInterest + buildEquityGap
  const equityPerInvestor = minEquityRequired / numInvestors
  const totalProjectCost = idealBuyPrice + stampDuty + buildCostTotal + softCostsTotal + buildInterest + landInterest + sellingCosts
  const expectedProfit = totalGRV - totalProjectCost
  const expectedMarginOnGRV = expectedProfit / totalGRV
  const roiOnEquity = expectedProfit / minEquityRequired

  return {
    totalGRV, sellingCosts, netSales,
    totalBuildArea, buildCostTotal, buildCostPerM2Effective,
    softCostsTotal, buildInterest, targetProfit,
    idealBuyPrice, stampDuty, landLoan, landEquityDeposit,
    landInterest, buildEquityGap, minEquityRequired, equityPerInvestor,
    totalProjectCost, expectedProfit, expectedMarginOnGRV, roiOnEquity,
  }
}

// ─── Check a Deal ──────────────────────────────────────────────────────────────

export interface CheckDealInputs extends SharedInputs {
  purchasePrice: number          // land cost you paid / are paying
  salePricePerDwelling: number   // expected sale price per dwelling
}

export interface CheckDealResult {
  // Revenue
  totalGRV: number
  sellingCosts: number
  netSales: number
  // Build
  totalBuildArea: number
  buildCostTotal: number
  buildCostPerM2Effective: number
  // Costs breakdown
  stampDuty: number
  landLoan: number
  landEquityDeposit: number
  landInterest: number
  buildInterest: number
  buildEquityGap: number
  softCostsTotal: number
  // Totals
  totalProjectCost: number
  // Returns
  profit: number
  profitPerInvestor: number
  marginOnGRV: number
  roiOnEquity: number
  // Equity
  minEquityRequired: number
  equityPerInvestor: number
  // Context
  maxBuyPrice: number           // ideal buy price for reference
  vsMaxBuy: number              // purchase price vs max buy (negative = under max, good)
  dealRating: 'GREAT' | 'GOOD' | 'TIGHT' | 'LOSS'
}

export function checkDeal(inputs: CheckDealInputs): CheckDealResult {
  const {
    state, purchasePrice, salePricePerDwelling, numDwellings, sellingFeePercent,
    buildAreaPerDwelling, buildCostMode, buildCostPerM2, buildCostFlat,
    landLVR, landInterestRate, buildInterestRate, buildFundedPercent,
    buildTimeMonths, purchaseToSaleMonths,
    consultantsDA, demolitionSiteworks, legalAccounting,
    contingency, otherMisc, bankFees,
    numInvestors,
  } = inputs

  const totalBuildArea = buildAreaPerDwelling * numDwellings
  const buildCostTotal = buildCostMode === 'flat' ? buildCostFlat : totalBuildArea * buildCostPerM2
  const buildCostPerM2Effective = buildCostMode === 'flat' ? buildCostTotal / totalBuildArea : buildCostPerM2

  const totalGRV = salePricePerDwelling * numDwellings
  const sellingCosts = totalGRV * sellingFeePercent
  const netSales = totalGRV - sellingCosts

  const softCostsTotal = consultantsDA + demolitionSiteworks + legalAccounting + contingency + otherMisc + bankFees
  const stampDuty = calcStampDuty(purchasePrice, state)
  const landLoan = purchasePrice * landLVR
  const landEquityDeposit = purchasePrice * (1 - landLVR)
  const landInterest = landLoan * landInterestRate * (purchaseToSaleMonths / 12)
  const buildInterest = buildCostTotal * buildFundedPercent * buildInterestRate * (buildTimeMonths / 12) * 0.5
  const buildEquityGap = buildCostTotal * (1 - buildFundedPercent)

  const totalProjectCost = purchasePrice + stampDuty + buildCostTotal + softCostsTotal + buildInterest + landInterest + sellingCosts

  const profit = totalGRV - totalProjectCost
  const marginOnGRV = profit / totalGRV

  const minEquityRequired = landEquityDeposit + stampDuty + softCostsTotal + buildInterest + landInterest + buildEquityGap
  const equityPerInvestor = minEquityRequired / numInvestors
  const profitPerInvestor = profit / numInvestors
  const roiOnEquity = profit / minEquityRequired

  // Find the ideal max buy price for reference
  const maxBuyResult = calcMaxBuyPrice({ ...inputs, targetMarginOnGRV: 0.18 })
  const maxBuyPrice = maxBuyResult.idealBuyPrice
  const vsMaxBuy = purchasePrice - maxBuyPrice

  const dealRating: CheckDealResult['dealRating'] =
    marginOnGRV >= 0.20 ? 'GREAT' :
    marginOnGRV >= 0.15 ? 'GOOD' :
    marginOnGRV >= 0.08 ? 'TIGHT' : 'LOSS'

  return {
    totalGRV, sellingCosts, netSales,
    totalBuildArea, buildCostTotal, buildCostPerM2Effective,
    stampDuty, landLoan, landEquityDeposit, landInterest,
    buildInterest, buildEquityGap, softCostsTotal,
    totalProjectCost,
    profit, profitPerInvestor, marginOnGRV, roiOnEquity,
    minEquityRequired, equityPerInvestor,
    maxBuyPrice, vsMaxBuy, dealRating,
  }
}
