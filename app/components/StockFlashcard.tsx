'use client';

/**
 * StockFlashcard — NexaTech-style single-card modal.
 *
 * Light theme, single white card with:
 *   • Header: gradient avatar + company name + ticker pill + market status
 *   • Large price + signed % change with arrow
 *   • Optional sparkline chart on the right
 *   • 2-col metric grid (8 metrics) with circular icon badges
 *   • Footer with period info
 */

import { useEffect, useState, useCallback } from 'react';
import type { FlashcardResponse, MetricItem, PeriodInfo } from '@/app/api/stocks/[ticker]/flashcard/route';

// ── Color palette ──────────────────────────────────────────────────────────────
const C = {
  cardBg:     '#ffffff',
  pageBg:     '#f7f8fa',
  text:       '#0f172a',
  textMuted:  '#64748b',
  textFaint:  '#94a3b8',
  divider:    '#f1f5f9',
  green:      '#16a34a',
  greenBg:    '#dcfce7',
  greenIcon:  '#22c55e',
  red:        '#dc2626',
  redBg:      '#fee2e2',
  blue:       '#3b82f6',
  blueBg:     '#eff6ff',
  amber:      '#f59e0b',
  amberBg:    '#fef3c7',
  purple:     '#8b5cf6',
  purpleBg:   '#ede9fe',
  pink:       '#ec4899',
  pinkBg:     '#fce7f3',
};

// ── Gradient avatar by initial ────────────────────────────────────────────────
const GRADS: Record<string, string> = {
  A: 'linear-gradient(135deg,#6366f1,#8b5cf6)', B: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
  C: 'linear-gradient(135deg,#10b981,#3b82f6)', D: 'linear-gradient(135deg,#f59e0b,#ef4444)',
  E: 'linear-gradient(135deg,#8b5cf6,#ec4899)', F: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
  G: 'linear-gradient(135deg,#10b981,#6366f1)', H: 'linear-gradient(135deg,#f97316,#ef4444)',
  I: 'linear-gradient(135deg,#6366f1,#3b82f6)', J: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
  K: 'linear-gradient(135deg,#14b8a6,#06b6d4)', L: 'linear-gradient(135deg,#84cc16,#10b981)',
  M: 'linear-gradient(135deg,#3b82f6,#6366f1)', N: 'linear-gradient(135deg,#10b981,#06b6d4)',
  O: 'linear-gradient(135deg,#f59e0b,#f97316)', P: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
  Q: 'linear-gradient(135deg,#06b6d4,#10b981)', R: 'linear-gradient(135deg,#ef4444,#f97316)',
  S: 'linear-gradient(135deg,#6366f1,#8b5cf6)', T: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
  U: 'linear-gradient(135deg,#10b981,#84cc16)', V: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
  W: 'linear-gradient(135deg,#f59e0b,#ef4444)', X: 'linear-gradient(135deg,#06b6d4,#6366f1)',
  Y: 'linear-gradient(135deg,#ec4899,#f97316)', Z: 'linear-gradient(135deg,#14b8a6,#3b82f6)',
};

// ── Metric → icon + color mapping ─────────────────────────────────────────────
interface MetricSlot {
  code: string;
  label: string;
  icon: string;        // Material Symbol name
  iconColor: string;
  iconBg: string;
}

