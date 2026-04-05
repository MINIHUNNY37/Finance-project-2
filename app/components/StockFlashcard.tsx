'use client';

/**
 * StockFlashcard — "Sovereign Architect" design.
 *
 * Two-panel modal (light theme):
 *   Left sidebar (1/3)  — identity, price, quality score, profitability bar
 *   Right panel  (2/3)  — score rings, key metric grid, risk tags, full metrics
 *
 * Triggered from MapCanvas when a stock entity is clicked.
 */

import { useEffect, useState, useCallback } from 'react';
import type { FlashcardResponse, MetricItem, PeriodInfo } from '@/app/api/stocks/[ticker]/flashcard/route';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  primary:          '#001a38',
  primaryMid:       '#002e5d',
  green:            '#4edea3',
  red:              '#ba1a1a',
  redBg:            '#ffdad6',
  redText:          '#93000a',
  amber:            '#F59E0B',
  surface:          '#faf8ff',
  surfaceLow:       '#f2f3ff',
  surfaceHigh:      '#dae2fd',
  onSurface:        '#131b2e',
  onSurfaceVar:     '#43474f',
  outlineVar:       '#c4c6d1',
};

// ── Metric traffic-light colouring ────────────────────────────────────────────
function metricColor(code: string, value: number | null): string {
  if (value == null) return '#9CA3AF';

  const higherBetter: Record<string, { good: number; bad: number }> = {
    valuation_fcf_yield:      { good: 0.04, bad: 0.01 },
    quality_revenue_growth:   { good: 0.10, bad: 0 },
    quality_operating_margin: { good: 0.15, bad: 0.05 },
    quality_roe:              { good: 0.15, bad: 0.05 },
    quality_roic:             { good: 0.10, bad: 0.05 },
    quality_cfo_net_income:   { good: 0.9,  bad: 0.5 },
    risk_interest_coverage:   { good: 5,    bad: 2 },
    risk_cash_short_debt:     { good: 1.5,  bad: 0.5 },
    risk_shareholder_yield:   { good: 0.04, bad: 0.01 },
  };
  const lowerBetter: Record<string, { good: number; bad: number }> = {
    valuation_pe:         { good: 15, bad: 30 },
    valuation_pb:         { good: 2,  bad: 5 },
    valuation_ev_ebit:    { good: 12, bad: 25 },
    valuation_percentile: { good: 30, bad: 70 },
    risk_net_debt_ebitda: { good: 1.5, bad: 4 },
  };

  if (higherBetter[code]) {
    const { good, bad } = higherBetter[code];
    if (value >= good) return C.green;
    if (value >= bad)  return C.amber;
    return C.red;
  }
  if (lowerBetter[code]) {
    const { good, bad } = lowerBetter[code];
    if (value <= good) return C.green;
    if (value <= bad)  return C.amber;
    return C.red;
  }
  if (code === 'risk_fcf') return value > 0 ? C.green : C.red;
  return '#9CA3AF';
}

// ── Score (0–10) derived from traffic-light results ───────────────────────────
function computeScore(metrics: MetricItem[]): number | null {
  const scored = metrics.filter(m => m.numericValue != null);
  if (scored.length === 0) return null;
  const pts = scored.map(m => {
    const col = metricColor(m.code, m.numericValue);
    if (col === C.green) return 10;
    if (col === C.amber) return 5;
    return 1;
  });
  const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
  return Math.round(avg * 10) / 10;
}

function moatLabel(score: number | null) {
  if (score == null) return 'Unknown';
  if (score >= 7.5) return 'Wide Moat';
  if (score >= 5)   return 'Narrow Moat';
  return 'No Moat';
}

// ── Sector icon (Material Symbols name) ───────────────────────────────────────
const SECTOR_ICONS: Record<string, string> = {
  'Technology':             'memory',
  'Communication Services': 'cell_tower',
  'Consumer Discretionary': 'shopping_bag',
  'Consumer Staples':       'local_grocery_store',
  'Healthcare':             'health_and_safety',
  'Financials':             'account_balance',
  'Industrials':            'factory',
  'Energy':                 'bolt',
  'Materials':              'diamond',
  'Real Estate':            'apartment',
  'Utilities':              'electric_bolt',
};
function sectorIcon(s: string | null) { return SECTOR_ICONS[s ?? ''] ?? 'business'; }

