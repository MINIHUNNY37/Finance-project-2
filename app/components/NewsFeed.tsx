'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Newspaper, RefreshCw, ExternalLink, Clock } from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import type { NewsItem } from '../api/news/route';

interface NewsFeedProps {
  isOpen: boolean;
  onClose: () => void;
}

function timeAgo(unixSecs: number): string {
  const diffMs = Date.now() - unixSecs * 1000;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TICKER_COLORS: Record<string, string> = {};
const PALETTE = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];
let paletteIdx = 0;
function tickerColor(ticker: string): string {
  if (!TICKER_COLORS[ticker]) {
    TICKER_COLORS[ticker] = PALETTE[paletteIdx % PALETTE.length];
    paletteIdx++;
  }
  return TICKER_COLORS[ticker];
}

export default function NewsFeed({ isOpen, onClose }: NewsFeedProps) {
  const { currentMap } = useMapStore();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterTicker, setFilterTicker] = useState<string | null>(null);

  const tickers = Array.from(
    new Set(currentMap.entities.map((e) => e.ticker).filter(Boolean) as string[])
  );

  const fetchNews = useCallback(async () => {
    if (tickers.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/news?tickers=${tickers.join(',')}`);
      if (!res.ok) throw new Error('Failed to load news');
      const data = await res.json();
      setNews(data.news ?? []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(',')]);

  useEffect(() => {
    if (isOpen && tickers.length > 0) {
      fetchNews();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchNews]);

  if (!isOpen) return null;

  const displayed = filterTicker ? news.filter((n) => n.ticker === filterTicker) : news;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel fade-in" style={{
        width: '100%', maxWidth: 680, borderRadius: 16, padding: 0,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(59,130,246,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Newspaper size={18} style={{ color: '#3b82f6' }} />
            <h2 style={{ color: '#93c5fd', fontSize: 16, fontWeight: 700, margin: 0 }}>Watchlist News</h2>
            {lastUpdated && (
              <span style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} /> {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={fetchNews}
              disabled={loading || tickers.length === 0}
              title="Refresh"
              style={{
                background: 'none', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8,
                cursor: 'pointer', color: '#8899b0', padding: '4px 8px', display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {tickers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <Newspaper size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 13, margin: '0 0 6px' }}>No tickers on this map yet.</p>
              <p style={{ fontSize: 11 }}>Add a ticker to an entity in the Invest tab to see news here.</p>
            </div>
          ) : (
            <>
              {/* Ticker filter chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                <button
                  onClick={() => setFilterTicker(null)}
                  style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 10, cursor: 'pointer',
                    border: `1px solid ${filterTicker === null ? '#3b82f6' : 'rgba(59,130,246,0.2)'}`,
                    background: filterTicker === null ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: filterTicker === null ? '#93c5fd' : '#8899b0',
                    fontWeight: filterTicker === null ? 600 : 400,
                  }}
                >
                  All
                </button>
                {tickers.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterTicker(filterTicker === t ? null : t)}
                    style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 10, cursor: 'pointer', fontFamily: 'monospace',
                      border: `1px solid ${filterTicker === t ? tickerColor(t) : 'rgba(59,130,246,0.2)'}`,
                      background: filterTicker === t ? `${tickerColor(t)}20` : 'transparent',
                      color: filterTicker === t ? tickerColor(t) : '#8899b0',
                      fontWeight: filterTicker === t ? 700 : 400,
                    }}
                  >
                    ${t}
                  </button>
                ))}
              </div>

              {/* News list */}
              {loading && news.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
                  Loading news...
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#ef4444', fontSize: 12 }}>
                  {error}
                </div>
              ) : displayed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
                  No news found for {filterTicker ? `$${filterTicker}` : 'your watchlist'}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {displayed.map((item, idx) => (
                    <a
                      key={`${item.link}-${idx}`}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block', textDecoration: 'none',
                        padding: '10px 12px', borderRadius: 8,
                        border: '1px solid rgba(59,130,246,0.08)',
                        background: 'rgba(15,23,42,0.4)',
                        transition: 'background 0.12s, border-color 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.08)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.4)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.08)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 600, color: '#e2e8f0',
                            lineHeight: 1.4, marginBottom: 4,
                          }}>
                            {item.title}
                          </div>
                          {item.summary && (
                            <div style={{
                              fontSize: 10, color: '#8899b0', lineHeight: 1.4,
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                              marginBottom: 4,
                            }}>
                              {item.summary}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.ticker && (
                              <span style={{
                                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                                color: tickerColor(item.ticker),
                                background: `${tickerColor(item.ticker)}18`,
                                border: `1px solid ${tickerColor(item.ticker)}30`,
                                borderRadius: 4, padding: '1px 5px',
                              }}>
                                ${item.ticker}
                              </span>
                            )}
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>{item.publisher}</span>
                            <span style={{ fontSize: 10, color: '#8899b0' }}>·</span>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>{timeAgo(item.publishedAt)}</span>
                          </div>
                        </div>
                        <ExternalLink size={12} style={{ color: '#8899b0', flexShrink: 0, marginTop: 2 }} />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