const METRIC_SLOTS: MetricSlot[] = [
  { code: 'market_cap',                label: 'Market Cap',       icon: 'paid',                  iconColor: C.greenIcon, iconBg: C.greenBg },
  { code: 'valuation_pe',              label: 'P/E Ratio',        icon: 'trending_up',           iconColor: C.blue,      iconBg: C.blueBg },
  { code: 'quality_revenue_growth',    label: 'Revenue Growth',   icon: 'bar_chart',             iconColor: C.greenIcon, iconBg: C.greenBg },
  { code: 'quality_operating_margin',  label: 'Operating Margin', icon: 'donut_small',           iconColor: C.blue,      iconBg: C.blueBg },
  { code: 'quality_roe',               label: 'ROE',              icon: 'shield',                iconColor: C.blue,      iconBg: C.blueBg },
  { code: 'valuation_fcf_yield',       label: 'FCF Yield',        icon: 'account_balance_wallet',iconColor: C.greenIcon, iconBg: C.greenBg },
  { code: 'risk_net_debt_ebitda',      label: 'Net Debt/EBITDA',  icon: 'balance',               iconColor: C.purple,    iconBg: C.purpleBg },
  { code: 'week52_range',              label: '52W Range',        icon: 'calendar_month',        iconColor: C.blue,      iconBg: C.blueBg },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function findMetric(data: FlashcardResponse | null, code: string): MetricItem | null {
  if (!data) return null;
  return [...data.metrics.valuation, ...data.metrics.quality, ...data.metrics.risk]
    .find(m => m.code === code) ?? null;
}

function formatMetricValue(slot: MetricSlot, data: FlashcardResponse | null): { value: string; color?: string } {
  if (!data) return { value: '—' };

  // Special cases not in the metrics arrays
  if (slot.code === 'market_cap') {
    // Market cap isn't in the new schema response — show '—' for now
    return { value: '—' };
  }
  if (slot.code === 'week52_range') {
    return { value: '—' };
  }

  const m = findMetric(data, slot.code);
  if (!m) return { value: '—' };

  // Color positive growth metrics green
  let color: string | undefined;
  if (slot.code === 'quality_revenue_growth' && m.numericValue != null) {
    color = m.numericValue >= 0 ? C.green : C.red;
  }
  return { value: m.displayValue, color };
}

// ── Sparkline (placeholder line chart) ────────────────────────────────────────
function Sparkline({ up }: { up: boolean }) {
  const stroke = up ? C.green : C.red;
  // Synthetic upward/downward path
  const path = up
    ? 'M0,40 L10,38 L20,42 L30,35 L40,30 L50,28 L60,32 L70,22 L80,18 L90,15 L100,8 L110,12 L120,5'
    : 'M0,8 L10,12 L20,5 L30,15 L40,18 L50,22 L60,30 L70,28 L80,35 L90,38 L100,42 L110,40 L120,45';
  return (
    <svg viewBox="0 0 120 50" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L120,50 L0,50 Z`} fill="url(#spark-grad)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="120" cy={up ? 5 : 45} r="3" fill={stroke} />
    </svg>
  );
}

// ── Metric tile ────────────────────────────────────────────────────────────────
function MetricTile({ slot, data }: { slot: MetricSlot; data: FlashcardResponse | null }) {
  const { value, color } = formatMetricValue(slot, data);
  return (
    <div style={{
      background: C.pageBg, borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', background: slot.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: slot.iconColor }}>
          {slot.icon}
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>
          {slot.label}
        </div>
        <div style={{
          fontSize: 18, fontWeight: 800, color: color ?? C.text,
          fontFamily: 'Manrope, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </div>
      </div>
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

  const initial = ticker.charAt(0).toUpperCase();
  const grad    = GRADS[initial] ?? GRADS['A'];
  const priceUp = (data?.priceChangePct ?? 0) >= 0;
  const sector  = data?.sector ?? entitySector;

  const formattedDate = data?.selectedPeriod.endDate
    ? new Date(data.selectedPeriod.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      {/* Card */}
      <article
        className="relative rounded-3xl overflow-hidden"
        style={{
          width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
          background: C.cardBg,
          boxShadow: '0 24px 80px -16px rgba(0,0,0,0.25), 0 8px 32px -8px rgba(0,0,0,0.15)',
          padding: '28px 28px 24px',
          fontFamily: 'Inter, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Close button ── */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: '#f1f5f9', color: C.textMuted, border: 'none', cursor: 'pointer', zIndex: 2 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>

        {loading && (
          <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: `3px solid ${C.divider}`, borderTopColor: C.blue,
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: C.red }}>error</span>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: C.text, fontSize: 16 }}>
              No data for {ticker}
            </p>
            <p style={{ fontSize: 12, color: C.textMuted, maxWidth: 280, lineHeight: 1.5 }}>
              This stock may not be in the market library yet, or stats haven&apos;t been fetched.
            </p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
              {/* Avatar */}
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: grad, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 24,
                fontFamily: 'Manrope, sans-serif',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>{initial}</div>

              {/* Name + ticker */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22,
                  color: C.text, lineHeight: 1.15, marginBottom: 6,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {data.name ?? entityName}
                </div>
                <span style={{
                  display: 'inline-block',
                  background: C.blueBg, color: C.blue,
                  borderRadius: 999, padding: '3px 12px',
                  fontSize: 11, fontWeight: 700,
                  fontFamily: 'Inter, sans-serif',
                }}>{ticker}</span>
              </div>

              {/* Market status pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: C.greenBg, color: C.green,
                borderRadius: 999, padding: '4px 10px',
                fontSize: 11, fontWeight: 600, marginRight: 28,
                fontFamily: 'Inter, sans-serif',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenIcon }} />
                Market Open
              </div>
            </div>

            {/* ── Price + Sparkline row ── */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
              {/* Price + change */}
              <div>
                <div style={{
                  fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 38,
                  color: C.text, lineHeight: 1, letterSpacing: '-0.02em',
                }}>
                  {data.price != null ? `$${data.price.toFixed(2)}` : '—'}
                </div>
                {data.priceChangePct != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      width: 24, height: 24, borderRadius: '50%',
                      border: `2px solid ${priceUp ? C.green : C.red}`,
                      color: priceUp ? C.green : C.red, justifyContent: 'center',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, fontWeight: 700 }}>
                        {priceUp ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18,
                      color: priceUp ? C.green : C.red,
                    }}>
                      {priceUp ? '+' : ''}{data.priceChangePct.toFixed(2)}%
                    </span>
                    <span style={{ fontSize: 13, color: C.textFaint, fontFamily: 'Inter, sans-serif' }}>Today</span>
                  </div>
                )}
              </div>

              {/* Sparkline */}
              <div style={{ width: 140, height: 60, flexShrink: 0 }}>
                <Sparkline up={priceUp} />
              </div>
            </div>

            {/* ── Metric grid 2 cols × 4 rows ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              marginBottom: 18,
            }}>
              {METRIC_SLOTS.map(slot => (
                <MetricTile key={slot.code} slot={slot} data={data} />
              ))}
            </div>

            {/* ── Period picker (if multiple) ── */}
            {data.availablePeriods.length > 1 && selPeriodId && (
              <div style={{ marginBottom: 14 }}>
                <select
                  value={selPeriodId}
                  onChange={e => { setSelPeriodId(e.target.value); loadData(e.target.value); }}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 10,
                    border: `1px solid ${C.divider}`, background: C.pageBg,
                    color: C.text, fontSize: 12, fontFamily: 'Inter, sans-serif',
                    outline: 'none', cursor: 'pointer',
                  }}
                >
                  {data.availablePeriods.map((p: PeriodInfo) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{p.endDate ? ` — ${p.endDate.slice(0, 7)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Footer ── */}
            <div style={{
              textAlign: 'center', fontSize: 12, color: C.textFaint,
              fontFamily: 'Inter, sans-serif',
              borderTop: `1px solid ${C.divider}`, paddingTop: 14,
            }}>
              {[
                formattedDate ? `Data as of ${formattedDate}` : null,
                sector,
              ].filter(Boolean).join(' • ')}
              {!formattedDate && !sector && 'Latest available'}
              <span style={{ display: 'inline-block', margin: '0 6px' }}>•</span>
              <span style={{ color: C.textMuted }}>Delayed 15 min</span>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