// ── Risk exposure tags ────────────────────────────────────────────────────────
interface RiskTag { label: string; icon: string; hot: boolean; }

function getRiskTags(riskMetrics: MetricItem[], sector: string | null): RiskTag[] {
  const tags: RiskTag[] = [];
  const byCode = Object.fromEntries(riskMetrics.map(m => [m.code, m]));

  const netDebt  = byCode['risk_net_debt_ebitda']?.numericValue;
  const coverage = byCode['risk_interest_coverage']?.numericValue;
  const fcf      = byCode['risk_fcf']?.numericValue;

  if (netDebt  != null && netDebt  > 4) tags.push({ label: 'High Leverage',      icon: 'trending_down', hot: true });
  if (coverage != null && coverage < 2) tags.push({ label: 'Debt Service Risk',   icon: 'warning',       hot: true });
  if (fcf      != null && fcf      < 0) tags.push({ label: 'Negative FCF',        icon: 'money_off',     hot: true });

  const contextual: Record<string, { label: string; icon: string }> = {
    'Technology':             { label: 'Regulatory Risk',  icon: 'policy' },
    'Communication Services': { label: 'Regulatory Risk',  icon: 'policy' },
    'Energy':                 { label: 'Commodity Risk',   icon: 'local_gas_station' },
    'Materials':              { label: 'Commodity Risk',   icon: 'diamond' },
    'Financials':             { label: 'Rate Sensitivity', icon: 'percent' },
    'Real Estate':            { label: 'Rate Sensitivity', icon: 'percent' },
    'Consumer Discretionary': { label: 'Cycle Risk',       icon: 'currency_exchange' },
    'Industrials':            { label: 'Supply Chain',     icon: 'factory' },
  };
  if (sector && contextual[sector]) tags.push({ ...contextual[sector], hot: false });
  if (['Technology', 'Energy', 'Industrials'].includes(sector ?? '')) {
    tags.push({ label: 'Geopolitical', icon: 'public', hot: false });
  }

  return tags.slice(0, 5);
}

