'use client';

import React, { useState } from 'react';
import { X, Zap, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import type { ScenarioResult, EntityImpact } from '../api/scenario/route';

interface ScenarioPropagatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const IMPACT_STYLES: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  positive: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: <TrendingUp size={12} />, label: 'Positive' },
  negative: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: <TrendingDown size={12} />, label: 'Negative' },
  neutral: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: <Minus size={12} />, label: 'Neutral' },
  unknown: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: <HelpCircle size={12} />, label: 'Uncertain' },
};

const MAGNITUDE_COLOR: Record<string, string> = {
  high: '#f59e0b',
  medium: '#94a3b8',
  low: '#334155',
};

const PRESET_SHOCKS = [
  'Federal Reserve raises interest rates by 100 basis points',
  'US inflation jumps to 8% YoY',
  'US-China trade war escalates with 60% tariffs on all imports',
  'AI regulation bill passes, requiring model audits and halting some deployments',
  'Oil price spikes to $140/barrel due to Middle East conflict',
  'US enters recession with GDP contracting 2% for two consecutive quarters',
  'Dollar strengthens 15% against major currencies',
  'Major earnings miss: revenue -20% below expectations',
];

export default function ScenarioPropagator({ isOpen, onClose }: ScenarioPropagatorProps) {
  const { currentMap } = useMapStore();
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [shockText, setShockText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  if (!isOpen) return null;

  const entities = currentMap.entities;
  const relationships = currentMap.relationships;

  const handleRun = async () => {
    if (!shockText.trim() || !selectedEntityId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        shock: shockText.trim(),
        sourceEntityId: selectedEntityId,
        entities: entities.map((e) => ({
          id: e.id,
          name: e.name,
          ticker: e.ticker,
          sector: e.sector,
          thesis: e.thesis,
          tags: e.tags,
          livePrice: e.livePrice,
          targetPrice: e.targetPrice,
        })),
        relationships: relationships.map((r) => ({
          fromId: r.fromEntityId,
          toId: r.toEntityId,
          label: r.label,
          description: r.description,
        })),
      };

      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data: ScenarioResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getEntityName = (id: string) => entities.find((e) => e.id === id)?.name ?? id;
  const getEntityColor = (id: string) => entities.find((e) => e.id === id)?.color ?? '#3b82f6';
  const getEntityIcon = (id: string) => entities.find((e) => e.id === id)?.icon ?? '🏢';

  // Sort impacts: high magnitude first, then by impact type (neg > pos > neutral > unknown)
  const impactOrder = (imp: EntityImpact) => {
    const mag = { high: 0, medium: 1, low: 2 }[imp.magnitude] ?? 3;
    const type = { negative: 0, positive: 1, neutral: 2, unknown: 3 }[imp.impact] ?? 4;
    return mag * 10 + type;
  };

  const sortedImpacts = result
    ? [...result.impacts].sort((a, b) => impactOrder(a) - impactOrder(b))
    : [];

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
        width: '100%', maxWidth: 700, borderRadius: 16, padding: 0,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(59,130,246,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={18} style={{ color: '#f59e0b' }} />
            <h2 style={{ color: '#93c5fd', fontSize: 16, fontWeight: 700, margin: 0 }}>AI Scenario Propagation</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {entities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
              <Zap size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>Add entities to your map first.</p>
            </div>
          ) : (
            <>
              {/* Setup section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                  1. Select the entity where the shock originates:
                </div>
                <select
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12,
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.25)',
                    color: '#e2e8f0', outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">— Choose entity —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.icon} {e.name}{e.ticker ? ` ($${e.ticker})` : ''}{e.sector ? ` · ${e.sector}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>2. Describe the shock / scenario:</div>
                  <button
                    onClick={() => setShowPresets((v) => !v)}
                    style={{
                      background: 'none', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6,
                      cursor: 'pointer', color: '#64748b', fontSize: 10, padding: '2px 8px',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    Presets {showPresets ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                </div>

                {showPresets && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8,
                    padding: 10, borderRadius: 8, background: 'rgba(15,23,42,0.4)',
                    border: '1px solid rgba(59,130,246,0.12)',
                  }}>
                    {PRESET_SHOCKS.map((p) => (
                      <button
                        key={p}
                        onClick={() => { setShockText(p); setShowPresets(false); }}
                        style={{
                          padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                          border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.06)',
                          color: '#93c5fd', textAlign: 'left',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.14)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)')}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  value={shockText}
                  onChange={(e) => setShockText(e.target.value)}
                  placeholder="e.g. Federal Reserve raises interest rates by 100 basis points"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12,
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.25)',
                    color: '#e2e8f0', outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                onClick={handleRun}
                disabled={loading || !selectedEntityId || !shockText.trim()}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: loading || !selectedEntityId || !shockText.trim()
                    ? 'rgba(59,130,246,0.15)'
                    : 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none', cursor: loading || !selectedEntityId || !shockText.trim() ? 'not-allowed' : 'pointer',
                  color: loading || !selectedEntityId || !shockText.trim() ? '#475569' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.15s',
                  marginBottom: 20,
                }}
              >
                <Zap size={14} />
                {loading ? 'Analyzing scenario...' : 'Run Scenario Analysis'}
              </button>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  color: '#fca5a5', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertTriangle size={13} />
                  {error}
                  {error.includes('ANTHROPIC_API_KEY') && (
                    <span style={{ fontSize: 10, color: '#f87171' }}>
                      {' '}— Add ANTHROPIC_API_KEY to your .env file to use this feature.
                    </span>
                  )}
                </div>
              )}

              {/* Results */}
              {result && (
                <div>
                  {/* Summary banner */}
                  <div style={{
                    padding: '12px 16px', borderRadius: 10, marginBottom: 14,
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Scenario Summary
                    </div>
                    <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>
                      {result.summary}
                    </div>
                  </div>

                  {/* Impact list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sortedImpacts.map((imp) => {
                      const style = IMPACT_STYLES[imp.impact] ?? IMPACT_STYLES.unknown;
                      const isExpanded = expandedId === imp.entityId;
                      return (
                        <div key={imp.entityId} style={{
                          borderRadius: 8, border: `1px solid ${style.color}30`,
                          background: style.bg, overflow: 'hidden',
                        }}>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : imp.entityId)}
                            style={{
                              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                            }}
                          >
                            {/* Entity icon + name */}
                            <span style={{ fontSize: 16, lineHeight: 1 }}>{getEntityIcon(imp.entityId)}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: getEntityColor(imp.entityId), flex: 1, textAlign: 'left' }}>
                              {getEntityName(imp.entityId)}
                            </span>

                            {/* Impact badge */}
                            <span style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              fontSize: 10, fontWeight: 600, color: style.color,
                              background: `${style.color}20`, borderRadius: 6, padding: '2px 7px',
                            }}>
                              {style.icon} {style.label}
                            </span>

                            {/* Magnitude dot */}
                            <span
                              title={imp.magnitude}
                              style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: MAGNITUDE_COLOR[imp.magnitude] ?? '#334155',
                                flexShrink: 0,
                              }}
                            />

                            {isExpanded ? <ChevronUp size={12} style={{ color: '#475569' }} /> : <ChevronDown size={12} style={{ color: '#475569' }} />}
                          </button>

                          {isExpanded && (
                            <div style={{
                              padding: '0 12px 12px',
                              borderTop: `1px solid ${style.color}18`,
                            }}>
                              <p style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5, margin: '8px 0 0' }}>
                                {imp.reasoning}
                              </p>
                              {imp.keyRisk && (
                                <p style={{
                                  fontSize: 10, color: '#94a3b8', lineHeight: 1.5,
                                  margin: '6px 0 0', display: 'flex', alignItems: 'flex-start', gap: 5,
                                }}>
                                  <AlertTriangle size={10} style={{ flexShrink: 0, marginTop: 1, color: '#f59e0b' }} />
                                  {imp.keyRisk}
                                </p>
                              )}
                              <div style={{ marginTop: 8, fontSize: 9, color: '#334155' }}>
                                Magnitude: <span style={{ color: MAGNITUDE_COLOR[imp.magnitude], fontWeight: 700 }}>{imp.magnitude.toUpperCase()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
