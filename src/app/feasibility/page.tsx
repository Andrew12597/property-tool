'use client'
import { useState, useCallback } from 'react'
import {
  calcMaxBuyPrice, checkDeal,
  MaxBuyInputs, MaxBuyResult,
  CheckDealInputs, CheckDealResult,
} from '@/lib/feasibility'
import { formatCurrencyFull, formatPercent, formatNumber, cn } from '@/lib/utils'
import { State } from '@/lib/stamp-duty'
import { FileText, Calculator, ToggleLeft, ToggleRight, TrendingUp, ArrowUpDown, ChevronDown, ChevronUp, Save, Check } from 'lucide-react'

type Mode = 'max-buy' | 'check-deal'

const sharedDefaults = {
  state: 'NSW' as State,
  numDwellings: 2,
  sellingFeePercent: 0.025,
  buildCostMode: 'per-m2' as 'per-m2' | 'flat',
  buildAreaPerDwelling: 250,
  buildCostPerM2: 3_500,
  buildCostFlat: 1_750_000,
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
  numInvestors: 2,
}

const maxBuyDefaults: MaxBuyInputs = { ...sharedDefaults, salePricePerDwelling: 2_000_000, targetMarginOnGRV: 0.18 }
const checkDealDefaults: CheckDealInputs = { ...sharedDefaults, purchasePrice: 1_200_000, salePricePerDwelling: 2_200_000 }

// ─── Sub-components ─────────────────────────────────────────────────────────

function Inp({
  label, value, onChange, prefix, suffix, step, min, max, hint
}: {
  label: string; value: number; onChange: (v: number) => void
  prefix?: string; suffix?: string; step?: number; min?: number; max?: number; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 mb-1">{hint}</p>}
      <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
        {prefix && <span className="pl-3 text-gray-400 text-sm select-none">{prefix}</span>}
        <input
          type="number" value={value} step={step ?? 1} min={min ?? 0} max={max}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          onFocus={e => e.target.select()}
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-gray-900 tabular-nums"
        />
        {suffix && <span className="pr-3 text-gray-400 text-sm select-none">{suffix}</span>}
      </div>
    </div>
  )
}

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn('rounded-xl p-4 border', accent ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200')}>
      <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-3', accent ? 'text-blue-600' : 'text-gray-400')}>{title}</p>
      {children}
    </div>
  )
}

function ResultRow({ label, value, sub, bold, indent, formula }: { label: string; value: string; sub?: boolean; bold?: boolean; indent?: boolean; formula?: string }) {
  return (
    <div className={cn('py-1.5', !sub && 'border-b border-gray-100 last:border-0')}>
      <div className="flex justify-between items-baseline">
        <span className={cn('text-sm', sub ? 'text-xs text-gray-400' : 'text-gray-600', indent && 'ml-3', bold && 'font-semibold text-gray-800')}>{label}</span>
        <span className={cn('text-sm tabular-nums font-medium', sub ? 'text-xs text-gray-400' : 'text-gray-900', bold && 'font-bold')}>{value}</span>
      </div>
      {formula && <p className={cn('text-[11px] text-gray-400 mt-0.5 font-mono', indent && 'ml-3')}>{formula}</p>}
    </div>
  )
}

function BigStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={cn('rounded-xl p-4 text-white', color)}>
      <p className="text-xs opacity-70 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionToggle({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>}
    </div>
  )
}

// ─── Build Cost Toggle (must be outside page component to avoid focus loss) ──

