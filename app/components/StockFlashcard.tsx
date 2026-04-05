'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Cpu,
  Factory,
  Globe2,
  Layers3,
  ShieldAlert,
  TrendingUp,
  X,
} from 'lucide-react';
import type { FlashcardResponse, MetricItem, PeriodInfo, SummaryCard, SummaryCardTone } from '@/app/api/stocks/[ticker]/flashcard/route';

type FlashcardTab = 'summary' | 'valuation' | 'quality' | 'risk';
type FlashcardMeta = {
  readMode?: string;
  summarySource?: string;
  warnings?: string[];
  fallbackUsed?: boolean;
  canonicalCoverage?: {
    selectedPeriodId: string;
    metricCount: number;
    factCount: number;
    sufficient: boolean;
  };
};
type FlashcardViewData = FlashcardResponse & { meta?: FlashcardMeta };

const DISPLAY_FONT = { fontFamily: 'Manrope, Inter, system-ui, sans-serif' } as const;
const TAB_CONFIG = [
  { id: 'summary' as const, label: 'Summary', icon: Layers3, title: 'Primary Performance Scores', subtitle: 'A compact institutional view across valuation, quality, and risk.' },
  { id: 'valuation' as const, label: 'Valuation', icon: BarChart3, title: 'Valuation Detail', subtitle: 'Price multiple and cash-yield measures for the selected period.' },
  { id: 'quality' as const, label: 'Quality', icon: TrendingUp, title: 'Quality Detail', subtitle: 'Growth, margin, return, and cash-conversion measures for the selected period.' },
  { id: 'risk' as const, label: 'Risk', icon: ShieldAlert, title: 'Risk Detail', subtitle: 'Leverage, liquidity, coverage, and downside framing for the selected period.' },
];

function toneStyles(tone: SummaryCardTone) {
  if (tone === 'good') return { stroke: '#4edea3', badgeBg: 'rgba(111,251,190,0.18)', badgeText: '#005236', border: 'rgba(0,171,118,0.18)' };
  if (tone === 'weak') return { stroke: '#ba1a1a', badgeBg: 'rgba(255,218,214,0.82)', badgeText: '#93000a', border: 'rgba(186,26,26,0.12)' };
  if (tone === 'fair') return { stroke: '#002d62', badgeBg: 'rgba(167,200,255,0.16)', badgeText: '#1f477b', border: 'rgba(31,71,123,0.14)' };
  return { stroke: '#747781', badgeBg: 'rgba(218,226,253,0.55)', badgeText: '#43474f', border: 'rgba(116,119,129,0.14)' };
}

function metricTone(code: string, value: number | null): SummaryCardTone {
  if (value == null || !Number.isFinite(value)) return 'neutral';
  const hi: Record<string, [number, number]> = {
    valuation_fcf_yield: [5, 2],
    quality_revenue_growth: [10, 0],
    quality_operating_margin: [20, 10],
    quality_roe: [15, 8],
    quality_roic: [12, 6],
    quality_cfo_net_income: [1, 0.7],
    risk_interest_coverage: [5, 2],
    risk_cash_short_debt: [1.5, 1],
    risk_shareholder_yield: [4, 1.5],
  };
  const lo: Record<string, [number, number]> = {
    valuation_pe: [15, 30],
    valuation_pb: [3, 6],
    valuation_ev_ebit: [12, 25],
    valuation_percentile: [35, 70],
    risk_net_debt_ebitda: [2, 4],
  };
  if (hi[code]) return value >= hi[code][0] ? 'good' : value >= hi[code][1] ? 'fair' : 'weak';
  if (lo[code]) return value <= lo[code][0] ? 'good' : value <= lo[code][1] ? 'fair' : 'weak';
  if (code === 'risk_fcf') return value > 0 ? 'good' : 'weak';
  return 'neutral';
}

function scoreForCard(card: SummaryCard) {
  const map: Record<SummaryCardTone, number> = { good: 9.2, fair: 6.6, weak: 3.5, neutral: 5 };
  const values = card.metrics.map((metric) => map[metricTone(metric.code, metric.numericValue)]);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : map[card.tone];
}