// ── Donut ring ────────────────────────────────────────────────────────────────
function DonutRing({ score, label, color }: { score: number | null; label: string; color: string }) {
  const pct = score != null ? score * 10 : 0;
  return (
    <div className="flex flex-col items-center p-5 rounded-lg border bg-white"
      style={{ borderColor: `${C.outlineVar}33`, boxShadow: '0 8px 32px -8px rgba(19,27,46,0.10)' }}>
      <div className="relative mb-3" style={{ width: 72, height: 72 }}>
        <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
          {/* Track */}
          <path fill="none" stroke={C.surfaceHigh} strokeWidth="3"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          {/* Fill */}
          <path fill="none" stroke={score != null ? color : C.outlineVar} strokeWidth="3"
            strokeLinecap="round" strokeDasharray={`${pct}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: C.primary }}>
          {score != null ? score.toFixed(1) : '—'}
        </div>
      </div>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 800,
        color: C.onSurfaceVar, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  );
}

// ── Metric card (key metrics grid) ────────────────────────────────────────────
function MetricCard({ metric }: { metric: MetricItem }) {
  const col    = metricColor(metric.code, metric.numericValue);
  const isGrey = metric.numericValue == null;
  return (
    <div className="p-4 rounded-lg border"
      style={{ background: C.surface, borderColor: `${C.outlineVar}33` }}>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 700,
        color: C.onSurfaceVar, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {metric.label}
      </p>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1.15rem',
        color: isGrey ? C.outlineVar : col }}>
        {metric.displayValue}
      </div>
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
  const [data, setData]       = useState<FlashcardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [selPeriodId, setSelPeriodId] = useState<string | null>(null);

  const loadData = useCallback((periodId?: string) => {
    setLoading(true);
    setError(null);
    const url = `/api/stocks/${encodeURIComponent(ticker)}/flashcard${periodId ? `?periodId=${periodId}` : ''}`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: FlashcardResponse) => { setData(d); setSelPeriodId(d.selectedPeriod.id); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [ticker]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Derived values
  const sector    = data?.sector ?? entitySector;
  const valScore  = data ? computeScore(data.metrics.valuation) : null;
  const qualScore = data ? computeScore(data.metrics.quality)   : null;
  const riskScore = data ? computeScore(data.metrics.risk)      : null;
  const moat      = moatLabel(qualScore);
  const priceUp   = (data?.priceChangePct ?? 0) >= 0;
  const riskTags  = data ? getRiskTags(data.metrics.risk, sector) : [];

  // 4 key metrics for the highlight grid
  const highlight = [
    data?.metrics.valuation.find(m => m.code === 'valuation_pe'),
    data?.metrics.quality.find(m => m.code === 'quality_revenue_growth'),
    data?.metrics.quality.find(m => m.code === 'quality_operating_margin'),
    data?.metrics.valuation.find(m => m.code === 'valuation_ev_ebit'),
  ].filter(Boolean) as MetricItem[];

  // All 15 metrics for full detail section
  const allMetrics = data
    ? [...data.metrics.valuation, ...data.metrics.quality, ...data.metrics.risk]
    : [];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      {/* Card */}
      <article
        className="relative w-full flex flex-col md:flex-row overflow-hidden rounded-xl"
        style={{
          maxWidth: 900, maxHeight: '92vh',
          background: C.surfaceLow,
          boxShadow: '0 24px 80px -16px rgba(0,26,56,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ──────────────────── LEFT SIDEBAR ──────────────────── */}
        <section
          className="flex flex-col w-full md:w-80 flex-shrink-0 p-8"
          style={{ background: C.surfaceHigh, minHeight: 560 }}
        >
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: C.primary }} />
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: C.red }}>error</span>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: C.primary }}>
                No data for {ticker}
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.onSurfaceVar }}>
                Run migration steps in /dashboard
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full justify-between">
              <div>
                {/* Company identity */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: C.primary }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                      {sectorIcon(sector)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate"
                      style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900,
                        fontSize: '1.35rem', color: C.primary, lineHeight: 1.1 }}>
                      {data?.name ?? entityName}
                    </h1>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 500,
                      color: C.onSurfaceVar, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                      {data?.exchange ? `${data.exchange}: ` : ''}{ticker}
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12,
                    color: C.onSurfaceVar, marginBottom: 4 }}>Current Price</p>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800,
                      fontSize: '2.1rem', color: C.primary, letterSpacing: '-0.02em' }}>
                      {data?.price != null ? `$${data.price.toFixed(2)}` : '—'}
                    </span>
                    {data?.priceChangePct != null && (
                      <span className="flex items-center gap-0.5"
                        style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700,
                          fontSize: '0.85rem', color: priceUp ? C.green : C.red }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                          {priceUp ? 'trending_up' : 'trending_down'}
                        </span>
                        {priceUp ? '+' : ''}{data.priceChangePct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Quality cards */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl" style={{ background: C.surface }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 700,
                      color: C.onSurfaceVar, textTransform: 'uppercase', letterSpacing: '0.07em',
                      marginBottom: 8 }}>Institutional Quality</p>
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700,
                        fontSize: '1rem', color: C.primary }}>{moat}</span>
                      {qualScore != null && qualScore >= 7.5 && (
                        <span className="material-symbols-outlined"
                          style={{ color: C.green, fontVariationSettings: "'FILL' 1", fontSize: 22 }}>
                          verified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl" style={{ background: C.surface }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 700,
                      color: C.onSurfaceVar, textTransform: 'uppercase', letterSpacing: '0.07em',
                      marginBottom: 8 }}>Quality Score</p>
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800,
                        fontSize: '1.5rem', color: C.primary }}>
                        {qualScore != null ? qualScore.toFixed(1) : '—'}
                        <span style={{ fontSize: '0.7rem', fontWeight: 500,
                          color: `${C.onSurfaceVar}88` }}>/10</span>
                      </span>
                      <div className="flex-1 rounded-full overflow-hidden"
                        style={{ height: 6, background: C.surfaceHigh }}>
                        <div style={{
                          width: `${qualScore != null ? qualScore * 10 : 0}%`,
                          height: '100%', background: C.green, borderRadius: 9999,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Period picker */}
              {data && data.availablePeriods.length > 1 && selPeriodId && (
                <div className="mt-5">
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 700,
                    color: C.onSurfaceVar, textTransform: 'uppercase', letterSpacing: '0.07em',
                    marginBottom: 6 }}>Period</p>
                  <select
                    value={selPeriodId}
                    onChange={e => { setSelPeriodId(e.target.value); loadData(e.target.value); }}
                    className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
                    style={{ background: C.surface, border: `1px solid ${C.outlineVar}`,
                      color: C.onSurface, fontFamily: 'Inter, sans-serif' }}
                  >
                    {data.availablePeriods.map((p: PeriodInfo) => (
                      <option key={p.id} value={p.id}>
                        {p.label}{p.endDate ? ` (${p.endDate.slice(0, 7)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={onClose}
                className="w-full mt-6 py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 text-white"
                style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryMid} 100%)`,
                  fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}
              >
                Close
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
          )}
        </section>

        {/* ──────────────────── RIGHT PANEL ──────────────────── */}
        <section
          className="flex-1 p-8 overflow-y-auto space-y-8"
          style={{ scrollbarWidth: 'none' }}
        >
          {loading && (
            <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: C.primary }} />
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ── Score rings ── */}
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <span className="material-symbols-outlined" style={{ color: C.primary, fontSize: 20 }}>leaderboard</span>
                  <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 11,
                    color: C.primary, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                    Primary Performance Scores
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <DonutRing score={valScore}
                    label="Valuation"
                    color={valScore != null && valScore >= 5 ? C.green : C.red} />
                  <DonutRing score={qualScore}
                    label="Quality"
                    color={C.green} />
                  <DonutRing score={riskScore}
                    label="Risk Score"
                    color={C.primary} />
                </div>
              </div>

              {/* ── Key metrics highlight grid ── */}
              {highlight.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined" style={{ color: C.primary, fontSize: 20 }}>analytics</span>
                    <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 11,
                      color: C.primary, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                      Core Financials
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {highlight.map(m => <MetricCard key={m.code} metric={m} />)}
                  </div>
                </div>
              )}

              {/* ── Risk exposure tags ── */}
              {riskTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined" style={{ color: C.red, fontSize: 20 }}>warning</span>
                    <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 11,
                      color: C.primary, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                      Risk Exposure
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {riskTags.map(tag => (
                      <span key={tag.label}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                        style={{
                          background: tag.hot ? C.redBg : C.surfaceHigh,
                          color:      tag.hot ? C.redText : C.onSurfaceVar,
                          border:     `1px solid ${tag.hot ? `${C.red}33` : `${C.outlineVar}55`}`,
                          fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{tag.icon}</span>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Full metrics ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined" style={{ color: C.primary, fontSize: 20 }}>table_chart</span>
                  <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 11,
                    color: C.primary, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                    All Metrics
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allMetrics.map(m => <MetricCard key={m.code} metric={m} />)}
                </div>
              </div>

              {/* ── Architect's view footer ── */}
              <div className="p-5 rounded-lg border-l-4"
                style={{ background: `${C.primaryMid}09`, borderColor: C.primary }}>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '10px', fontWeight: 900,
                  color: C.primary, textTransform: 'uppercase', letterSpacing: '0.12em',
                  marginBottom: 6 }}>
                  Architect's View
                </h3>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13,
                  color: C.onSurfaceVar, lineHeight: 1.6, fontStyle: 'italic' }}>
                  {[sector, data.industry].filter(Boolean).join(' · ')}
                  {' · '}Period: {data.selectedPeriod.label}
                  {data.selectedPeriod.endDate ? ` (${data.selectedPeriod.endDate.slice(0, 7)})` : ''}
                </p>
              </div>
            </>
          )}
        </section>

        {/* ── External close button ── */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all"
          style={{ background: 'rgba(0,26,56,0.12)', backdropFilter: 'blur(4px)', color: C.primary }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>
      </article>
    </div>
  );
}