function BuildCostToggle({ inputs, set, bc }: {
  inputs: MaxBuyInputs | CheckDealInputs
  set: (k: any, v: any) => void
  bc: { flat: number; perM2: number }
}) {
  return (
    <>
      <div className="col-span-2">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-medium text-gray-500">Build cost as</span>
          <button
            onClick={() => set('buildCostMode', inputs.buildCostMode === 'per-m2' ? 'flat' : 'per-m2')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium text-gray-700"
          >
            <ArrowUpDown size={12} />
            {inputs.buildCostMode === 'per-m2' ? '$/m² mode' : 'Flat total mode'}
          </button>
          <span className="text-xs text-gray-400">
            {inputs.buildCostMode === 'per-m2'
              ? `= ${formatCurrencyFull(bc.flat)} total`
              : `= $${formatNumber(bc.perM2)}/m²`}
          </span>
        </div>
      </div>
      <Inp label="Build area / dwelling" value={inputs.buildAreaPerDwelling} onChange={v => set('buildAreaPerDwelling', v)} suffix="m²" step={10} />
      {inputs.buildCostMode === 'per-m2'
        ? <Inp label="Build cost / m²" value={inputs.buildCostPerM2} onChange={v => set('buildCostPerM2', v)} prefix="$" step={100} />
        : <Inp label="Total build cost" value={inputs.buildCostFlat} onChange={v => set('buildCostFlat', v)} prefix="$" step={10_000} />
      }
    </>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FeasibilityPage() {
  const [mode, setMode] = useState<Mode>('max-buy')
  const [mb, setMb] = useState<MaxBuyInputs>(maxBuyDefaults)
  const [cd, setCd] = useState<CheckDealInputs>(checkDealDefaults)
  const [mbResult, setMbResult] = useState<MaxBuyResult | null>(null)
  const [cdResult, setCdResult] = useState<CheckDealResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveModal, setSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  const setM = useCallback(<K extends keyof MaxBuyInputs>(k: K, v: MaxBuyInputs[K]) => setMb(p => ({ ...p, [k]: v })), [])
  const setC = useCallback(<K extends keyof CheckDealInputs>(k: K, v: CheckDealInputs[K]) => setCd(p => ({ ...p, [k]: v })), [])

  const calculate = () => {
    if (mode === 'max-buy') setMbResult(calcMaxBuyPrice(mb))
    else setCdResult(checkDeal(cd))
  }

  const saveAnalysis = async () => {
    if (!saveName.trim() || !result) return
    setSaveLoading(true)
    await fetch('/api/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: saveName.trim(),
        mode,
        inputs: mode === 'max-buy' ? mb : cd,
        result,
      }),
    })
    setSaveLoading(false)
    setSaveModal(false)
    setSaveName('')
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 3000)
  }

  const buildCostDisplay = (inputs: typeof mb | typeof cd) => {
    const area = inputs.buildAreaPerDwelling * inputs.numDwellings
    if (inputs.buildCostMode === 'per-m2') {
      return { flat: area * inputs.buildCostPerM2, perM2: inputs.buildCostPerM2 }
    }
    return { flat: inputs.buildCostFlat, perM2: area > 0 ? inputs.buildCostFlat / area : 0 }
  }

  const savePDF = async () => {
    const result = mode === 'max-buy' ? mbResult : cdResult
    if (!result) return
    setSaving(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      let y = 20

      const addLine = (label: string, value: string, bold = false) => {
        if (bold) doc.setFont('helvetica', 'bold')
        else doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(label, 15, y)
        doc.text(value, 175, y, { align: 'right' })
        y += 6
      }
      const addHeading = (t: string) => {
        y += 4
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(t.toUpperCase(), 15, y)
        doc.setTextColor(0, 0, 0)
        y += 6
      }

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(`Property Feasibility — ${mode === 'max-buy' ? 'Max Buy Price' : 'Deal Check'}`, 15, y)
      y += 8
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`${mode === 'check-deal' ? 'Purchase price: ' + formatCurrencyFull((cd as CheckDealInputs).purchasePrice) + '  ·  ' : ''}State: ${mode === 'max-buy' ? mb.state : cd.state}  ·  ${new Date().toLocaleDateString('en-AU')}`, 15, y)
      y += 10

      if (mode === 'max-buy' && mbResult) {
        addHeading('Revenue')
        addLine('Total GRV', formatCurrencyFull(mbResult.totalGRV))
        addLine('Selling costs', `(${formatCurrencyFull(mbResult.sellingCosts)})`)
        addLine('Net sales', formatCurrencyFull(mbResult.netSales), true)
        addHeading('Costs')
        addLine(`Build (${formatNumber(mbResult.totalBuildArea)} m²)`, formatCurrencyFull(mbResult.buildCostTotal))
        addLine('Soft costs', formatCurrencyFull(mbResult.softCostsTotal))
        addLine('Build interest', formatCurrencyFull(mbResult.buildInterest))
        addLine('Target profit', formatCurrencyFull(mbResult.targetProfit))
        addHeading('Result')
        addLine('Ideal max buy price', formatCurrencyFull(mbResult.idealBuyPrice), true)
        addLine('Stamp duty', formatCurrencyFull(mbResult.stampDuty))
        addLine('Min equity required', formatCurrencyFull(mbResult.minEquityRequired))
        addLine(`Equity per investor (÷${mb.numInvestors})`, formatCurrencyFull(mbResult.equityPerInvestor))
        addLine('Expected profit', formatCurrencyFull(mbResult.expectedProfit), true)
        addLine('Margin on GRV', formatPercent(mbResult.expectedMarginOnGRV))
        addLine('ROI on equity', formatPercent(mbResult.roiOnEquity))
      } else if (mode === 'check-deal' && cdResult) {
        addHeading('Revenue')
        addLine('Total GRV', formatCurrencyFull(cdResult.totalGRV))
        addLine('Selling costs', `(${formatCurrencyFull(cdResult.sellingCosts)})`)
        addLine('Net sales', formatCurrencyFull(cdResult.netSales), true)
        addHeading('All Costs')
        addLine('Purchase price (land)', formatCurrencyFull(cd.purchasePrice))
        addLine('Stamp duty', formatCurrencyFull(cdResult.stampDuty))
        addLine(`Build (${formatNumber(cdResult.totalBuildArea)} m² @ $${formatNumber(cdResult.buildCostPerM2Effective)}/m²)`, formatCurrencyFull(cdResult.buildCostTotal))
        addLine('Soft costs', formatCurrencyFull(cdResult.softCostsTotal))
        addLine('Land interest', formatCurrencyFull(cdResult.landInterest))
        addLine('Build interest', formatCurrencyFull(cdResult.buildInterest))
        addLine('Total project cost', formatCurrencyFull(cdResult.totalProjectCost), true)
        addHeading('Returns')
        addLine('Profit', formatCurrencyFull(cdResult.profit), true)
        addLine(`Profit per investor (÷${cd.numInvestors})`, formatCurrencyFull(cdResult.profitPerInvestor))
        addLine('Margin on GRV', formatPercent(cdResult.marginOnGRV))
        addLine('ROI on equity', formatPercent(cdResult.roiOnEquity))
        addLine('Min equity required', formatCurrencyFull(cdResult.minEquityRequired))
        addLine(`Equity per investor`, formatCurrencyFull(cdResult.equityPerInvestor))
        addLine('Max buy price (18% margin ref)', formatCurrencyFull(cdResult.maxBuyPrice))
        addLine('Purchase vs max buy', `${cdResult.vsMaxBuy >= 0 ? '+' : ''}${formatCurrencyFull(cdResult.vsMaxBuy)}`)
      }

      doc.save(`feasibility-${mode}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setSaving(false)
    }
  }

  const result = mode === 'max-buy' ? mbResult : cdResult
  const inputs = mode === 'max-buy' ? mb : cd
  const bc = buildCostDisplay(inputs)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Feasibility Calculator</h1>
          <p className="text-sm text-gray-400 mt-0.5">Duplex / multi-dwelling development</p>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            {savedOk && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check size={13} /> Saved!
              </span>
            )}
            <button
              onClick={() => setSaveModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Save size={14} /> Save
            </button>
            <button onClick={savePDF} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
              <FileText size={14} />
              <span className="hidden sm:inline">{saving ? 'Saving…' : 'Export PDF'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-full sm:w-fit">
        {([['max-buy', 'Find Max Buy Price', '→ what should I pay?'], ['check-deal', 'Check a Deal', '→ what will I make?']] as const).map(([m, label, hint]) => (
          <button key={m} onClick={() => setMode(m)} className={cn('flex-1 sm:flex-none px-3 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all text-left', mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {label}
            <span className={cn('block text-[11px] mt-0.5 text-gray-400')}>{hint}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        {/* ── Inputs ── */}
        <div className="space-y-3">

          {/* State */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">State</span>
            <div className="flex gap-2">
              {(['NSW', 'QLD'] as State[]).map(s => (
                <button key={s} onClick={() => mode === 'max-buy' ? setM('state', s) : setC('state', s)}
                  className={cn('px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors', inputs.state === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300')}>{s}</button>
              ))}
            </div>
          </div>

          {/* Max Buy mode inputs */}
          {mode === 'max-buy' && (
            <>
              <SectionToggle title="Sale">
                <Inp label="Expected sale price / dwelling" value={mb.salePricePerDwelling} onChange={v => setM('salePricePerDwelling', v)} prefix="$" step={25_000} />
                <Inp label="Number of dwellings" value={mb.numDwellings} onChange={v => setM('numDwellings', Math.max(1, Math.round(v)))} min={1} />
                <Inp label="Selling fee" value={mb.sellingFeePercent * 100} onChange={v => setM('sellingFeePercent', v / 100)} suffix="%" step={0.1} />
                <Inp label="Target margin on GRV" value={mb.targetMarginOnGRV * 100} onChange={v => setM('targetMarginOnGRV', v / 100)} suffix="%" step={0.5} hint="e.g. 18 = 18%" />
              </SectionToggle>

              <SectionToggle title="Build">
                <BuildCostToggle inputs={mb} set={setM} bc={buildCostDisplay(mb)} />
                <Inp label="Build time" value={mb.buildTimeMonths} onChange={v => setM('buildTimeMonths', v)} suffix="mths" />
                <Inp label="Purchase to settlement" value={mb.purchaseToSaleMonths} onChange={v => setM('purchaseToSaleMonths', v)} suffix="mths" />
              </SectionToggle>
            </>
          )}

          {/* Check Deal mode inputs */}
          {mode === 'check-deal' && (
            <>
              <SectionToggle title="The Deal">
                <Inp label="Purchase price (land)" value={cd.purchasePrice} onChange={v => setC('purchasePrice', v)} prefix="$" step={25_000} />
                <Inp label="Expected sale price / dwelling" value={cd.salePricePerDwelling} onChange={v => setC('salePricePerDwelling', v)} prefix="$" step={25_000} />
                <Inp label="Number of dwellings" value={cd.numDwellings} onChange={v => setC('numDwellings', Math.max(1, Math.round(v)))} min={1} />
                <Inp label="Selling fee" value={cd.sellingFeePercent * 100} onChange={v => setC('sellingFeePercent', v / 100)} suffix="%" step={0.1} />
              </SectionToggle>

              <SectionToggle title="Build">
                <BuildCostToggle inputs={cd} set={setC} bc={buildCostDisplay(cd)} />
                <Inp label="Build time" value={cd.buildTimeMonths} onChange={v => setC('buildTimeMonths', v)} suffix="mths" />
                <Inp label="Purchase to settlement" value={cd.purchaseToSaleMonths} onChange={v => setC('purchaseToSaleMonths', v)} suffix="mths" />
              </SectionToggle>
            </>
          )}

          {/* Finance — shared */}
          <SectionToggle title="Finance">
            <Inp label="Land LVR" value={inputs.landLVR * 100} onChange={v => mode === 'max-buy' ? setM('landLVR', v / 100) : setC('landLVR', v / 100)} suffix="%" step={1} max={90} />
            <Inp label="Land interest rate" value={inputs.landInterestRate * 100} onChange={v => mode === 'max-buy' ? setM('landInterestRate', v / 100) : setC('landInterestRate', v / 100)} suffix="%" step={0.1} />
            <Inp label="Build interest rate" value={inputs.buildInterestRate * 100} onChange={v => mode === 'max-buy' ? setM('buildInterestRate', v / 100) : setC('buildInterestRate', v / 100)} suffix="%" step={0.1} />
            <Inp label="Build funded by bank" value={inputs.buildFundedPercent * 100} onChange={v => mode === 'max-buy' ? setM('buildFundedPercent', v / 100) : setC('buildFundedPercent', v / 100)} suffix="%" step={5} />
          </SectionToggle>

          {/* Soft costs — shared */}
          <SectionToggle title="Soft Costs">
            <Inp label="Consultants / DA / certifier" value={inputs.consultantsDA} onChange={v => mode === 'max-buy' ? setM('consultantsDA', v) : setC('consultantsDA', v)} prefix="$" step={5_000} />
            <Inp label="Demolition / siteworks" value={inputs.demolitionSiteworks} onChange={v => mode === 'max-buy' ? setM('demolitionSiteworks', v) : setC('demolitionSiteworks', v)} prefix="$" step={5_000} />
            <Inp label="Legal / accounting" value={inputs.legalAccounting} onChange={v => mode === 'max-buy' ? setM('legalAccounting', v) : setC('legalAccounting', v)} prefix="$" step={1_000} />
            <Inp label="Contingency" value={inputs.contingency} onChange={v => mode === 'max-buy' ? setM('contingency', v) : setC('contingency', v)} prefix="$" step={5_000} />
            <Inp label="Other / misc" value={inputs.otherMisc} onChange={v => mode === 'max-buy' ? setM('otherMisc', v) : setC('otherMisc', v)} prefix="$" step={5_000} />
            <Inp label="Bank fees" value={inputs.bankFees} onChange={v => mode === 'max-buy' ? setM('bankFees', v) : setC('bankFees', v)} prefix="$" step={1_000} />
          </SectionToggle>

          {/* Investors */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 shrink-0">Investors</span>
            <Inp label="" value={inputs.numInvestors} onChange={v => mode === 'max-buy' ? setM('numInvestors', Math.max(1, Math.round(v))) : setC('numInvestors', Math.max(1, Math.round(v)))} min={1} />
          </div>

          <button onClick={calculate} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm">
            {mode === 'max-buy' ? 'Calculate Max Buy Price →' : 'Calculate Returns →'}
          </button>
        </div>

        {/* ── Results ── */}
        <div className="space-y-4">
          {!result && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Calculator size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Fill in the inputs and click calculate</p>
            </div>
          )}

          {/* MAX BUY RESULTS */}
          {mode === 'max-buy' && mbResult && (
            <>
              {/* Hero */}
              <div className="bg-blue-600 rounded-xl p-5 text-white">
                <p className="text-xs opacity-70 uppercase tracking-widest mb-1">Max you should pay for land</p>
                <p className="text-4xl font-bold mb-4">{formatCurrencyFull(mbResult.idealBuyPrice)}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-[10px] opacity-70 uppercase tracking-wide">Expected Profit</p>
                    <p className="font-bold text-lg">{formatCurrencyFull(mbResult.expectedProfit)}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-[10px] opacity-70 uppercase tracking-wide">Margin on GRV</p>
                    <p className="font-bold text-lg">{formatPercent(mbResult.expectedMarginOnGRV)}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-[10px] opacity-70 uppercase tracking-wide">ROI on Equity</p>
                    <p className="font-bold text-lg">{formatPercent(mbResult.roiOnEquity)}</p>
                  </div>
                </div>
              </div>

              {/* Revenue */}
              <Card title="Revenue (GRV — Gross Realisable Value)">
                <ResultRow
                  label={`Sale price × ${mb.numDwellings} dwellings`}
                  value={formatCurrencyFull(mbResult.totalGRV)}
                  formula={`$${formatNumber(mb.salePricePerDwelling)} × ${mb.numDwellings}`}
                />
                <ResultRow
                  label="Less: selling costs (agent commission)"
                  value={`(${formatCurrencyFull(mbResult.sellingCosts)})`}
                  indent
                  formula={`GRV × ${formatPercent(mb.sellingFeePercent)}`}
                />
                <ResultRow label="Net sales proceeds" value={formatCurrencyFull(mbResult.netSales)} bold formula="GRV − selling costs" />
              </Card>

              {/* Costs */}
              <Card title="Development Costs">
                <ResultRow
                  label={`Build — ${formatNumber(mbResult.totalBuildArea)} m² @ $${formatNumber(mbResult.buildCostPerM2Effective)}/m²`}
                  value={formatCurrencyFull(mbResult.buildCostTotal)}
                  formula={`${formatNumber(mbResult.totalBuildArea)} m² × $${formatNumber(mbResult.buildCostPerM2Effective)}/m²`}
                />
                <ResultRow
                  label="Soft costs (DA, demolition, legal, contingency…)"
                  value={formatCurrencyFull(mbResult.softCostsTotal)}
                  formula="Sum of all soft cost inputs"
                />
                <ResultRow
                  label="Build interest"
                  value={formatCurrencyFull(mbResult.buildInterest)}
                  formula={`Build × ${formatPercent(mb.buildFundedPercent)} bank-funded × ${formatPercent(mb.buildInterestRate)} × ${mb.buildTimeMonths} mths ÷ 12 × 0.5 (half-draw — staged drawdown avg)`}
                />
                <ResultRow
                  label="Target developer profit"
                  value={formatCurrencyFull(mbResult.targetProfit)}
                  formula={`GRV × ${formatPercent(mb.targetMarginOnGRV)} target margin`}
                />
              </Card>

              {/* Land & finance at ideal price */}
              <Card title="At the Ideal Buy Price">
                <ResultRow label="Land purchase price" value={formatCurrencyFull(mbResult.idealBuyPrice)} bold formula="Solved by stepping $500 at a time until margin target is met" />
                <ResultRow
                  label="Stamp duty"
                  value={formatCurrencyFull(mbResult.stampDuty)}
                  indent
                  formula={`${mb.state} transfer duty on $${formatNumber(mbResult.idealBuyPrice)} — Revenue ${mb.state} rate schedule`}
                />
                <ResultRow
                  label={`Land loan (${formatPercent(mb.landLVR)} LVR)`}
                  value={formatCurrencyFull(mbResult.landLoan)}
                  indent
                  formula={`Land price × ${formatPercent(mb.landLVR)}`}
                />
                <ResultRow
                  label="Land equity deposit (your cash)"
                  value={formatCurrencyFull(mbResult.landEquityDeposit)}
                  indent
                  formula={`Land price × ${formatPercent(1 - mb.landLVR)} (the ${formatPercent(1 - mb.landLVR)} the bank won't lend)`}
                />
                <ResultRow
                  label="Land interest"
                  value={formatCurrencyFull(mbResult.landInterest)}
                  indent
                  formula={`Land loan × ${formatPercent(mb.landInterestRate)} × ${mb.purchaseToSaleMonths} mths ÷ 12 (interest-only, full hold period)`}
                />
                <ResultRow
                  label={`Build equity gap (${formatPercent(1 - mb.buildFundedPercent)} the bank won't fund)`}
                  value={formatCurrencyFull(mbResult.buildEquityGap)}
                  indent
                  formula={`Build cost × ${formatPercent(1 - mb.buildFundedPercent)} unfunded portion`}
                />
              </Card>

              {/* Equity */}
              <Card title="Equity Required (Cash In)" accent>
                <ResultRow label="Land equity deposit" value={formatCurrencyFull(mbResult.landEquityDeposit)} formula={`Land price × ${formatPercent(1 - mb.landLVR)}`} />
                <ResultRow label="+ Stamp duty" value={formatCurrencyFull(mbResult.stampDuty)} formula="Included — must be paid at settlement, cannot be borrowed" indent />
                <ResultRow label="+ Soft costs" value={formatCurrencyFull(mbResult.softCostsTotal)} formula="DA, demolition, legal, contingency, bank fees" indent />
                <ResultRow label="+ Land interest" value={formatCurrencyFull(mbResult.landInterest)} formula="Paid from equity — no capitalisation assumed" indent />
                <ResultRow label="+ Build interest" value={formatCurrencyFull(mbResult.buildInterest)} formula="Paid from equity — no capitalisation assumed" indent />
                <ResultRow label="+ Build equity gap" value={formatCurrencyFull(mbResult.buildEquityGap)} formula={`Unfunded ${formatPercent(1 - mb.buildFundedPercent)} of build cost`} indent />
                <ResultRow label="= Total equity needed" value={formatCurrencyFull(mbResult.minEquityRequired)} bold formula="Sum of all items above" />
                <ResultRow label={`Per investor (÷ ${mb.numInvestors})`} value={formatCurrencyFull(mbResult.equityPerInvestor)} indent formula={`Total equity ÷ ${mb.numInvestors} investors`} />
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <ResultRow label="Total project cost (all costs inc. land)" value={formatCurrencyFull(mbResult.totalProjectCost)} formula="Land + stamp duty + build + soft costs + both interest costs + selling costs" />
                  <ResultRow label="Expected profit" value={formatCurrencyFull(mbResult.expectedProfit)} formula="GRV − total project cost" />
                  <ResultRow label="ROI on equity" value={formatPercent(mbResult.roiOnEquity)} formula="Profit ÷ total equity required" />
                </div>
              </Card>
            </>
          )}

          {/* CHECK DEAL RESULTS */}
          {mode === 'check-deal' && cdResult && (
            <>
              {/* Deal rating hero */}
              <div className={cn('rounded-xl p-5 text-white', {
                'GREAT': 'bg-green-600',
                'GOOD': 'bg-blue-600',
                'TIGHT': 'bg-orange-500',
                'LOSS': 'bg-red-600',
              }[cdResult.dealRating])}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs opacity-70 uppercase tracking-widest">Deal at {formatCurrencyFull(cd.purchasePrice)}</p>
                    <p className="text-4xl font-bold mt-1">{formatCurrencyFull(cdResult.profit)}</p>
                    <p className="text-sm opacity-70 mt-0.5">Profit</p>
                  </div>
                  <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                    <p className="text-xs opacity-80">Rating</p>
                    <p className="text-xl font-bold">{cdResult.dealRating}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Margin on GRV', value: formatPercent(cdResult.marginOnGRV) },
                    { label: 'ROI on Equity', value: formatPercent(cdResult.roiOnEquity) },
                    { label: `Profit / investor`, value: formatCurrencyFull(cdResult.profitPerInvestor) },
                    { label: 'vs Max Buy', value: `${cdResult.vsMaxBuy >= 0 ? '+' : ''}${formatCurrencyFull(cdResult.vsMaxBuy)}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/10 rounded-lg p-2.5">
                      <p className="text-[10px] opacity-70 uppercase tracking-wide leading-tight">{label}</p>
                      <p className="font-bold text-sm mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue */}
              <Card title="Revenue (GRV — Gross Realisable Value)">
                <ResultRow
                  label={`${formatCurrencyFull(cd.salePricePerDwelling)} × ${cd.numDwellings} dwellings`}
                  value={formatCurrencyFull(cdResult.totalGRV)}
                  formula={`$${formatNumber(cd.salePricePerDwelling)} × ${cd.numDwellings}`}
                />
                <ResultRow
                  label={`Less: selling costs (agent commission)`}
                  value={`(${formatCurrencyFull(cdResult.sellingCosts)})`}
                  indent
                  formula={`GRV × ${formatPercent(cd.sellingFeePercent)}`}
                />
                <ResultRow label="Net sales proceeds" value={formatCurrencyFull(cdResult.netSales)} bold formula="GRV − selling costs" />
              </Card>

              {/* Full cost waterfall */}
              <Card title="All Costs (Waterfall)">
                <ResultRow label="Land purchase price" value={formatCurrencyFull(cd.purchasePrice)} formula="Your input — the agreed land price" />
                <ResultRow
                  label={`Stamp duty (${cd.state} transfer duty)`}
                  value={formatCurrencyFull(cdResult.stampDuty)}
                  indent
                  formula={`Revenue ${cd.state} rate schedule on $${formatNumber(cd.purchasePrice)}`}
                />
                <ResultRow
                  label={`Build — ${formatNumber(cdResult.totalBuildArea)} m² @ $${formatNumber(cdResult.buildCostPerM2Effective)}/m²`}
                  value={formatCurrencyFull(cdResult.buildCostTotal)}
                  formula={`${formatNumber(cdResult.totalBuildArea)} m² × $${formatNumber(cdResult.buildCostPerM2Effective)}/m²`}
                />
                <ResultRow
                  label="Soft costs (DA, demo, legal, contingency…)"
                  value={formatCurrencyFull(cdResult.softCostsTotal)}
                  formula="Sum of all soft cost inputs"
                />
                <ResultRow
                  label="Land interest"
                  value={formatCurrencyFull(cdResult.landInterest)}
                  indent
                  formula={`Land loan × ${formatPercent(cd.landInterestRate)} × ${cd.purchaseToSaleMonths} mths ÷ 12 (interest-only, full hold period)`}
                />
                <ResultRow
                  label="Build interest"
                  value={formatCurrencyFull(cdResult.buildInterest)}
                  indent
                  formula={`Build × ${formatPercent(cd.buildFundedPercent)} bank-funded × ${formatPercent(cd.buildInterestRate)} × ${cd.buildTimeMonths} mths ÷ 12 × 0.5 (half-draw — staged drawdown avg)`}
                />
                <ResultRow
                  label="Selling costs"
                  value={formatCurrencyFull(cdResult.sellingCosts)}
                  formula={`GRV × ${formatPercent(cd.sellingFeePercent)} agent commission`}
                />
                <ResultRow label="Total project cost" value={formatCurrencyFull(cdResult.totalProjectCost)} bold formula="Sum of all costs above" />
              </Card>

              {/* Returns */}
              <Card title="Returns" accent>
                <ResultRow label="Profit" value={formatCurrencyFull(cdResult.profit)} bold formula="GRV − total project cost" />
                <ResultRow label="Margin on GRV" value={formatPercent(cdResult.marginOnGRV)} indent formula="Profit ÷ GRV  (industry benchmark: 18–20%+)" />
                <ResultRow label="ROI on equity deployed" value={formatPercent(cdResult.roiOnEquity)} indent formula="Profit ÷ total equity required (cash actually deployed)" />
                <div className="my-2 border-t border-blue-200" />
                <ResultRow label={`Profit per investor (÷ ${cd.numInvestors})`} value={formatCurrencyFull(cdResult.profitPerInvestor)} formula={`Profit ÷ ${cd.numInvestors} investors`} />
                <ResultRow label="Equity per investor" value={formatCurrencyFull(cdResult.equityPerInvestor)} indent formula={`Total equity ÷ ${cd.numInvestors} investors`} />
              </Card>

              {/* Equity breakdown */}
              <Card title="Equity Deployed (Cash You Need)">
                <ResultRow label="Land equity deposit" value={formatCurrencyFull(cdResult.landEquityDeposit)} formula={`Land price × ${formatPercent(1 - cd.landLVR)} (the ${formatPercent(1 - cd.landLVR)} the bank won't lend)`} />
                <ResultRow label="+ Stamp duty" value={formatCurrencyFull(cdResult.stampDuty)} indent formula="Cannot be borrowed — must be paid in cash at settlement" />
                <ResultRow label="+ Soft costs" value={formatCurrencyFull(cdResult.softCostsTotal)} indent formula="DA, demolition, legal, contingency, bank fees" />
                <ResultRow label="+ Land interest" value={formatCurrencyFull(cdResult.landInterest)} indent formula="Paid from equity — interest-only on land loan for full hold period" />
                <ResultRow label="+ Build interest" value={formatCurrencyFull(cdResult.buildInterest)} indent formula="Paid from equity — interest on funded portion of build, half-draw" />
                <ResultRow label={`+ Build equity gap`} value={formatCurrencyFull(cdResult.buildEquityGap)} indent formula={`Build cost × ${formatPercent(1 - cd.buildFundedPercent)} — the portion the bank won't fund`} />
                <ResultRow label="= Total equity required" value={formatCurrencyFull(cdResult.minEquityRequired)} bold formula="Sum of all items above (this is your actual cash commitment)" />
                <ResultRow label={`Per investor (÷ ${cd.numInvestors})`} value={formatCurrencyFull(cdResult.equityPerInvestor)} indent formula={`Total equity ÷ ${cd.numInvestors} investors`} />
              </Card>

              {/* Reference */}
              <Card title="Reference — Max Buy Price @ 18% Margin">
                <ResultRow label="Max land price for 18% margin" value={formatCurrencyFull(cdResult.maxBuyPrice)} formula="Solved by the model at 18% target — same costs, same sale price" />
                <ResultRow label="Your purchase price" value={formatCurrencyFull(cd.purchasePrice)} />
                <ResultRow
                  label={cdResult.vsMaxBuy <= 0 ? '✓ Under max buy — within feasibility' : '✗ Over max buy — margin below 18%'}
                  value={`${cdResult.vsMaxBuy >= 0 ? '+' : ''}${formatCurrencyFull(cdResult.vsMaxBuy)}`}
                  bold
                  formula={cdResult.vsMaxBuy <= 0 ? 'You are paying less than the model\'s max — deal is within target' : 'You are paying more than the model\'s max — margin will be below 18%'}
                />
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ── Save modal ── */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-900 mb-1">Save analysis</h2>
            <p className="text-sm text-gray-400 mb-4">Give this analysis a name so you can find it later.</p>
            <input
              autoFocus
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveAnalysis()}
              placeholder="e.g. 14 Smith St Parramatta"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setSaveModal(false); setSaveName('') }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveAnalysis}
                disabled={saveLoading || !saveName.trim()}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saveLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
