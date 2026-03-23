'use client';

/**
 * /stocks/[ticker]
 *
 * Stock fundamentals detail page. Fetches:
 *   • Live quote          → /api/stocks/[ticker]
 *   • Historical metrics  → /api/financials/[ticker]  (fin_* tables)
 *
 * Layout:
 *   Header  – company name, ticker badge, live price + change
 *   Cards   – latest Valuation / Quality / Risk snapshot
 *   Tables  – last 10 quarters for each metric category
 *
 * Overrides body overflow:hidden (set globally for the canvas app)
 * so this page can scroll normally.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveQuote {
  price:       number;
  change:      number;
  changePct:   number;
  marketCap:   string;
  peRatio:     string;
  week52Low:   number;
  week52High:  number;
  currency:    string;
  shortName:   string;
}

interface FinStockInfo {
  ticker:       string;
  company_name: string;
  exchange:     string;
  sector:       string | null;
}

interface FinValuationRow {
  reported_at:          string;
  event_type:           string;
  per:                  number | null;
  pbr:                  number | null;
  ev_ebit:              number | null;
  fcf_yield:            number | null;
  valuation_percentile: number | null;
}

interface FinQualityRow {
  reported_at:      string;
  event_type:       string;
  revenue_growth:   number | null;
  operating_margin: number | null;
  roe:              number | null;
  roic:             number | null;
  cfo_net_income:   number | null;
}

interface FinRiskRow {
  reported_at:       string;
  event_type:        string;
  fcf:               number | null;
  net_debt_ebitda:   number | null;
  interest_coverage: number | null;
  cash_short_debt:   number | null;
  shareholder_yield: number | null;
}

interface Financials {
  stockInfo: FinStockInfo | null;
  valuation: FinValuationRow[];
  quality:   FinQualityRow[];
  risk:      FinRiskRow[];
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, decimals = 2, suffix = ''): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

function fmtFcf(v: number | null | undefined): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

function quarterLabel(isoDate: string): string {
  // event_type is already like "Q3_2024" from fin_time — use it directly
  return isoDate;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'neutral';
}) {
  const accentColor =
    accent === 'green'   ? '#22c55e' :
    accent === 'red'     ? '#ef4444' :
    'var(--accent-cyan)';

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      padding: '14px 18px',
      minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accentColor }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionTable({
  title,
  color,
  headers,
  rows,
}: {
  title: string;
  color: string;
  headers: string[];
  rows: (string | null)[][];
}) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 24,
    }}>
      <div style={{
        padding: '12px 20px',
        borderBottom: `2px solid ${color}`,
        background: 'var(--bg-panel)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{ width: 4, height: 16, borderRadius: 2, background: color }} />
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-panel)' }}>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '8px 16px',
                  textAlign: i === 0 ? 'left' : 'right',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{
                borderTop: '1px solid var(--border-color)',
                background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '8px 16px',
                    textAlign: ci === 0 ? 'left' : 'right',
                    color: cell === '—' ? 'var(--text-secondary)' : 'var(--text-primary)',
                    fontWeight: ci === 0 ? 500 : 400,
                    whiteSpace: 'nowrap',
                  }}>
                    {cell ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StockFundamentalsPage() {
  const { data: session, status } = useSession();
  const params  = useParams();
  const router  = useRouter();
  const ticker  = (params?.ticker as string ?? '').toUpperCase();

  const [quote,      setQuote]      = useState<LiveQuote | null>(null);
  const [financials, setFinancials] = useState<Financials | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  useEffect(() => {
    // Override the body overflow:hidden that the canvas app sets globally
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!ticker || status !== 'authenticated') return;

    setLoading(true);
    setError('');

    Promise.all([
      fetch(`/api/stocks/${ticker}`).then(r => r.json()),
      fetch(`/api/financials/${ticker}`).then(r => r.json()),
    ])
      .then(([q, f]) => {
        if (q.error)  setQuote(null);
        else          setQuote(q as LiveQuote);

        if (f.error)  setError(f.error);
        else          setFinancials(f as Financials);
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, [ticker, status]);

  // ── Auth guard ──────────────────────────────────────────────────────────────

  if (status === 'loading' || (status === 'unauthenticated')) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
      }}>
        {status === 'loading' ? 'Loading...' : 'Redirecting to login...'}
      </div>
    );
  }

  const isUp   = (quote?.change ?? 0) >= 0;
  const latest = {
    valuation: financials?.valuation[0],
    quality:   financials?.quality[0],
    risk:      financials?.risk[0],
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* ── Sticky top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link href="/" style={{
          color: 'var(--text-secondary)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
        }}>
          <ArrowLeft size={14} /> Back to Map
        </Link>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent-cyan)' }}>{ticker}</span>
        {financials?.stockInfo?.company_name && (
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {financials.stockInfo.company_name}
          </span>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── Loading / Error states ── */}
        {loading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, color: 'var(--text-secondary)', paddingTop: 80,
          }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Loading fundamentals for {ticker}...
          </div>
        )}

        {!loading && error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444',
            borderRadius: 10, padding: '16px 20px', color: '#fca5a5',
          }}>
            {error}
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-secondary)' }}>
              Make sure this ticker has been seeded: <code>python scripts/seed_financials.py --ticker {ticker}</code>
            </div>
          </div>
        )}

        {!loading && !error && financials && (
          <>
            {/* ── Header: price + info ── */}
            <div style={{
              display: 'flex', alignItems: 'flex-start',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
              marginBottom: 28,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800 }}>
                    {financials.stockInfo?.company_name ?? ticker}
                  </h1>
                  <span style={{
                    background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                    borderRadius: 6, padding: '2px 10px', fontSize: 13, fontWeight: 600,
                    color: 'var(--accent-cyan)',
                  }}>
                    {ticker}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {[financials.stockInfo?.exchange, financials.stockInfo?.sector]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>

              {quote && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 32, fontWeight: 800 }}>
                    {quote.currency === 'USD' ? '$' : ''}{quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    justifyContent: 'flex-end', marginTop: 2,
                    color: isUp ? '#22c55e' : '#ef4444', fontSize: 14,
                  }}>
                    {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {isUp ? '+' : ''}{quote.change.toFixed(2)} ({isUp ? '+' : ''}{quote.changePct.toFixed(2)}%)
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    52W: ${quote.week52Low.toFixed(2)} – ${quote.week52High.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* ── Latest snapshot cards ── */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
              {/* Valuation */}
              <MetricCard label="P/E Ratio"   value={fmt(latest.valuation?.per, 1, 'x')} />
              <MetricCard label="P/B Ratio"   value={fmt(latest.valuation?.pbr, 2, 'x')} />
              <MetricCard label="EV/EBIT"     value={fmt(latest.valuation?.ev_ebit, 1, 'x')} />
              <MetricCard label="FCF Yield"   value={fmt(latest.valuation?.fcf_yield, 2, '%')}
                accent={
                  (latest.valuation?.fcf_yield ?? 0) >= 4 ? 'green' :
                  (latest.valuation?.fcf_yield ?? 0) < 0  ? 'red'   : 'neutral'
                }
              />
              {/* Quality */}
              <MetricCard label="Rev Growth"  value={fmt(latest.quality?.revenue_growth, 1, '%')}
                accent={
                  (latest.quality?.revenue_growth ?? 0) > 10 ? 'green' :
                  (latest.quality?.revenue_growth ?? 0) < 0  ? 'red'   : 'neutral'
                }
              />
              <MetricCard label="Op Margin"   value={fmt(latest.quality?.operating_margin, 1, '%')} />
              <MetricCard label="ROE"         value={fmt(latest.quality?.roe, 1, '%')} />
              <MetricCard label="ROIC"        value={fmt(latest.quality?.roic, 1, '%')} />
              {/* Risk */}
              <MetricCard label="Net Debt/EBITDA" value={fmt(latest.risk?.net_debt_ebitda, 2, 'x')}
                accent={
                  (latest.risk?.net_debt_ebitda ?? 0) < 2 ? 'green' :
                  (latest.risk?.net_debt_ebitda ?? 0) > 4 ? 'red'   : 'neutral'
                }
              />
              <MetricCard label="Int Coverage" value={fmt(latest.risk?.interest_coverage, 1, 'x')}
                accent={
                  (latest.risk?.interest_coverage ?? 0) > 5 ? 'green' :
                  (latest.risk?.interest_coverage ?? 0) < 2 ? 'red'   : 'neutral'
                }
              />
              <MetricCard label="Shldr Yield" value={fmt(latest.risk?.shareholder_yield, 2, '%')} />
            </div>

            {/* ── Valuation history ── */}
            <SectionTable
              title="Valuation History"
              color="#3b82f6"
              headers={['Quarter', 'P/E', 'P/B', 'EV/EBIT', 'FCF Yield %', 'Val. Pct']}
              rows={financials.valuation.map(r => [
                r.event_type,
                fmt(r.per, 1, 'x'),
                fmt(r.pbr, 2, 'x'),
                fmt(r.ev_ebit, 1, 'x'),
                fmt(r.fcf_yield, 2, '%'),
                fmt(r.valuation_percentile, 1, '%'),
              ])}
            />

            {/* ── Quality history ── */}
            <SectionTable
              title="Quality History"
              color="#06b6d4"
              headers={['Quarter', 'Rev Growth %', 'Op Margin %', 'ROE %', 'ROIC %', 'CFO/NI']}
              rows={financials.quality.map(r => [
                r.event_type,
                fmt(r.revenue_growth, 1, '%'),
                fmt(r.operating_margin, 1, '%'),
                fmt(r.roe, 1, '%'),
                fmt(r.roic, 1, '%'),
                fmt(r.cfo_net_income, 2),
              ])}
            />

            {/* ── Risk history ── */}
            <SectionTable
              title="Risk History"
              color="#f97316"
              headers={['Quarter', 'FCF', 'Net Debt/EBITDA', 'Int Coverage', 'Cash/ST Debt', 'Shldr Yield %']}
              rows={financials.risk.map(r => [
                r.event_type,
                fmtFcf(r.fcf),
                fmt(r.net_debt_ebitda, 2, 'x'),
                fmt(r.interest_coverage, 1, 'x'),
                fmt(r.cash_short_debt, 2, 'x'),
                fmt(r.shareholder_yield, 2, '%'),
              ])}
            />
          </>
        )}
      </div>

      {/* Spin animation for loading icon */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
