'use client'
import { useState, useCallback } from 'react'
import { calcMaxBuyPrice, checkDeal, FeasibilityInputs, FeasibilityResult, CheckDealResult } from '@/lib/feasibility'
import { formatCurrencyFull, formatPercent, formatNumber, cn } from '@/lib/utils'
import { State } from '@/lib/stamp-duty'
import { FileText, TrendingUp, DollarSign, Building2, Calculator } from 'lucide-react'

type Mode = 'max-buy' | 'check-deal'

const defaultInputs: FeasibilityInputs = {
  state: 'NSW',
  avgSalePrice: 2_000_000,
  numDwellings: 2,
  sellingFeePercent: 0.025,
  buildAreaPerDwelling: 250,
  buildCostPerM2: 3_500,
  landLVR: 0.65,
  landInterestRate: 0.0619,
  buildInterestRate: 0.09,
  buildFundedPercent: 0.80,
  buildTimeMonths: 18,
  purchaseToSaleMonths: 24,
  consultantsDA: 60_000,
  demolitionSiteworks: 50_000,
  legalAccounting: 10_000,
  contingency: 20_000,
  otherMisc: 50_000,
  bankFees: 5_000,
  targetMarginOnGRV: 0.18,
  numInvestors: 2,
}

function NumberInput({
  label, value, onChange, prefix, suffix, step, min, max, hint
}: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  step?: number
  min?: number
  max?: number
  hint?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
        {prefix && <span className="pl-3 text-gray-400 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step ?? 1}
          min={min ?? 0}
          max={max}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-gray-900"
        />
        {suffix && <span className="pr-3 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </div>
  )
}

function Row({ label, value, highlight, sub }: { label: string; value: string; highlight?: boolean; sub?: boolean }) {
  return (
    <div className={cn('flex justify-between items-center py-2 px-3 rounded-lg', highlight ? 'bg-blue-50' : sub ? '' : 'hover:bg-gray-50')}>
      <span className={cn('text-sm', highlight ? 'font-semibold text-blue-900' : sub ? 'text-xs text-gray-400 ml-4' : 'text-gray-600')}>{label}</span>
      <span className={cn('text-sm font-medium tabular-nums', highlight ? 'text-blue-900' : 'text-gray-900')}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default function FeasibilityPage() {
  const [mode, setMode] = useState<Mode>('max-buy')
  const [inputs, setInputs] = useState<FeasibilityInputs>(defaultInputs)
  const [offeredPrice, setOfferedPrice] = useState(1_200_000)
  const [result, setResult] = useState<FeasibilityResult | CheckDealResult | null>(null)
  const [saving, setSaving] = useState(false)

  const set = useCallback((key: keyof FeasibilityInputs, val: number | string) => {
    setInputs(prev => ({ ...prev, [key]: val }))
  }, [])

  const calculate = () => {
    if (mode === 'max-buy') {
      setResult(calcMaxBuyPrice(inputs))
    } else {
      setResult(checkDeal({ ...inputs, offeredPrice }))
    }
  }

  const isCheckDeal = (r: FeasibilityResult | CheckDealResult): r is CheckDealResult =>
    'offeredPrice' in r

  const savePDF = async () => {
    if (!result) return
    setSaving(true)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const lines: [string, string][] = []

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Property Feasibility Analysis', 15, 20)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Mode: ${mode === 'max-buy' ? 'Max Buy Price' : 'Check a Deal'}`, 15, 28)
    doc.text(`State: ${inputs.state}  |  Date: ${new Date().toLocaleDateString('en-AU')}`, 15, 34)

    let currentY = 34
    const addSection = (title: string, rows: [string, string][]) => {
      let y = currentY + 8
      currentY = y
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(title.toUpperCase(), 15, y)
      doc.setFont('helvetica', 'normal')
      rows.forEach(([label, value]) => {
        y += 6
        doc.text(label, 20, y)
        doc.text(value, 140, y, { align: 'right' })
      })
      currentY = y
    }

    addSection('Inputs', [
      ['Avg sale price / dwelling', formatCurrencyFull(inputs.avgSalePrice)],
      ['Number of dwellings', String(inputs.numDwellings)],
      ['Build area / dwelling', `${inputs.buildAreaPerDwelling} m²`],
      ['Build cost / m²', formatCurrencyFull(inputs.buildCostPerM2)],
      ['Target margin on GRV', formatPercent(inputs.targetMarginOnGRV)],
      ['Land LVR', formatPercent(inputs.landLVR)],
      ['Number of investors', String(inputs.numInvestors)],
    ])

    addSection('Revenue', [
      ['Total GRV', formatCurrencyFull(result.totalGRV)],
      ['Selling costs', formatCurrencyFull(result.sellingCosts)],
      ['Net sales', formatCurrencyFull(result.netSalesAfterSelling)],
    ])

    addSection('Costs', [
      ['Build cost', formatCurrencyFull(result.buildCost)],
      ['Soft costs', formatCurrencyFull(result.softCostsTotal)],
      ['Build interest', formatCurrencyFull(result.buildInterest)],
    ])

    addSection('Key Outputs', [
      ['Ideal max buy price', formatCurrencyFull(result.idealBuyPrice)],
      ['Stamp duty (on ideal)', formatCurrencyFull(result.stampDutyOnIdeal)],
      ['Min equity required', formatCurrencyFull(result.minEquityRequired)],
      ['Equity per investor', formatCurrencyFull(result.equityPerInvestor)],
      ['Expected profit', formatCurrencyFull(result.expectedProfit)],
      ['Expected margin', formatPercent(result.expectedMargin)],
    ])

    if (isCheckDeal(result)) {
      addSection('Deal Check', [
        ['Offered price', formatCurrencyFull(result.offeredPrice)],
        ['Profit at offered price', formatCurrencyFull(result.profitAtOffered)],
        ['Profit per investor', formatCurrencyFull(result.profitPerInvestor)],
        ['Margin at offered price', formatPercent(result.marginAtOffered)],
        ['ROI on equity', formatPercent(result.roiOnEquity)],
        ['Deal status', result.dealStatus],
      ])
    }

    doc.save(`feasibility-${new Date().toISOString().slice(0, 10)}.pdf`)
    setSaving(false)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Feasibility Calculator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Duplex / multi-dwelling development analysis</p>
        </div>
        {result && (
          <button
            onClick={savePDF}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <FileText size={15} />
            {saving ? 'Saving…' : 'Save PDF'}
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => { setMode('max-buy'); setResult(null) }}
          className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors', mode === 'max-buy' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}
        >
          Find Max Buy Price
        </button>
        <button
          onClick={() => { setMode('check-deal'); setResult(null) }}
          className={cn('px-4 py-2 rounded-md text-sm font-medium transition-colors', mode === 'check-deal' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}
        >
          Check a Deal
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          {/* State */}
          <Section title="State">
            <div className="flex gap-2">
              {(['NSW', 'QLD'] as State[]).map(s => (
                <button
                  key={s}
                  onClick={() => set('state', s)}
                  className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-colors', inputs.state === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300')}
                >
                  {s}
                </button>
              ))}
            </div>
          </Section>

          {/* Sale */}
          <Section title="Sale">
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Avg sale price / dwelling" value={inputs.avgSalePrice} onChange={v => set('avgSalePrice', v)} prefix="$" step={50000} />
              <NumberInput label="Number of dwellings" value={inputs.numDwellings} onChange={v => set('numDwellings', v)} min={1} />
              <NumberInput label="Selling fee" value={inputs.sellingFeePercent * 100} onChange={v => set('sellingFeePercent', v / 100)} suffix="%" step={0.1} />
            </div>
          </Section>

          {/* Build */}
          <Section title="Build">
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Build area / dwelling (m²)" value={inputs.buildAreaPerDwelling} onChange={v => set('buildAreaPerDwelling', v)} suffix="m²" step={10} />
              <NumberInput label="Build cost / m²" value={inputs.buildCostPerM2} onChange={v => set('buildCostPerM2', v)} prefix="$" step={100} />
              <NumberInput label="Build time" value={inputs.buildTimeMonths} onChange={v => set('buildTimeMonths', v)} suffix="mths" />
              <NumberInput label="Purchase to sale" value={inputs.purchaseToSaleMonths} onChange={v => set('purchaseToSaleMonths', v)} suffix="mths" />
            </div>
          </Section>

          {/* Finance */}
          <Section title="Finance">
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Land LVR" value={inputs.landLVR * 100} onChange={v => set('landLVR', v / 100)} suffix="%" step={1} max={90} />
              <NumberInput label="Land interest rate" value={inputs.landInterestRate * 100} onChange={v => set('landInterestRate', v / 100)} suffix="%" step={0.1} />
              <NumberInput label="Build interest rate" value={inputs.buildInterestRate * 100} onChange={v => set('buildInterestRate', v / 100)} suffix="%" step={0.1} />
              <NumberInput label="Build funded %" value={inputs.buildFundedPercent * 100} onChange={v => set('buildFundedPercent', v / 100)} suffix="%" step={5} />
            </div>
          </Section>

          {/* Soft costs */}
          <Section title="Soft Costs">
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Consultants / DA / certifier" value={inputs.consultantsDA} onChange={v => set('consultantsDA', v)} prefix="$" step={5000} />
              <NumberInput label="Demolition / siteworks" value={inputs.demolitionSiteworks} onChange={v => set('demolitionSiteworks', v)} prefix="$" step={5000} />
              <NumberInput label="Legal / accounting" value={inputs.legalAccounting} onChange={v => set('legalAccounting', v)} prefix="$" step={1000} />
              <NumberInput label="Contingency" value={inputs.contingency} onChange={v => set('contingency', v)} prefix="$" step={5000} />
              <NumberInput label="Other / misc" value={inputs.otherMisc} onChange={v => set('otherMisc', v)} prefix="$" step={5000} />
              <NumberInput label="Bank fees" value={inputs.bankFees} onChange={v => set('bankFees', v)} prefix="$" step={1000} />
            </div>
          </Section>

          {/* Target & investors */}
          <Section title="Target & Investors">
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Target margin on GRV" value={inputs.targetMarginOnGRV * 100} onChange={v => set('targetMarginOnGRV', v / 100)} suffix="%" step={0.5} hint="e.g. 18 = 18%" />
              <NumberInput label="Number of investors" value={inputs.numInvestors} onChange={v => set('numInvestors', Math.max(1, Math.round(v)))} min={1} />
            </div>
          </Section>

          {/* Offered price (check-deal mode only) */}
          {mode === 'check-deal' && (
            <Section title="Offered / Purchase Price">
              <NumberInput label="Price to check" value={offeredPrice} onChange={setOfferedPrice} prefix="$" step={10000} />
            </Section>
          )}

          <button
            onClick={calculate}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            {mode === 'max-buy' ? 'Calculate Max Buy Price' : 'Check This Deal'}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {!result && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
              <Calculator size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Enter your inputs and click calculate</p>
            </div>
          )}

          {result && (
            <>
              {/* Key number */}
              {mode === 'max-buy' ? (
                <div className="bg-blue-600 rounded-xl p-6 text-white">
                  <p className="text-sm opacity-80 mb-1">Max Buy Price</p>
                  <p className="text-4xl font-bold">{formatCurrencyFull(result.idealBuyPrice)}</p>
                  <div className="flex gap-6 mt-4 text-sm opacity-80">
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-70">Expected Profit</p>
                      <p className="font-semibold">{formatCurrencyFull(result.expectedProfit)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-70">Margin on GRV</p>
                      <p className="font-semibold">{formatPercent(result.expectedMargin)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-70">Equity / investor</p>
                      <p className="font-semibold">{formatCurrencyFull(result.equityPerInvestor)}</p>
                    </div>
                  </div>
                </div>
              ) : isCheckDeal(result) && (
                <div className={cn('rounded-xl p-6 text-white', result.dealStatus === 'GOOD' ? 'bg-green-600' : 'bg-red-500')}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm opacity-80">Deal Check — {formatCurrencyFull(result.offeredPrice)}</p>
                    <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">{result.dealStatus}</span>
                  </div>
                  <p className="text-4xl font-bold">{formatCurrencyFull(result.profitAtOffered)}</p>
                  <p className="text-sm opacity-70 mb-4">Profit at offered price</p>
                  <div className="flex gap-6 text-sm opacity-80">
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-70">Margin</p>
                      <p className="font-semibold">{formatPercent(result.marginAtOffered)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-70">ROI on Equity</p>
                      <p className="font-semibold">{formatPercent(result.roiOnEquity)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-70">Profit / investor</p>
                      <p className="font-semibold">{formatCurrencyFull(result.profitPerInvestor)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide opacity-70">vs Max Buy</p>
                      <p className="font-semibold">{result.priceVsIdeal > 0 ? '+' : ''}{formatCurrencyFull(result.priceVsIdeal)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Revenue */}
              <Section title="Revenue">
                <Row label="Total GRV" value={formatCurrencyFull(result.totalGRV)} />
                <Row label="Selling costs" value={`(${formatCurrencyFull(result.sellingCosts)})`} />
                <Row label="Net sales" value={formatCurrencyFull(result.netSalesAfterSelling)} highlight />
              </Section>

              {/* Build & costs */}
              <Section title="Build & Costs">
                <Row label={`Build — ${formatNumber(result.totalBuildArea)} m²`} value={formatCurrencyFull(result.buildCost)} />
                <Row label="Soft costs total" value={formatCurrencyFull(result.softCostsTotal)} />
                <Row label="Build interest" value={formatCurrencyFull(result.buildInterest)} />
                <Row label="Target profit" value={formatCurrencyFull(result.targetProfit)} />
              </Section>

              {/* Buy price breakdown */}
              <Section title="Buy Price Breakdown">
                <Row label="Ideal max buy price" value={formatCurrencyFull(result.idealBuyPrice)} highlight />
                <Row label="Stamp duty" value={formatCurrencyFull(result.stampDutyOnIdeal)} />
                <Row label="Land loan (LVR)" value={formatCurrencyFull(result.landLoanOnIdeal)} />
                <Row label="Land equity deposit" value={formatCurrencyFull(result.landEquityDeposit)} />
                <Row label="Land interest" value={formatCurrencyFull(result.landInterestOnIdeal)} />
                <Row label="Build equity gap" value={formatCurrencyFull(result.buildEquityGap)} />
              </Section>

              {/* Equity */}
              <Section title="Equity Required">
                <Row label="Min equity total" value={formatCurrencyFull(result.minEquityRequired)} highlight />
                <Row label={`Per investor (÷ ${inputs.numInvestors})`} value={formatCurrencyFull(result.equityPerInvestor)} />
                <Row label="Total project cost" value={formatCurrencyFull(result.totalProjectCost)} />
              </Section>

              {/* Deal check extras */}
              {isCheckDeal(result) && (
                <Section title="At Offered Price">
                  <Row label="Stamp duty" value={formatCurrencyFull(result.stampDutyOnOffered)} />
                  <Row label="Land loan" value={formatCurrencyFull(result.landLoanOnOffered)} />
                  <Row label="Land interest" value={formatCurrencyFull(result.landInterestOnOffered)} />
                  <Row label="Profit" value={formatCurrencyFull(result.profitAtOffered)} highlight />
                  <Row label={`Profit / investor (÷ ${inputs.numInvestors})`} value={formatCurrencyFull(result.profitPerInvestor)} />
                  <Row label="Margin on GRV" value={formatPercent(result.marginAtOffered)} />
                  <Row label="ROI on equity" value={formatPercent(result.roiOnEquity)} />
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
