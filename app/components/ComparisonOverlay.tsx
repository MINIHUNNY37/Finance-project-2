'use client';

import React, { useState } from 'react';
import { X, BarChart3 } from 'lucide-react';
import type { Entity } from '../types';
import { useMapStore } from '../store/mapStore';

interface ComparisonOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ComparisonOverlay({ isOpen, onClose }: ComparisonOverlayProps) {
  const { currentMap } = useMapStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const entitiesWithTicker = currentMap.entities.filter((e) => e.ticker || e.livePrice != null);
  const selected = currentMap.entities.filter((e) => selectedIds.has(e.id));

  const toggleEntity = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else if (n.size < 5) n.add(id);
      return n;
    });
  };

  // Gather all metrics for comparison
  type Metric = { label: string; values: (string | number | undefined)[]; type: 'number' | 'string' };
  const metrics: Metric[] = [];
  if (selected.length > 0) {
    metrics.push(
      { label: 'Live Price', values: selected.map((e) => e.livePrice != null ? `$${e.livePrice.toFixed(2)}` : '—'), type: 'string' },
      { label: 'Change %', values: selected.map((e) => e.priceChangePct != null ? `${e.priceChangePct >= 0 ? '+' : ''}${e.priceChangePct.toFixed(2)}%` : '—'), type: 'string' },
      { label: 'Market Cap', values: selected.map((e) => e.marketCap || '—'), type: 'string' },
      { label: 'P/E Ratio', values: selected.map((e) => e.peRatio || '—'), type: 'string' },
      { label: '52W Low', values: selected.map((e) => e.week52Low != null ? `$${e.week52Low.toFixed(2)}` : '—'), type: 'string' },
      { label: '52W High', values: selected.map((e) => e.week52High != null ? `$${e.week52High.toFixed(2)}` : '—'), type: 'string' },
      { label: 'Entry Price', values: selected.map((e) => e.entryPrice != null ? `$${e.entryPrice.toFixed(2)}` : '—'), type: 'string' },
      { label: 'Target Price', values: selected.map((e) => e.targetPrice != null ? `$${e.targetPrice.toFixed(2)}` : '—'), type: 'string' },
      { label: 'Upside %', values: selected.map((e) => {
        const base = e.livePrice ?? e.entryPrice;
        if (base == null || e.targetPrice == null) return '—';
        const pct = ((e.targetPrice - base) / base) * 100;
        return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      }), type: 'string' },
      { label: 'Conviction', values: selected.map((e) => e.conviction ? `${'★'.repeat(e.conviction)}${'☆'.repeat(5 - e.conviction)}` : '—'), type: 'string' },
      { label: 'Sector', values: selected.map((e) => e.sector || '—'), type: 'string' },
    );

    // Add shared statistics
    const allStatNames = new Set<string>();
    selected.forEach((e) => e.statistics?.forEach((s) => allStatNames.add(s.name)));
    allStatNames.forEach((statName) => {
      metrics.push({
        label: statName,
        values: selected.map((e) => {
          const stat = e.statistics?.find((s) => s.name === statName);
          return stat?.value || '—';
        }),
        type: 'string',
      });
    });
  }

  // Helper to highlight best value per row (crude heuristic for numeric-ish values)
  const highlightBest = (values: (string | number | undefined)[], label: string): number => {
    if (label === 'P/E Ratio') {
      // Lower P/E is generally better
      const nums = values.map((v) => typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : NaN);
      const valid = nums.filter((n) => !isNaN(n));
      if (valid.length < 2) return -1;
      return nums.indexOf(Math.min(...valid));
    }
    if (label.includes('Upside') || label.includes('Change')) {
      const nums = values.map((v) => typeof v === 'string' ? parseFloat(v.replace(/[^0-9.-]/g, '')) : NaN);
      const valid = nums.filter((n) => !isNaN(n));
      if (valid.length < 2) return -1;
      return nums.indexOf(Math.max(...valid));
    }
    return -1;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel fade-in" style={{
        width: '100%', maxWidth: 800, borderRadius: 16, padding: 0,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(59,130,246,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart3 size={18} style={{ color: '#3b82f6' }} />
            <h2 style={{ color: '#93c5fd', fontSize: 16, fontWeight: 700, margin: 0 }}>Valuation Comparison</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Entity picker */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#8899b0', marginBottom: 8 }}>Select entities to compare (max 5):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(entitiesWithTicker.length > 0 ? entitiesWithTicker : currentMap.entities).map((e) => (
                <button key={e.id} onClick={() => toggleEntity(e.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
                    background: selectedIds.has(e.id) ? `${e.color}25` : 'rgba(15,23,42,0.5)',
                    border: `1px solid ${selectedIds.has(e.id) ? e.color : 'rgba(59,130,246,0.2)'}`,
                    color: selectedIds.has(e.id) ? e.color : '#94a3b8',
                    fontWeight: selectedIds.has(e.id) ? 600 : 400,
                  }}>
                  <span style={{ fontSize: 14 }}>{e.icon}</span>
                  {e.name}
                  {e.ticker && <span style={{ opacity: 0.6, fontFamily: 'monospace' }}>${e.ticker}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Comparison table */}
          {selected.length >= 2 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 10,
                      textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Metric</th>
                    {selected.map((e) => (
                      <th key={e.id} style={{ padding: '8px 12px', textAlign: 'center', minWidth: 110 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 16 }}>{e.icon}</span>
                          <span style={{ color: e.color, fontWeight: 700, fontSize: 11 }}>{e.name}</span>
                          {e.ticker && <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>${e.ticker}</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const bestIdx = highlightBest(m.values, m.label);
                    return (
                      <tr key={m.label} style={{ borderBottom: '1px solid rgba(59,130,246,0.07)' }}>
                        <td style={{ padding: '6px 12px', color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{m.label}</td>
                        {m.values.map((v, i) => (
                          <td key={i} style={{
                            padding: '6px 12px', textAlign: 'center', fontSize: 11,
                            color: i === bestIdx ? '#22c55e' : v === '—' ? '#8899b0' : '#e2e8f0',
                            fontWeight: i === bestIdx ? 700 : 400,
                          }}>
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : selected.length === 1 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
              Select at least one more entity to compare.
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
              Select 2–5 entities above to see a side-by-side comparison.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
