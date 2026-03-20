'use client';

/**
 * StockFlashcard — 5-page educational stock analysis modal.
 *
 * Opens when a user double-clicks a stock entity (entityKind === 'stock').
 * Pages:
 *   1. Summary       — price, fair value, quality/health score, 3-line thesis
 *   2. Valuation     — PE history, peer bar chart, historical percentile
 *   3. Fin. Health   — OCF/FCF trends, ratios, traffic-light signals
 *   4. Earnings      — margins, ROE, history bars, insights
 *   5. Macro Risk    — sensitivity matrix by macro factor
 */

import { useEffect, useState, useCallback } from 'react';
import type { FlashcardResponse } from '@/app/api/stocks/[ticker]/flashcard/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, prefix = '', suffix = '', decimals = 1): string {
  if (v == null) return '—';
  return `${prefix}${v.toFixed(decimals)}${suffix}`;
}

function fmtBig(v: number | null | undefined): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(decimals)}%`;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#3B82F6', 'Communication Services': '#06B6D4',
  'Consumer Discretionary': '#F59E0B', 'Consumer Staples': '#10B981',
  'Healthcare': '#EC4899', 'Financials': '#F97316',
  'Industrials': '#8B5CF6', 'Energy': '#EF4444',
  'Materials': '#6366F1', 'Real Estate': '#14B8A6', 'Utilities': '#84CC16',
};

function sectorColor(sector: string | null) {
  return SECTOR_COLORS[sector ?? ''] ?? '#6B7280';
}

// Signal / sensitivity colour coding
function signalColor(s: string) {
  if (s === 'Strong' || s === 'Consistent') return '#10B981';
  if (s === 'Average' || s === 'Volatile')  return '#F59E0B';
  return '#EF4444';
}

function sensitivityColor(s: string) {
  if (s === 'High')   return '#EF4444';
  if (s === 'Medium') return '#F59E0B';
  return '#10B981';
}

function directionColor(d: string) {
  if (d === 'Positive') return '#10B981';
  if (d === 'Negative') return '#EF4444';
  return '#6B7280';
}

// ── Inline SVG Charts ─────────────────────────────────────────────────────────

interface BarPoint { period: string; value: number }

function BarChart({ data, color = '#3B82F6', height = 90 }: { data: BarPoint[]; color?: string; height?: number }) {
  if (!data.length) return <p className="text-xs text-gray-500">No data</p>;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 1);
  const range = max - min || 1;
  const barW = Math.max(10, Math.floor(320 / data.length) - 4);

  return (
    <svg width="100%" viewBox={`0 0 ${data.length * (barW + 4)} ${height + 20}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barH = Math.max(2, ((d.value - min) / range) * height);
        const y = height - barH;
        const x = i * (barW + 4);
        const isNeg = d.value < 0;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={isNeg ? '#EF4444' : color} rx={2} opacity={0.85} />
            <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize={8} fill="#9CA3AF">
              {d.period.slice(2)}
            </text>
          </g>
        );
      })}
      {/* zero line */}
      <line
        x1={0} y1={height - ((0 - min) / range) * height}
        x2={data.length * (barW + 4)} y2={height - ((0 - min) / range) * height}
        stroke="#374151" strokeWidth={1}
      />
    </svg>
  );
}

function LineChart({ data, color = '#3B82F6', height = 90 }: { data: BarPoint[]; color?: string; height?: number }) {
  if (data.length < 2) return <p className="text-xs text-gray-500">Not enough data</p>;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 300;
  const step = W / (data.length - 1);

  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d.value - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(' ');

  // Area fill
  const firstX = 0;
  const lastX = (data.length - 1) * step;
  const baseY = height - 5;
  const areaPoints = `${firstX},${baseY} ${points} ${lastX},${baseY}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height + 14}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`area-grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#area-grad-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {/* dots */}
      {data.map((d, i) => {
        const x = i * step;
        const y = height - ((d.value - min) / range) * (height - 10) - 5;
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
      })}
      {/* x labels — only first, middle, last */}
      {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
        <text key={i} x={i * step} y={height + 12} textAnchor="middle" fontSize={8} fill="#9CA3AF">
          {data[i].period.slice(2)}
        </text>
      ))}
    </svg>
  );
}

