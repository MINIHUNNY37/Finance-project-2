'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Layers3, ShieldAlert, TrendingUp, X } from 'lucide-react';
import type {
  FlashcardResponse,
  MetricItem,
  PeriodInfo,
  SummaryCard,
  SummaryCardTone,
} from '@/app/api/stocks/[ticker]/flashcard/route';

type FlashcardTab = 'summary' | 'valuation' | 'quality' | 'risk';

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#3B82F6',
  'Communication Services': '#06B6D4',
  'Consumer Discretionary': '#F59E0B',
  'Consumer Staples': '#10B981',
  Healthcare: '#EC4899',
  Financials: '#F97316',
  Industrials: '#8B5CF6',
  Energy: '#EF4444',
  Materials: '#6366F1',
  'Real Estate': '#14B8A6',
  Utilities: '#84CC16',
};

const TAB_CONFIG: Array<{ id: FlashcardTab; label: string; icon: typeof Layers3 }> = [
  { id: 'summary', label: 'Summary', icon: Layers3 },
  { id: 'valuation', label: 'Valuation', icon: BarChart3 },
  { id: 'quality', label: 'Quality', icon: TrendingUp },
  { id: 'risk', label: 'Risk', icon: ShieldAlert },
];

function sectorColor(sector: string | null) {
  return SECTOR_COLORS[sector ?? ''] ?? '#64748B';
}

function metricTone(code: string, value: number | null): SummaryCardTone {
  if (value == null || !Number.isFinite(value)) {
    return 'neutral';
  }

  const higherBetter: Record<string, { good: number; fair: number }> = {
    valuation_fcf_yield: { good: 5, fair: 2 },
    quality_revenue_growth: { good: 10, fair: 0 },
    quality_operating_margin: { good: 20, fair: 10 },
    quality_roe: { good: 15, fair: 8 },
    quality_roic: { good: 12, fair: 6 },
    quality_cfo_net_income: { good: 1, fair: 0.7 },
    risk_interest_coverage: { good: 5, fair: 2 },
    risk_cash_short_debt: { good: 1.5, fair: 1 },
    risk_shareholder_yield: { good: 4, fair: 1.5 },
  };

  const lowerBetter: Record<string, { good: number; fair: number }> = {
    valuation_pe: { good: 15, fair: 30 },
    valuation_pb: { good: 3, fair: 6 },
    valuation_ev_ebit: { good: 12, fair: 25 },
    valuation_percentile: { good: 35, fair: 70 },
    risk_net_debt_ebitda: { good: 2, fair: 4 },
  };

  if (higherBetter[code]) {
    const { good, fair } = higherBetter[code];
    if (value >= good) return 'good';
    if (value >= fair) return 'fair';
    return 'weak';
  }

  if (lowerBetter[code]) {
    const { good, fair } = lowerBetter[code];
    if (value <= good) return 'good';
    if (value <= fair) return 'fair';
    return 'weak';
  }

  if (code === 'risk_fcf') {
    return value > 0 ? 'good' : 'weak';
  }

  return 'neutral';
}

function toneStyles(tone: SummaryCardTone) {
  if (tone === 'good') {
    return {
      border: 'rgba(16,185,129,0.35)',
      background: 'rgba(16,185,129,0.10)',
      text: '#6EE7B7',
      value: '#A7F3D0',
    };
  }

  if (tone === 'fair') {
    return {
      border: 'rgba(245,158,11,0.35)',
      background: 'rgba(245,158,11,0.10)',
      text: '#FCD34D',
      value: '#FDE68A',
    };
  }

  if (tone === 'weak') {
    return {
      border: 'rgba(239,68,68,0.35)',
      background: 'rgba(239,68,68,0.10)',
      text: '#FCA5A5',
      value: '#FECACA',
    };
  }

  return {
    border: 'rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.45)',
    text: '#CBD5E1',
    value: '#E2E8F0',
  };
}