function formatSignedCurrency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}`;
}

function formatSignedPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function buildArchitectView(data: FlashcardResponse | null, tab: FlashcardTab) {
  if (!data) return 'This flashcard combines live market context with period-specific fundamentals.';
  const valuation = data.summary.cards.find((card) => card.id === 'valuation');
  const quality = data.summary.cards.find((card) => card.id === 'quality');
  const risk = data.summary.cards.find((card) => card.id === 'risk');
  if (tab === 'valuation') return `${valuation?.statusLabel ?? 'Valuation'} is being read through multiple price-to-fundamental lenses, not a single headline multiple.`;
  if (tab === 'quality') return `${quality?.statusLabel ?? 'Quality'} reflects growth, margin, returns, and cash conversion together.`;
  if (tab === 'risk') return `${risk?.statusLabel ?? 'Risk'} captures leverage, coverage, liquidity, and free cash flow in one view.`;
  return `Valuation reads ${valuation?.statusLabel.toLowerCase() ?? 'mixed'}, quality looks ${quality?.statusLabel.toLowerCase() ?? 'balanced'}, and risk appears ${risk?.statusLabel.toLowerCase() ?? 'watchful'} for ${data.selectedPeriod.label}.`;
}

function buildRiskTags(metrics: MetricItem[]) {
  const rows = metrics
    .map((metric) => ({ label: metric.label, tone: metricTone(metric.code, metric.numericValue) }))
    .filter((row) => row.tone !== 'good')
    .slice(0, 3);
  return rows.length ? rows : metrics.slice(0, 3).map((metric) => ({ label: metric.label, tone: metricTone(metric.code, metric.numericValue) }));
}

function Tabs({ activeTab, onChange }: { activeTab: FlashcardTab; onChange: (tab: FlashcardTab) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex items-center justify-center gap-2 rounded-full border px-3 py-3 text-sm font-semibold transition"
            style={{ background: active ? '#001a38' : '#ffffff', borderColor: active ? '#001a38' : 'rgba(196,198,209,0.7)', color: active ? '#ffffff' : '#515f74' }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ScoreCard({ card }: { card: SummaryCard }) {
  const score = scoreForCard(card);
  const styles = toneStyles(card.tone);
  return (
    <div className="flex flex-col items-center rounded-lg border border-[#c4c6d1]/25 bg-white p-6 shadow-[0_16px_64px_-12px_rgba(19,27,46,0.10)]">
      <div className="relative mb-4 h-20 w-20">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#d2d9f4" strokeWidth="3" />
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={styles.stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${Math.max(0, Math.min(100, score * 10))}, 100`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#001a38]" style={DISPLAY_FONT}>{score.toFixed(1)}</div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#43474f]">{card.title}</span>
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricItem }) {
  const tone = metricTone(metric.code, metric.numericValue);
  const styles = toneStyles(tone);
  return (
    <div className="rounded-lg border border-[#c4c6d1]/18 bg-white p-4 shadow-[0_16px_64px_-12px_rgba(19,27,46,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#43474f]">{metric.label}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#001a38]" style={DISPLAY_FONT}>{metric.displayValue}</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: styles.badgeText, background: styles.badgeBg, borderColor: styles.border }}>{tone}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#515f74]">{metric.description || 'No additional context available for this measure yet.'}</p>
    </div>
  );
}

interface Props {
  ticker: string;
  entityName: string;
  entitySector: string | null;
  onClose: () => void;
}