function PeerBarChart({ peers, currentPE }: { peers: { name: string; ticker: string; pe: number }[]; currentPE: number | null }) {
  const all = currentPE != null
    ? [{ name: 'This Stock', ticker: '★', pe: currentPE }, ...peers]
    : peers;
  if (!all.length) return <p className="text-xs text-gray-500">No peers found</p>;
  const max = Math.max(...all.map(p => p.pe), 1);
  return (
    <div className="space-y-1">
      {all.map((p, i) => {
        const isCurrent = p.ticker === '★';
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-16 truncate text-right">{p.ticker}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-4 relative overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(p.pe / max) * 100}%`,
                  background: isCurrent ? '#F59E0B' : '#3B82F6',
                  opacity: isCurrent ? 1 : 0.7,
                }}
              />
            </div>
            <span className="text-[10px] w-12 text-right" style={{ color: isCurrent ? '#F59E0B' : '#9CA3AF' }}>
              {p.pe.toFixed(1)}x
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ score, max = 10, color }: { score: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(score / max) * 100}%`, background: color }}
        />
      </div>
      <span className="text-sm font-bold" style={{ color }}>{score}/{max}</span>
    </div>
  );
}

function TrafficLight({ label, value, signal }: { label: string; value?: string; signal: string }) {
  const color = signalColor(signal);
  const dot = signal === 'Strong' || signal === 'Consistent' ? '●' : signal === 'Average' || signal === 'Volatile' ? '◑' : '○';
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-400">{value}</span>}
        <span style={{ color }} className="text-base">{dot}</span>
        <span className="text-xs font-semibold" style={{ color }}>{signal}</span>
      </div>
    </div>
  );
}

// ── Banner ─────────────────────────────────────────────────────────────────────

function CompanyBanner({ name, ticker, sector, exchange }: {
  name: string; ticker: string; sector: string | null; exchange: string;
}) {
  const color = sectorColor(sector);
  const SECTOR_ICONS: Record<string, string> = {
    'Technology': '💻', 'Communication Services': '📺', 'Consumer Discretionary': '🛒',
    'Consumer Staples': '🛒', 'Healthcare': '🏥', 'Financials': '💰',
    'Industrials': '🏭', 'Energy': '⚡', 'Materials': '⛏️', 'Real Estate': '🏗️',
    'Utilities': '🔋',
  };
  const icon = SECTOR_ICONS[sector ?? ''] ?? '🏢';

  return (
    <div
      className="relative flex items-end px-6 pb-4 pt-8 rounded-t-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, #111827 100%)`,
        borderBottom: `2px solid ${color}44`,
        minHeight: '96px',
      }}
    >
      {/* decorative accent */}
      <div
        className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 -translate-y-1/2 translate-x-1/4"
        style={{ background: color }}
      />
      <div className="flex items-center gap-4 relative z-10">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
          style={{ background: `${color}33`, border: `1px solid ${color}55` }}
        >
          {icon}
        </div>
        <div>
          <p className="text-lg font-bold text-white leading-tight">{name}</p>
          <p className="text-sm text-gray-400">{ticker} · {exchange}{sector ? ` · ${sector}` : ''}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page components ───────────────────────────────────────────────────────────

