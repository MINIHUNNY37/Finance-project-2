'use client';

/**
 * StockFlashcard — 3-section stock analysis modal.
 *
 * Opens when a user double-clicks a stock entity (entityKind === 'stock').
 * Sections:
 *   Valuation — PER, PBR, EV/EBIT, FCF Yield, Valuation Percentile
 *   Quality   — Revenue Growth, Op. Margin, ROE, ROIC, CFO/Net Income
 *   Risk      — FCF, Net Debt/EBITDA, Interest Coverage, Cash/ST Debt, Shareholder Yield
 */

import { useEffect, useState, useCallback } from 'react';
import type { FlashcardResponse, MetricItem, PeriodInfo } from '@/app/api/stocks/[ticker]/flashcard/route';

// ── Colour helpers ─────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#3B82F6', 'Communication Services': '#06B6D4',
  'Consumer Discretionary': '#F59E0B', 'Consumer Staples': '#10B981',
  'Healthcare': '#EC4899', 'Financials': '#F97316',
  'Industrials': '#8B5CF6', 'Energy': '#EF4444',
  'Materials': '#6366F1', 'Real Estate': '#14B8A6', 'Utilities': '#84CC16',
};
const SECTOR_ICONS: Record<string, string> = {
  'Technology': '💻', 'Communication Services': '📺',
  'Consumer Discretionary': '🛒', 'Consumer Staples': '🛒',
  'Healthcare': '🏥', 'Financials': '💰',
  'Industrials': '🏭', 'Energy': '⚡',
  'Materials': '⛏️', 'Real Estate': '🏗️', 'Utilities': '🔋',
};
function sectorColor(s: string | null) { return SECTOR_COLORS[s ?? ''] ?? '#6B7280'; }
function sectorIcon(s: string | null)  { return SECTOR_ICONS[s ?? ''] ?? '🏢'; }

// ── Metric value colouring ─────────────────────────────────────────────────────

/**
 * Returns a colour class based on whether a metric value is good / neutral / bad.
 * Convention: some metrics are "higher is better", some "lower is better".
 */
function metricColor(code: string, value: number | null): string {
  if (value == null) return '#6B7280'; // grey — no data

  const higherBetter: Record<string, { good: number; bad: number }> = {
    valuation_fcf_yield:       { good: 0.04, bad: 0.01 },
    quality_revenue_growth:    { good: 0.10, bad: 0 },
    quality_operating_margin:  { good: 0.15, bad: 0.05 },
    quality_roe:               { good: 0.15, bad: 0.05 },
    quality_roic:              { good: 0.10, bad: 0.05 },
    quality_cfo_net_income:    { good: 0.9,  bad: 0.5 },
    risk_interest_coverage:    { good: 5,    bad: 2 },
    risk_cash_short_debt:      { good: 1.5,  bad: 0.5 },
    risk_shareholder_yield:    { good: 0.04, bad: 0.01 },
  };
  const lowerBetter: Record<string, { good: number; bad: number }> = {
    valuation_pe:          { good: 15,  bad: 30 },
    valuation_pb:          { good: 2,   bad: 5 },
    valuation_ev_ebit:     { good: 12,  bad: 25 },
    valuation_percentile:  { good: 30,  bad: 70 },
    risk_net_debt_ebitda:  { good: 1.5, bad: 4 },
  };

  if (higherBetter[code]) {
    const { good, bad } = higherBetter[code];
    if (value >= good) return '#10B981';
    if (value >= bad)  return '#F59E0B';
    return '#EF4444';
  }
  if (lowerBetter[code]) {
    const { good, bad } = lowerBetter[code];
    if (value <= good) return '#10B981';
    if (value <= bad)  return '#F59E0B';
    return '#EF4444';
  }
  // FCF is special: positive = green, negative = red
  if (code === 'risk_fcf') return value > 0 ? '#10B981' : '#EF4444';
  return '#9CA3AF';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, prefix = '', suffix = '', decimals = 2): string {
  if (v == null) return '—';
  return `${prefix}${v.toFixed(decimals)}${suffix}`;
}

// ── CompanyBanner ─────────────────────────────────────────────────────────────