export default function StockFlashcard({ ticker, entityName, entitySector, onClose }: Props) {
  const [data, setData] = useState<FlashcardViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FlashcardTab>('summary');

  const loadData = useCallback(async (periodId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : '';
      const response = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/flashcard${query}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? 'Unable to load stock flashcard');
      const nextData = payload as FlashcardViewData;
      setData(nextData);
      setSelectedPeriodId(nextData.selectedPeriod.id);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to load stock flashcard');
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    setActiveTab('summary');
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handlePeriodChange = (periodId: string) => {
    if (periodId === selectedPeriodId) return;
    setSelectedPeriodId(periodId);
    void loadData(periodId);
  };

  const activeConfig = TAB_CONFIG.find((item) => item.id === activeTab)!;
  const qualityCard = data?.summary.cards.find((card) => card.id === 'quality');
  const riskTags = useMemo(() => (data ? buildRiskTags(data.metrics.risk) : []), [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,24,35,0.62)] p-4" style={{ backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,45,98,0.18),transparent_36%)]" />
      <article className="relative z-10 flex max-h-[92vh] min-h-[600px] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-[#f2f3ff] shadow-[0_32px_90px_-26px_rgba(19,27,46,0.55)] xl:flex-row" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-[#001a38]/12 text-[#001a38] backdrop-blur-md transition hover:bg-[#001a38]/18">
          <X size={18} />
        </button>

        <aside className="flex w-full shrink-0 flex-col justify-between gap-8 border-b border-[#c4c6d1]/45 bg-[linear-gradient(180deg,#e2e7ff_0%,#dae2fd_100%)] p-6 text-[#131b2e] xl:w-[340px] xl:border-b-0 xl:border-r xl:p-8">
          <div>
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#002d62] text-white shadow-[0_12px_32px_-16px_rgba(0,45,98,0.7)]">
                <Cpu size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#002d62]" style={DISPLAY_FONT}>{data?.name ?? entityName}</h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#43474f]">{data?.exchange ?? 'MARKET'}: {ticker}</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-1 text-xs text-[#43474f]">Current Price</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-extrabold tracking-tight text-[#001a38]" style={DISPLAY_FONT}>{data?.price != null ? `$${data.price.toFixed(2)}` : 'N/A'}</span>
                {data?.priceChangePct != null ? <span className={`flex items-center text-sm font-bold ${(data.priceChangePct ?? 0) >= 0 ? 'text-[#00ab76]' : 'text-[#ba1a1a]'}`}>{(data.priceChangePct ?? 0) >= 0 ? <TrendingUp size={14} className="mr-1" /> : <CircleAlert size={14} className="mr-1" />}{formatSignedPercent(data.priceChangePct)}</span> : null}
              </div>
              {data?.priceChange != null || data?.priceChangePct != null ? <p className={`mt-2 text-sm ${(data?.priceChangePct ?? 0) >= 0 ? 'text-[#00ab76]' : 'text-[#ba1a1a]'}`}>{formatSignedCurrency(data?.priceChange ?? null)}{data?.priceChangePct != null ? ` (${formatSignedPercent(data.priceChangePct)})` : ''}</p> : null}
            </div>

            {data?.availablePeriods.length && selectedPeriodId ? (
              <label className="mb-6 block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-[#43474f]">Selected Period</span>
                <select value={selectedPeriodId} onChange={(event) => handlePeriodChange(event.target.value)} className="w-full rounded-xl border border-[#c4c6d1]/55 bg-white/72 px-4 py-3 text-sm font-medium text-[#131b2e] outline-none transition focus:border-[#1f477b] focus:ring-2 focus:ring-[#a7c8ff]/35">
                  {data.availablePeriods.map((period: PeriodInfo) => <option key={period.id} value={period.id}>{period.label}{period.endDate ? ` (${period.endDate})` : ''}</option>)}
                </select>
              </label>
            ) : null}

            <div className="space-y-4">
              <div className="rounded-xl border border-white/80 bg-white/72 p-4 shadow-[0_12px_36px_-18px_rgba(19,27,46,0.18)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#43474f]">Institutional Quality</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-lg font-bold text-[#001a38]" style={DISPLAY_FONT}>{qualityCard?.statusLabel ?? entitySector ?? 'Coverage pending'}</span>
                  <CheckCircle2 className="text-[#00ab76]" size={16} />
                </div>
              </div>

              <div className="rounded-xl border border-white/80 bg-white/72 p-4 shadow-[0_12px_36px_-18px_rgba(19,27,46,0.18)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#43474f]">Profitability Score</p>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-2xl font-bold text-[#001a38]" style={DISPLAY_FONT}>{qualityCard ? scoreForCard(qualityCard).toFixed(1) : 'N/A'}<span className="ml-1 text-sm font-medium text-[#747781]">/10</span></span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#d5e3fc]">
                    <div className="h-full rounded-full bg-[#4edea3]" style={{ width: `${Math.max(0, Math.min(100, (qualityCard ? scoreForCard(qualityCard) : 0) * 10))}%` }} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/80 bg-white/72 p-4 shadow-[0_12px_36px_-18px_rgba(19,27,46,0.18)]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#43474f]">Data Source</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#c4c6d1]/60 bg-[#faf8ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#43474f]">{data?.meta?.readMode ?? 'canonical'}</span>
                  {data?.meta?.summarySource ? <span className="rounded-full border border-[#c4c6d1]/60 bg-[#faf8ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#43474f]">{data.meta.summarySource.replace('_', ' ')}</span> : null}
                  {data?.meta?.warnings?.length ? <span className="rounded-full border border-[#ba1a1a]/12 bg-[#ffdad6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#93000a]">{data.meta.warnings.length} warnings</span> : null}
                </div>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => setActiveTab((current) => (current === 'summary' ? 'valuation' : 'summary'))} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#001a38_0%,#002e5d_100%)] px-4 py-4 text-sm font-bold text-white shadow-[0_18px_40px_-20px_rgba(0,26,56,0.65)] transition-transform active:scale-[0.99]" style={DISPLAY_FONT}>
            {activeTab === 'summary' ? 'Full Analysis' : 'Back to Summary'}
            <ArrowRight size={16} />
          </button>
        </aside>

        <section className="flex-1 overflow-y-auto bg-[#f2f3ff] p-6 md:p-8 lg:p-10">
          {loading && !data ? <div className="flex min-h-[420px] items-center justify-center"><div className="flex flex-col items-center gap-4"><div className="h-12 w-12 animate-spin rounded-full border-2 border-[#dae2fd] border-t-[#002d62]" /><p className="text-sm text-[#515f74]">Loading flashcard...</p></div></div> : null}

          {error && !data ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <div className="w-full max-w-2xl rounded-xl border border-[#ffdad6] bg-white p-8 text-center shadow-[0_16px_64px_-12px_rgba(19,27,46,0.10)]">
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#93000a]">No stock flashcard data</p>
                <p className="mt-4 text-3xl font-black text-[#001a38]" style={DISPLAY_FONT}>{ticker}</p>
                <p className="mt-4 text-sm leading-7 text-[#515f74]">{error}</p>
              </div>
            </div>
          ) : null}

          {data ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <Tabs activeTab={activeTab} onChange={setActiveTab} />
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#515f74]">
                  <span className="rounded-full border border-[#c4c6d1]/65 bg-white px-3 py-1.5">{data.selectedPeriod.label}</span>
                  {data.selectedPeriod.endDate ? <span className="rounded-full border border-[#c4c6d1]/45 bg-[#faf8ff] px-3 py-1.5 text-[#747781]">{data.selectedPeriod.endDate}</span> : null}
                </div>
              </div>

              <div>
                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = activeConfig.icon;
                      return <Icon className="text-[#002d62]" size={18} />;
                    })()}
                    <h2 className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#002d62]" style={DISPLAY_FONT}>{activeConfig.title}</h2>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#515f74]">{activeConfig.subtitle}</p>
                </div>

                {activeTab === 'summary' ? (
                  <div className="space-y-10">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">{data.summary.cards.map((card) => <ScoreCard key={card.id} card={card} />)}</div>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                      {data.summary.cards.map((card) => {
                        const styles = toneStyles(card.tone);
                        return (
                          <div key={card.id} className="rounded-xl border border-[#c4c6d1]/25 bg-white p-4 shadow-[0_16px_64px_-12px_rgba(19,27,46,0.08)]">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#43474f]">{card.title}</p>
                                <p className="mt-2 text-lg font-bold text-[#001a38]" style={DISPLAY_FONT}>{card.statusLabel}</p>
                              </div>
                              <span className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: styles.badgeText, background: styles.badgeBg, borderColor: styles.border }}>{card.tone}</span>
                            </div>
                            <div className="mt-4 space-y-3">
                              {card.metrics.map((metric) => <div key={metric.code} className="rounded-lg border border-[#c4c6d1]/18 bg-[#faf8ff] px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#747781]">{metric.label}</p><p className="mt-2 text-xl font-bold text-[#001a38]" style={DISPLAY_FONT}>{metric.displayValue}</p></div>)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {data.summary.highlights.map((item) => <div key={item.label} className="rounded-lg border border-[#c4c6d1]/20 bg-[#faf8ff] px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#43474f]">{item.label}</p><p className="mt-2 text-xl font-bold text-[#001a38]" style={DISPLAY_FONT}>{item.value}</p></div>)}
                    </div>

                    {riskTags.length ? (
                      <div>
                        <div className="mb-4 flex items-center gap-2"><ShieldAlert className="text-[#ba1a1a]" size={18} /><h3 className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#002d62]" style={DISPLAY_FONT}>Risk Exposure</h3></div>
                        <div className="flex flex-wrap gap-2">
                          {riskTags.map((tag, index) => {
                            const styles = toneStyles(tag.tone);
                            const Icon = index === 0 ? CircleAlert : index === 1 ? Globe2 : Factory;
                            return <span key={tag.label} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: styles.badgeText, background: styles.badgeBg, borderColor: styles.border }}><Icon size={12} />{tag.label}</span>;
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {(activeTab === 'valuation' ? data.metrics.valuation : activeTab === 'quality' ? data.metrics.quality : data.metrics.risk).map((metric) => <MetricCard key={metric.code} metric={metric} />)}
                  </div>
                )}
              </div>

              <div className="rounded-lg border-l-4 border-[#001a38] bg-[#002e5d]/5 p-6">
                <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#001a38]" style={DISPLAY_FONT}>Architect&apos;s View</h3>
                <p className="text-sm italic leading-7 text-[#515f74]">&quot;{buildArchitectView(data, activeTab)}&quot;</p>
              </div>
            </div>
          ) : null}
        </section>
      </article>
    </div>
  );
}