function Page1Summary({ data, color }: { data: FlashcardResponse; color: string }) {
  const { summary } = data;
  const priceUp = (summary.priceChangePct ?? 0) >= 0;

  return (
    <div className="space-y-5">
      {/* Price row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold text-white">{fmt(summary.currentPrice, '$', '', 2)}</p>
          <p className={`text-sm font-medium mt-0.5 ${priceUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {priceUp ? '▲' : '▼'} {fmt(summary.priceChange, '$', '', 2)} ({fmt(summary.priceChangePct, '', '%', 2)}) today
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Est. Fair Value</p>
          <p className="text-xl font-bold text-yellow-400">{fmt(summary.estimatedFairValue, '$', '', 2)}</p>
          {summary.discountPct != null && (
            <p className={`text-xs font-semibold mt-0.5 ${summary.discountPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {summary.discountPct >= 0
                ? `${summary.discountPct.toFixed(1)}% discount`
                : `${Math.abs(summary.discountPct).toFixed(1)}% premium`}
            </p>
          )}
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Quality Score</p>
          <ScoreBar score={summary.qualityScore} color={summary.qualityScore >= 7 ? '#10B981' : summary.qualityScore >= 4 ? '#F59E0B' : '#EF4444'} />
          <p className="text-[10px] text-gray-500 mt-1">Growth · Margins · FCF</p>
        </div>
        <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Health Score</p>
          <ScoreBar score={summary.healthScore} color={summary.healthScore >= 7 ? '#10B981' : summary.healthScore >= 4 ? '#F59E0B' : '#EF4444'} />
          <p className="text-[10px] text-gray-500 mt-1">Liquidity · Debt · Cash</p>
        </div>
      </div>

      {/* Macro sensitivity pill */}
      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-400">Macro Sensitivity:</p>
        <span
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{ background: `${sensitivityColor(summary.macroSensitivity)}22`, color: sensitivityColor(summary.macroSensitivity), border: `1px solid ${sensitivityColor(summary.macroSensitivity)}44` }}
        >
          {summary.macroSensitivity}
        </span>
      </div>

      {/* Summary lines */}
      <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700 space-y-2">
        {summary.summaryLines.map((line, i) => (
          <div key={i} className="flex items-start gap-2">
            <span style={{ color }} className="mt-0.5 text-sm">•</span>
            <p className="text-sm text-gray-300 leading-snug">{line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Page2Valuation({ data, color }: { data: FlashcardResponse; color: string }) {
  const { valuation } = data;
  const pctLabel = valuation.historicalPercentile != null
    ? `${valuation.historicalPercentile.toFixed(0)}th percentile of its own history`
    : null;

  return (
    <div className="space-y-5">
      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Current P/E', value: fmt(valuation.currentPE, '', 'x', 1) },
          { label: '5-Yr Avg P/E', value: fmt(valuation.fiveYearAvgPE, '', 'x', 1) },
          { label: 'Sector Avg P/E', value: fmt(valuation.industryAvgPE, '', 'x', 1) },
          { label: 'Current P/B', value: fmt(valuation.currentPB, '', 'x', 2) },
        ].map(item => (
          <div key={item.label} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight">{item.label}</p>
            <p className="text-lg font-bold text-white mt-1">{item.value}</p>
          </div>
        ))}
        {pctLabel && (
          <div className="col-span-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
            <p className="text-xs text-yellow-400 font-semibold">{pctLabel}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {(valuation.historicalPercentile ?? 50) <= 30
                ? 'Currently in the cheaper end of its historical range'
                : (valuation.historicalPercentile ?? 50) >= 70
                ? 'Trading at a historically elevated valuation'
                : 'Trading close to its historical average'}
            </p>
          </div>
        )}
      </div>

      {/* PE history line chart */}
      {valuation.peHistory.length >= 2 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">P/E Ratio History</p>
          <LineChart data={valuation.peHistory} color={color} height={80} />
        </div>
      )}

      {/* Peer comparison */}
      {valuation.peers.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Peer P/E Comparison</p>
          <PeerBarChart peers={valuation.peers} currentPE={valuation.currentPE} />
        </div>
      )}
    </div>
  );
}

function Page3Health({ data }: { data: FlashcardResponse }) {
  const { health } = data;

  return (
    <div className="space-y-5">
      {/* Ratio grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Current Ratio', value: fmt(health.currentRatio, '', 'x', 2) },
          { label: 'Debt / Equity', value: fmt(health.debtToEquity, '', 'x', 2) },
          { label: 'Latest FCF', value: fmtBig(health.latestFCF) },
          { label: 'Latest OCF', value: fmtBig(health.latestOCF) },
        ].map(item => (
          <div key={item.label} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{item.label}</p>
            <p className="text-base font-bold text-white mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Traffic lights */}
      <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Health Signals</p>
        <TrafficLight label="Interest Coverage" signal={health.signals.interestCoverage} />
        <TrafficLight label="Net Debt / EBITDA" signal={health.signals.netDebtEBITDA} />
        <TrafficLight label="5-Yr FCF Trend" signal={health.signals.fcfConsistency} />
        <TrafficLight label="Short-Term Liquidity" signal={health.signals.liquidity} />
      </div>

      {/* FCF trend chart */}
      {health.fcfTrend.length >= 2 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Free Cash Flow Trend</p>
          <BarChart data={health.fcfTrend} color="#10B981" height={80} />
        </div>
      )}
    </div>
  );
}