function formatSignedCurrency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatSignedPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function CompanyBanner({
  name,
  ticker,
  sector,
  exchange,
  industry,
  price,
  priceChange,
  priceChangePct,
}: {
  name: string;
  ticker: string;
  sector: string | null;
  exchange: string | null;
  industry: string | null;
  price: number | null;
  priceChange: number | null;
  priceChangePct: number | null;
}) {
  const accent = sectorColor(sector);
  const moveUp = (priceChangePct ?? 0) >= 0;

  return (
    <div
      className="relative overflow-hidden rounded-t-[28px] border-b px-6 py-6 sm:px-7"
      style={{
        borderColor: `${accent}44`,
        background: `linear-gradient(135deg, ${accent}30 0%, rgba(15,23,42,0.96) 52%, rgba(2,6,23,0.98) 100%)`,
      }}
    >
      <div
        className="absolute -right-12 -top-16 h-44 w-44 rounded-full blur-2xl"
        style={{ background: `${accent}33` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_35%)]" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100"
                style={{ borderColor: `${accent}55`, background: `${accent}18` }}
              >
                {ticker}
              </span>
              {exchange ? (
                <span className="rounded-full border border-slate-700/80 bg-slate-950/40 px-3 py-1 text-[11px] font-medium text-slate-300">
                  {exchange}
                </span>
              ) : null}
              {sector ? (
                <span className="rounded-full border border-slate-700/80 bg-slate-950/40 px-3 py-1 text-[11px] font-medium text-slate-300">
                  {sector}
                </span>
              ) : null}
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">{name}</h2>
              <p className="mt-1 text-sm text-slate-300">
                {industry ?? 'Imported market company'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 px-5 py-4 shadow-lg shadow-slate-950/35">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Live Price</p>
          <div className="mt-2 flex items-end gap-3">
            <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {price != null ? `$${price.toFixed(2)}` : 'N/A'}
            </p>
            {priceChangePct != null ? (
              <p className={`pb-1 text-sm font-semibold ${moveUp ? 'text-emerald-300' : 'text-rose-300'}`}>
                {moveUp ? '+' : ''}
                {priceChangePct.toFixed(2)}%
              </p>
            ) : null}
          </div>
          {priceChange != null || priceChangePct != null ? (
            <p className={`mt-2 text-sm ${moveUp ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatSignedCurrency(priceChange)}
              {priceChangePct != null ? ` (${formatSignedPercent(priceChangePct)})` : ''}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Price move unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FlashcardTabs({
  activeTab,
  onChange,
  accent,
}: {
  activeTab: FlashcardTab;
  onChange: (tab: FlashcardTab) => void;
  accent: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors"
            style={{
              borderColor: active ? `${accent}55` : 'rgba(51,65,85,0.88)',
              background: active ? `${accent}18` : 'rgba(2,6,23,0.55)',
              color: active ? '#F8FAFC' : '#94A3B8',
            }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PeriodPicker({
  periods,
  selectedId,
  onChange,
}: {
  periods: PeriodInfo[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  if (periods.length <= 1) return null;

  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        Period
      </span>
      <select
        value={selectedId}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950/65 px-4 py-3 text-sm font-medium text-slate-200 outline-none transition-colors focus:border-slate-500"
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.label}
            {period.endDate ? ` (${period.endDate})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCardPanel({ card }: { card: SummaryCard }) {
  const styles = toneStyles(card.tone);

  return (
    <div
      className="rounded-3xl border p-5 shadow-lg shadow-slate-950/25"
      style={{ borderColor: styles.border, background: styles.background }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{card.title}</p>
          <p className="mt-2 text-xl font-semibold text-white">{card.statusLabel}</p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ borderColor: styles.border, color: styles.text, background: styles.background }}
        >
          {card.tone}
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {card.metrics.map((metric) => (
          <div key={metric.code} className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: styles.value }}>
              {metric.displayValue}
            </p>
            {metric.description ? (
              <p className="mt-2 text-xs leading-5 text-slate-400">{metric.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryHighlights({ highlights }: { highlights: FlashcardResponse['summary']['highlights'] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {highlights.map((highlight) => (
        <div key={highlight.label} className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{highlight.label}</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-slate-100">{highlight.value}</p>
        </div>
      ))}
    </div>
  );
}

function MetricLegend() {
  const items: Array<{ label: string; tone: SummaryCardTone }> = [
    { label: 'Good', tone: 'good' },
    { label: 'Fair', tone: 'fair' },
    { label: 'Weak', tone: 'weak' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/35 px-4 py-3">
      {items.map((item) => {
        const styles = toneStyles(item.tone);
        return (
          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: styles.text }} />
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetricTile({ metric }: { metric: MetricItem }) {
  const tone = metricTone(metric.code, metric.numericValue);
  const styles = toneStyles(tone);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/45 p-5 shadow-lg shadow-slate-950/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: styles.value }}>
            {metric.displayValue}
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ borderColor: styles.border, color: styles.text, background: styles.background }}
        >
          {tone}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-400">
        {metric.description || 'No additional context available for this measure yet.'}
      </p>
    </div>
  );
}

function MetricPage({
  title,
  subtitle,
  metrics,
}: {
  title: string;
  subtitle: string;
  metrics: MetricItem[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{subtitle}</p>
      </div>
      <MetricLegend />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricTile key={metric.code} metric={metric} />
        ))}
      </div>
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
  const [data, setData] = useState<FlashcardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FlashcardTab>('summary');

  const accent = sectorColor(data?.sector ?? entitySector);

  const loadData = useCallback(
    async (periodId?: string) => {
      setLoading(true);
      setError(null);

      try {
        const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : '';
        const response = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/flashcard${query}`);
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Unable to load stock flashcard');
        }

        const nextData = payload as FlashcardResponse;
        setData(nextData);
        setSelectedPeriodId(nextData.selectedPeriod.id);
      } catch (err) {
        setData(null);
        setError(err instanceof Error ? err.message : 'Unable to load stock flashcard');
      } finally {
        setLoading(false);
      }
    },
    [ticker],
  );

  useEffect(() => {
    setActiveTab('summary');
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handlePeriodChange = (periodId: string) => {
    if (periodId === selectedPeriodId) return;
    setSelectedPeriodId(periodId);
    void loadData(periodId);
  };

  const renderActivePage = () => {
    if (!data) return null;

    if (activeTab === 'summary') {
      return (
        <div className="space-y-5">
          <SummaryHighlights highlights={data.summary.highlights} />
          <div className="grid gap-4 xl:grid-cols-3">
            {data.summary.cards.map((card) => (
              <SummaryCardPanel key={card.id} card={card} />
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'valuation') {
      return (
        <MetricPage
          title="Valuation"
          subtitle="Price multiple, cash-yield, and relative valuation measures for the selected period."
          metrics={data.metrics.valuation}
        />
      );
    }

    if (activeTab === 'quality') {
      return (
        <MetricPage
          title="Quality"
          subtitle="Profitability, growth, and cash-conversion measures that show how strong the business engine is."
          metrics={data.metrics.quality}
        />
      );
    }

    return (
      <MetricPage
        title="Risk"
        subtitle="Cash flow resilience, leverage, coverage, and capital return metrics that frame downside exposure."
        metrics={data.metrics.risk}
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,23,0.74)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border bg-slate-950 shadow-2xl shadow-black/50"
        style={{ borderColor: `${accent}33` }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950/75 text-slate-400 transition-colors hover:text-white"
        >
          <X size={18} />
        </button>

        <CompanyBanner
          name={data?.name ?? entityName}
          ticker={ticker}
          sector={data?.sector ?? entitySector}
          exchange={data?.exchange ?? null}
          industry={data?.industry ?? null}
          price={data?.price ?? null}
          priceChange={data?.priceChange ?? null}
          priceChangePct={data?.priceChangePct ?? null}
        />

        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          {loading && !data ? (
            <div className="flex h-56 items-center justify-center">
              <div
                className="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-transparent"
                style={{ borderTopColor: accent }}
              />
            </div>
          ) : null}

          {error && !data ? (
            <div className="rounded-3xl border border-rose-500/25 bg-rose-500/10 px-6 py-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-300">No stock flashcard data</p>
              <p className="mt-4 text-2xl font-semibold text-white">{ticker}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
              <p className="mt-4 text-sm text-slate-400">
                If this stock was just imported, run the market sync so the flashcard can read the latest company metrics.
              </p>
            </div>
          ) : null}

          {data ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <FlashcardTabs activeTab={activeTab} onChange={setActiveTab} accent={accent} />
                {selectedPeriodId ? (
                  <PeriodPicker
                    periods={data.availablePeriods}
                    selectedId={selectedPeriodId}
                    onChange={handlePeriodChange}
                  />
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/35 px-4 py-3 text-sm text-slate-400">
                Showing <span className="font-semibold text-slate-100">{data.selectedPeriod.label}</span>
                {data.selectedPeriod.endDate ? (
                  <span className="text-slate-500"> | {data.selectedPeriod.endDate}</span>
                ) : null}
              </div>

              {renderActivePage()}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