function CompanyBanner({ name, ticker, sector, exchange, price, priceChange, priceChangePct }: {
  name: string; ticker: string; sector: string | null; exchange: string | null;
  price: number | null; priceChange: number | null; priceChangePct: number | null;
}) {
  const color  = sectorColor(sector);
  const icon   = sectorIcon(sector);
  const priceUp = (priceChangePct ?? 0) >= 0;

  return (
    <div
      className="relative flex items-end justify-between px-5 pb-4 pt-8 rounded-t-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, #111827 100%)`,
        borderBottom: `2px solid ${color}44`,
        minHeight: '90px',
      }}
    >
      <div
        className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-10 -translate-y-1/2 translate-x-1/4"
        style={{ background: color }}
      />
      <div className="flex items-center gap-3 relative z-10">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow"
          style={{ background: `${color}33`, border: `1px solid ${color}55` }}
        >
          {icon}
        </div>
        <div>
          <p className="text-base font-bold text-white leading-tight">{name}</p>
          <p className="text-xs text-gray-400">{ticker}{exchange ? ` · ${exchange}` : ''}{sector ? ` · ${sector}` : ''}</p>
        </div>
      </div>
      {price != null && (
        <div className="relative z-10 text-right">
          <p className="text-xl font-bold text-white">${price.toFixed(2)}</p>
          {priceChangePct != null && (
            <p className={`text-xs font-medium ${priceUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceUp ? '▲' : '▼'} {fmt(priceChange, '$', '', 2)} ({fmt(priceChangePct, '', '%', 2)})
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>{label}</p>
    </div>
  );
}

// ── Metric row ─────────────────────────────────────────────────────────────────

function MetricRow({ metric, showTooltip }: { metric: MetricItem; showTooltip: boolean }) {
  const color  = metricColor(metric.code, metric.numericValue);
  const hasVal = metric.numericValue != null;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800/60 group relative">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">{metric.label}</span>
        {metric.description && (
          <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors cursor-help" title={metric.description}>
            ⓘ
          </span>
        )}
      </div>
      <span
        className="text-sm font-bold tabular-nums"
        style={{ color: hasVal ? color : '#4B5563' }}
      >
        {metric.displayValue}
      </span>
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────────

const SECTION_ACCENTS: Record<string, string> = {
  valuation: '#F59E0B',
  quality:   '#10B981',
  risk:      '#EF4444',
};

function MetricSection({ title, metrics, sectionKey }: {
  title: string; metrics: MetricItem[]; sectionKey: string;
}) {
  const accent = SECTION_ACCENTS[sectionKey] ?? '#6B7280';
  return (
    <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
      <SectionHeader label={title} accent={accent} />
      <div>
        {metrics.map(m => <MetricRow key={m.code} metric={m} showTooltip={true} />)}
      </div>
    </div>
  );
}

// ── Period picker ──────────────────────────────────────────────────────────────

function PeriodPicker({ periods, selectedId, onChange, color }: {
  periods: PeriodInfo[]; selectedId: string; onChange: (id: string) => void; color: string;
}) {
  if (periods.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-[10px] text-gray-500 uppercase tracking-wide">Period</span>
      <select
        value={selectedId}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none"
        style={{ color: '#D1D5DB' }}
      >
        {periods.map(p => (
          <option key={p.id} value={p.id}>
            {p.label}{p.endDate ? ` (${p.endDate.slice(0, 7)})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center justify-end gap-3 px-1 pb-1">
      {[['#10B981', 'Good'], ['#F59E0B', 'Fair'], ['#EF4444', 'Weak']].map(([c, l]) => (
        <div key={l} className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: c }} />
          <span className="text-[9px] text-gray-500">{l}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  ticker:       string;
  entityName:   string;
  entitySector: string | null;
  onClose:      () => void;
}

export default function StockFlashcard({ ticker, entityName, entitySector, onClose }: Props) {
  const [data, setData]         = useState<FlashcardResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const color = sectorColor(entitySector);

  const loadData = useCallback((periodId?: string) => {
    setLoading(true);
    setError(null);
    const url = `/api/stocks/${encodeURIComponent(ticker)}/flashcard${periodId ? `?periodId=${periodId}` : ''}`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: FlashcardResponse) => {
        setData(d);
        setSelectedPeriodId(d.selectedPeriod.id);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [ticker]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePeriodChange = (id: string) => {
    if (id !== selectedPeriodId) {
      setSelectedPeriodId(id);
      loadData(id);
    }
  };

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh', border: `1px solid ${color}33` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-gray-800/80 text-gray-400 hover:text-white flex items-center justify-center text-lg transition-colors"
        >
          ×
        </button>

        {/* Banner */}
        <CompanyBanner
          name={data?.name ?? entityName}
          ticker={ticker}
          sector={data?.sector ?? entitySector}
          exchange={data?.exchange ?? null}
          price={data?.price ?? null}
          priceChange={data?.priceChange ?? null}
          priceChangePct={data?.priceChangePct ?? null}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: color }} />
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm text-center py-10">
              <p className="text-2xl mb-2">⚠️</p>
              <p>No data found for <span className="font-bold">{ticker}</span></p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                This stock may not be in the market library yet, or stats haven't been fetched.<br />
                Go to <span className="text-gray-400">/dashboard → Migration tab</span> and run all steps.
              </p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Period picker */}
              {data.availablePeriods.length > 1 && selectedPeriodId && (
                <PeriodPicker
                  periods={data.availablePeriods}
                  selectedId={selectedPeriodId}
                  onChange={handlePeriodChange}
                  color={color}
                />
              )}

              {/* Legend */}
              <Legend />

              {/* 3 metric sections */}
              <MetricSection title="Valuation" metrics={data.metrics.valuation} sectionKey="valuation" />
              <MetricSection title="Quality"   metrics={data.metrics.quality}   sectionKey="quality" />
              <MetricSection title="Risk"      metrics={data.metrics.risk}      sectionKey="risk" />

              {/* Period footer */}
              <p className="text-[10px] text-gray-600 text-center pb-1">
                Data period: {data.selectedPeriod.label}
                {data.selectedPeriod.endDate ? ` · ${data.selectedPeriod.endDate.slice(0, 7)}` : ''}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