function Page4Earnings({ data }: { data: FlashcardResponse }) {
  const { earnings } = data;

  return (
    <div className="space-y-5">
      {/* Key ratios */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Revenue Growth', value: fmtPct(earnings.revenueGrowth), positive: (earnings.revenueGrowth ?? 0) >= 0 },
          { label: 'Op. Margin', value: fmt(earnings.operatingMargin != null ? earnings.operatingMargin * 100 : null, '', '%', 1), positive: (earnings.operatingMargin ?? 0) >= 0.10 },
          { label: 'ROE', value: fmt(earnings.roe != null ? earnings.roe * 100 : null, '', '%', 1), positive: (earnings.roe ?? 0) >= 0.10 },
          { label: 'FCF Margin', value: fmt(earnings.fcfMargin != null ? earnings.fcfMargin * 100 : null, '', '%', 1), positive: (earnings.fcfMargin ?? 0) >= 0 },
          { label: 'CFO / Net Inc.', value: fmt(earnings.cfoToNetIncomeRatio, '', 'x', 2), positive: (earnings.cfoToNetIncomeRatio ?? 0) >= 0.8 },
        ].map(item => (
          <div key={item.label} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight">{item.label}</p>
            <p className={`text-base font-bold mt-1 ${item.positive ? 'text-emerald-400' : 'text-red-400'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue history bar chart */}
      {earnings.history.length >= 2 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Revenue History</p>
          <BarChart
            data={earnings.history.filter(h => h.revenue != null).map(h => ({ period: h.period, value: h.revenue as number }))}
            color="#3B82F6"
            height={75}
          />
        </div>
      )}

      {/* Insights */}
      {earnings.insights.length > 0 && (
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700 space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Earnings Insights</p>
          {earnings.insights.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-yellow-500 mt-0.5 text-sm">→</span>
              <p className="text-sm text-gray-300 leading-snug">{line}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Page5Macro({ data }: { data: FlashcardResponse }) {
  const { macro } = data;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400 leading-relaxed">
        How does this stock react to major macro changes? Each factor is rated by historical sensitivity for this sector.
      </p>

      <div className="space-y-2">
        {macro.factors.map((f, i) => (
          <div key={i} className="bg-gray-800/40 rounded-xl p-3 border border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white">{f.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${sensitivityColor(f.sensitivity)}22`, color: sensitivityColor(f.sensitivity) }}
                >
                  {f.sensitivity}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${directionColor(f.direction)}22`, color: directionColor(f.direction) }}
                >
                  {f.direction}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 leading-snug">{f.note}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-500 italic">{macro.basis}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  ticker: string;
  entityName: string;
  entitySector: string | null;
  onClose: () => void;
}

const PAGE_LABELS = ['Summary', 'Valuation', 'Fin. Health', 'Earnings', 'Macro Risk'];

export default function StockFlashcard({ ticker, entityName, entitySector, onClose }: Props) {
  const [data, setData]         = useState<FlashcardResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [page, setPage]         = useState(0);

  const color = sectorColor(entitySector);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/stocks/${encodeURIComponent(ticker)}/flashcard`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: FlashcardResponse) => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [ticker]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape')     onClose();
    if (e.key === 'ArrowRight') setPage(p => Math.min(p + 1, PAGE_LABELS.length - 1));
    if (e.key === 'ArrowLeft')  setPage(p => Math.max(p - 1, 0));
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Card */}
      <div
        className="relative w-full max-w-lg bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh', border: `1px solid ${color}33` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
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
          exchange={data?.exchange ?? ''}
        />

        {/* Page tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-gray-800">
          {PAGE_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`text-[11px] font-semibold px-3 py-2 rounded-t-lg transition-colors flex-1 truncate ${
                page === i
                  ? 'text-white border-b-2'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              style={page === i ? { borderColor: color, color } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5" style={{ minHeight: 0 }}>
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: color }} />
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm text-center py-10">
              <p className="text-2xl mb-2">⚠️</p>
              <p>Could not load data for {ticker}</p>
              <p className="text-xs text-gray-500 mt-1">{error}</p>
              <p className="text-xs text-gray-500 mt-2">Run seed-markets to populate stock data first.</p>
            </div>
          )}
          {!loading && !error && data && (
            <>
              {page === 0 && <Page1Summary data={data} color={color} />}
              {page === 1 && <Page2Valuation data={data} color={color} />}
              {page === 2 && <Page3Health data={data} />}
              {page === 3 && <Page4Earnings data={data} />}
              {page === 4 && <Page5Macro data={data} />}
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 bg-gray-900/80">
          <button
            onClick={() => setPage(p => Math.max(p - 1, 0))}
            disabled={page === 0}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            ← {page > 0 ? PAGE_LABELS[page - 1] : ''}
          </button>

          {/* Dot indicators */}
          <div className="flex gap-1.5">
            {PAGE_LABELS.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: i === page ? color : '#374151' }}
              />
            ))}
          </div>

          <button
            onClick={() => setPage(p => Math.min(p + 1, PAGE_LABELS.length - 1))}
            disabled={page === PAGE_LABELS.length - 1}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            {page < PAGE_LABELS.length - 1 ? PAGE_LABELS[page + 1] : ''} →
          </button>
        </div>
      </div>
    </div>
  );
}
