'use client';

import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useMapStore } from '../store/mapStore';

export default function InvestmentPanel() {
  const { currentMap, investmentPlan, updateInvestmentPlan } = useMapStore();
  const [collapsed, setCollapsed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // Per-row percent drafts (while user is actively typing %)
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({});

  const { balance, allocations, notes } = investmentPlan;

  const totalInvested = allocations.reduce((s, a) => s + a.amount, 0);
  const cashRemaining = Math.max(0, balance - totalInvested);
  const investedPct = balance > 0 ? Math.min(100, (totalInvested / balance) * 100) : 0;
  const cashToAssetRatio = balance > 0 ? (cashRemaining / balance) * 100 : 100;
  const isOverAllocated = totalInvested > balance && balance > 0;

  const allocatedIds = new Set(allocations.map((a) => a.entityId));
  const availableEntities = currentMap.entities.filter((e) => !allocatedIds.has(e.id) && !e.hidden);

  const addAllocation = (entityId: string) => {
    updateInvestmentPlan({ allocations: [...allocations, { entityId, amount: 0 }] });
    setShowPicker(false);
  };

  const removeAllocation = (entityId: string) => {
    updateInvestmentPlan({ allocations: allocations.filter((a) => a.entityId !== entityId) });
    setPctDraft((d) => { const n = { ...d }; delete n[entityId]; return n; });
  };

  const setAmount = useCallback((entityId: string, amount: number) => {
    updateInvestmentPlan({
      allocations: allocations.map((a) => a.entityId === entityId ? { ...a, amount } : a),
    });
  }, [allocations, updateInvestmentPlan]);

  const handleAmountChange = (entityId: string, raw: string) => {
    const v = parseFloat(raw) || 0;
    setAmount(entityId, v);
  };

  const handlePctChange = (entityId: string, raw: string) => {
    setPctDraft((d) => ({ ...d, [entityId]: raw }));
    const pct = parseFloat(raw) || 0;
    if (balance > 0) setAmount(entityId, (pct / 100) * balance);
  };

  const handlePctBlur = (entityId: string) => {
    setPctDraft((d) => { const n = { ...d }; delete n[entityId]; return n; });
  };

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toFixed(2)}`;

  if (collapsed) {
    return (
      <div style={{
        position: 'fixed', right: 0, top: 56, bottom: 0, width: 44,
        background: 'rgba(15,23,42,0.96)',
        borderLeft: '1px solid rgba(59,130,246,0.15)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 14, zIndex: 400,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(15,23,42,0.96)',
            border: '1px solid rgba(59,130,246,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#64748b',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
        >
          <ChevronLeft size={14} />
        </button>
        <div style={{
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontSize: 10, color: '#475569', marginTop: 16,
          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
        }}>
          Investment Plan
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', right: 0, top: 56, bottom: 0, width: 300,
      background: 'rgba(15,23,42,0.97)',
      borderLeft: '1px solid rgba(59,130,246,0.15)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      zIndex: 400,
    }}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(true)}
        style={{
          position: 'absolute', left: -14, top: 16,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(15,23,42,0.96)',
          border: '1px solid rgba(59,130,246,0.3)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#64748b', zIndex: 1,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
      >
        <ChevronRight size={14} />
      </button>

      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(59,130,246,0.12)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <TrendingUp size={14} style={{ color: '#10b981' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Investment Plan</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>

        {/* ── Balance ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Total Balance
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 10, padding: '8px 12px',
          }}>
            <span style={{ fontSize: 16, color: '#10b981', fontWeight: 700, flexShrink: 0 }}>$</span>
            <input
              type="number"
              value={balance || ''}
              onChange={(e) => updateInvestmentPlan({ balance: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              min={0}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#e2e8f0', fontSize: 20, fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>
          {balance > 0 && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, paddingLeft: 2 }}>
              {fmt(balance)} total portfolio
            </div>
          )}
        </div>

        {/* ── Cash-to-Asset Ratio ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Portfolio Allocation
          </div>
          {/* Bar */}
          <div style={{ height: 14, borderRadius: 7, background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(59,130,246,0.15)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, investedPct)}%`,
              background: isOverAllocated
                ? 'linear-gradient(90deg, #ef4444, #f97316)'
                : 'linear-gradient(90deg, #3b82f6, #10b981)',
              borderRadius: 7,
              transition: 'width 0.3s ease',
            }} />
          </div>
          {/* Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: '#94a3b8' }}>
              Cash <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{(100 - Math.min(100, investedPct)).toFixed(1)}%</span>
            </span>
            <span style={{ color: isOverAllocated ? '#ef4444' : '#94a3b8' }}>
              Invested <span style={{ color: isOverAllocated ? '#ef4444' : '#e2e8f0', fontWeight: 600 }}>{Math.min(100, investedPct).toFixed(1)}%</span>
            </span>
          </div>
          {/* Summary rows */}
          <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(59,130,246,0.1)', borderRadius: 8, padding: '8px 10px' }}>
            <SummaryRow label="Cash remaining" value={fmt(cashRemaining)} color="#10b981" />
            <SummaryRow label="Total invested" value={fmt(totalInvested)} color="#3b82f6" />
            <SummaryRow
              label="Cash-to-asset ratio"
              value={`${cashToAssetRatio.toFixed(1)}%`}
              color={cashToAssetRatio < 20 ? '#f59e0b' : '#94a3b8'}
            />
            {isOverAllocated && (
              <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>
                ⚠ Over-allocated by {fmt(totalInvested - balance)}
              </div>
            )}
          </div>
        </div>

        {/* ── Companies ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Companies ({allocations.length})
            </div>
            <button
              onClick={() => setShowPicker((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                background: showPicker ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#3b82f6', transition: 'all 0.1s',
              }}
            >
              <Plus size={11} /> Add
            </button>
          </div>

          {/* Entity picker dropdown */}
          {showPicker && (
            <div className="fade-in" style={{
              marginBottom: 8, background: 'rgba(10,17,34,0.98)',
              border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: 8,
              maxHeight: 180, overflowY: 'auto',
            }}>
              {availableEntities.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
                  All entities added
                </div>
              ) : availableEntities.map((entity) => (
                <button key={entity.id} onClick={() => addAllocation(entity.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 7, marginBottom: 2,
                  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = `${entity.color}18`)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <span style={{ fontSize: 15 }}>{entity.icon}</span>
                  <span style={{ fontSize: 12, color: entity.color, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entity.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {allocations.length === 0 && !showPicker && (
            <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '12px 0', lineHeight: 1.5 }}>
              Click &quot;Add&quot; to include a company<br />in your investment plan
            </div>
          )}

          {allocations.map((alloc) => {
            const entity = currentMap.entities.find((e) => e.id === alloc.entityId);
            if (!entity) return null;
            const allocPct = balance > 0 ? (alloc.amount / balance) * 100 : 0;
            const barWidth = balance > 0 ? Math.min(100, allocPct) : 0;
            const displayPct = pctDraft[alloc.entityId] !== undefined
              ? pctDraft[alloc.entityId]
              : allocPct.toFixed(1);

            return (
              <div key={alloc.entityId} style={{
                background: 'rgba(15,23,42,0.5)',
                border: `1px solid ${entity.color}22`,
                borderRadius: 10, padding: '10px 10px 8px', marginBottom: 6,
              }}>
                {/* Entity row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                    background: entity.color + '22', border: `1px solid ${entity.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  }}>
                    {entity.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: entity.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entity.name}
                    </div>
                  </div>
                  <button onClick={() => removeAllocation(alloc.entityId)}
                    title="Remove"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: '2px', display: 'flex', flexShrink: 0 }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#334155')}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Inputs — $ amount and % always shown side by side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  {/* Dollar input */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 3, flex: 1,
                    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 7, padding: '5px 7px',
                  }}>
                    <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>$</span>
                    <input
                      type="number"
                      value={alloc.amount || ''}
                      onChange={(e) => handleAmountChange(alloc.entityId, e.target.value)}
                      placeholder="0"
                      min={0}
                      style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                  {/* Percent input */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 3, width: 72,
                    background: `${entity.color}12`,
                    border: `1px solid ${entity.color}40`,
                    borderRadius: 7, padding: '5px 7px', flexShrink: 0,
                  }}>
                    <input
                      type="number"
                      value={displayPct}
                      onChange={(e) => handlePctChange(alloc.entityId, e.target.value)}
                      onBlur={() => handlePctBlur(alloc.entityId)}
                      placeholder="0"
                      min={0}
                      max={100}
                      style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: entity.color, fontSize: 11, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                    />
                    <span style={{ fontSize: 10, color: entity.color, opacity: 0.7, flexShrink: 0 }}>%</span>
                  </div>
                </div>

                {/* Allocation bar */}
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(15,23,42,0.7)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${barWidth}%`,
                    background: entity.color,
                    borderRadius: 2, transition: 'width 0.2s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Notes (pinned to bottom) ── */}
      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(59,130,246,0.12)', padding: '10px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Investment Notes
        </div>
        <textarea
          value={notes}
          onChange={(e) => updateInvestmentPlan({ notes: e.target.value })}
          placeholder="Write your investment thesis, strategy, risk notes…"
          rows={5}
          style={{
            width: '100%', background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8,
            color: '#94a3b8', fontSize: 12, lineHeight: 1.6,
            padding: '8px 10px', resize: 'vertical', outline: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 90,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.15)')}
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
