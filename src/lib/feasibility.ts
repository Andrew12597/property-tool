import { calcStampDuty, State } from './stamp-duty'

export interface FeasibilityInputs {
  state: State
  // Sale
  avgSalePrice: number      // per dwelling
  numDwellings: number
  sellingFeePercent: number // e.g. 0.025
  // Build
  buildAreaPerDwelling: number  // m²
  buildCostPerM2: number
  // Finance
  landLVR: number          // e.g. 0.80
  landInterestRate: number // e.g. 0.0619
  buildInterestRate: number
  buildFundedPercent: number // e.g. 0.80
  buildTimeMonths: number
  purchaseToSaleMonths: number
  // Soft costs
  consultantsDA: number
  demolitionSiteworks: number
  legalAccounting: number
  contingency: number
  otherMisc: number
  bankFees: number
  // Target
  targetMarginOnGRV: number  // e.g. 0.14
  numInvestors: number
}

export interface FeasibilityResult {
  // Revenue
  totalGRV: number
  sellingCosts: number
  netSalesAfterSelling: number
  // Costs
  totalBuildArea: number
  buildCost: number
  softCostsTotal: number
  buildInterest: number
  targetProfit: number
  // Buy price outputs
  idealBuyPrice: number
  stampDutyOnIdeal: number
  landLoanOnIdeal: number
  landEquityDeposit: number
  landInterestOnIdeal: number
  buildEquityGap: number
  minEquityRequired: number
  equityPerInvestor: number
  totalProjectCost: number
  expectedProfit: number
  expectedMargin: number
}

export interface CheckDealInputs extends FeasibilityInputs {
  offeredPrice: number
}

export interface CheckDealResult extends FeasibilityResult {
  offeredPrice: number
  stampDutyOnOffered: number
  landLoanOnOffered: number
  landInterestOnOffered: number
  profitAtOffered: number
  profitPerInvestor: number
  marginAtOffered: number
  roiOnEquity: number
  dealStatus: 'GOOD' | 'OVER MAX'
  priceVsIdeal: number
}

export function calcMaxBuyPrice(inputs: FeasibilityInputs): FeasibilityResult {
  const {
    state, avgSalePrice, numDwellings, sellingFeePercent,
    buildAreaPerDwelling, buildCostPerM2,
    landLVR, landInterestRate, buildInterestRate, buildFundedPercent,
    buildTimeMonths, purchaseToSaleMonths,
    consultantsDA, demolitionSiteworks, legalAccounting,
    contingency, otherMisc, bankFees,
    targetMarginOnGRV, numInvestors,
  } = inputs

  const totalGRV = avgSalePrice * numDwellings
  const sellingCosts = totalGRV * sellingFeePercent
  const netSalesAfterSelling = totalGRV - sellingCosts
  const totalBuildArea = buildAreaPerDwelling * numDwellings
  const buildCost = totalBuildArea * buildCostPerM2
  const softCostsTotal = consultantsDA + demolitionSiteworks + legalAccounting + contingency + otherMisc + bankFees
  // Build interest approximation: funded portion × rate × (buildTime/12) × 0.5 draw assumption
  const buildInterest = buildCost * buildFundedPercent * buildInterestRate * (buildTimeMonths / 12) * 0.5
  const targetProfit = totalGRV * targetMarginOnGRV

  // Search for ideal buy price in $500 increments
  let idealBuyPrice = 500
  for (let candidate = 500; candidate <= 50_000_000; candidate += 500) {
    const stampDuty = calcStampDuty(candidate, state)
    const landLoan = candidate * landLVR
    const landInterest = landLoan * landInterestRate * (purchaseToSaleMonths / 12)
    const buildEquityGap = buildCost * (1 - buildFundedPercent)
    const totalCosts = candidate + stampDuty + softCostsTotal + buildCost + buildInterest + landInterest + sellingCosts + targetProfit - buildCost * buildFundedPercent
    const residual = netSalesAfterSelling - totalCosts + buildCost * buildFundedPercent - buildCost
    // Feasible if total project cost + target profit ≤ net sales
    const totalProjectCost = candidate + stampDuty + buildCost + softCostsTotal + buildInterest + landInterest + sellingCosts
    if (totalProjectCost + targetProfit <= totalGRV) {
      idealBuyPrice = candidate
    } else {
      break
    }
  }

  const stampDutyOnIdeal = calcStampDuty(idealBuyPrice, state)
  const landLoanOnIdeal = idealBuyPrice * landLVR
  const landEquityDeposit = idealBuyPrice * (1 - landLVR)
  const landInterestOnIdeal = landLoanOnIdeal * landInterestRate * (purchaseToSaleMonths / 12)
  const buildEquityGap = buildCost * (1 - buildFundedPercent)
  const minEquityRequired = landEquityDeposit + stampDutyOnIdeal + bankFees + softCostsTotal - bankFees + buildInterest + landInterestOnIdeal + buildEquityGap
  const equityPerInvestor = minEquityRequired / numInvestors
  const totalProjectCost = idealBuyPrice + stampDutyOnIdeal + buildCost + softCostsTotal + buildInterest + landInterestOnIdeal + sellingCosts
  const expectedProfit = totalGRV - totalProjectCost
  const expectedMargin = expectedProfit / totalGRV

  return {
    totalGRV, sellingCosts, netSalesAfterSelling,
    totalBuildArea, buildCost, softCostsTotal, buildInterest, targetProfit,
    idealBuyPrice, stampDutyOnIdeal, landLoanOnIdeal, landEquityDeposit,
    landInterestOnIdeal, buildEquityGap, minEquityRequired, equityPerInvestor,
    totalProjectCost, expectedProfit, expectedMargin,
  }
}

export function checkDeal(inputs: CheckDealInputs): CheckDealResult {
  const base = calcMaxBuyPrice(inputs)
  const { offeredPrice, state, landLVR, landInterestRate, purchaseToSaleMonths, numInvestors } = inputs
  const { totalGRV } = base

  const stampDutyOnOffered = calcStampDuty(offeredPrice, state)
  const landLoanOnOffered = offeredPrice * landLVR
  const landInterestOnOffered = landLoanOnOffered * landInterestRate * (purchaseToSaleMonths / 12)

  const totalProjectCostAtOffer = offeredPrice + stampDutyOnOffered + base.buildCost + base.softCostsTotal + base.buildInterest + landInterestOnOffered + base.sellingCosts
  const profitAtOffered = totalGRV - totalProjectCostAtOffer
  const profitPerInvestor = profitAtOffered / numInvestors
  const marginAtOffered = profitAtOffered / totalGRV

  // ROI on equity: profit / min equity required
  const landEquityOffered = offeredPrice * (1 - landLVR)
  const minEquityOffered = landEquityOffered + stampDutyOnOffered + base.softCostsTotal + base.buildInterest + landInterestOnOffered + base.buildEquityGap
  const roiOnEquity = profitAtOffered / minEquityOffered

  return {
    ...base,
    offeredPrice,
    stampDutyOnOffered,
    landLoanOnOffered,
    landInterestOnOffered,
    profitAtOffered,
    profitPerInvestor,
    marginAtOffered,
    roiOnEquity,
    dealStatus: offeredPrice <= base.idealBuyPrice ? 'GOOD' : 'OVER MAX',
    priceVsIdeal: offeredPrice - base.idealBuyPrice,
  }
}
