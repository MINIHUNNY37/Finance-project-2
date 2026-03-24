'use client';

import React from 'react';
import { Link2, ArrowRight } from 'lucide-react';
import { usePresentationStore } from '../store/presentationStore';
import { useMapStore } from '../store/mapStore';
import type { PresentationTransition, EmphasisEffect } from '../types';

const TRANSITIONS: { value: PresentationTransition; label: string }[] = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
];

const EFFECTS: { value: EmphasisEffect; label: string; color: string }[] = [
  { value: 'none', label: 'None', color: '#64748b' },
  { value: 'pulse', label: 'Pulse', color: '#3b82f6' },
  { value: 'cash-flow', label: 'Cash Flow', color: '#10b981' },
  { value: 'competitor', label: 'Competitor', color: '#ef4444' },
  { value: 'risk', label: 'Risk', color: '#f59e0b' },
  { value: 'supply-chain', label: 'Supply Chain', color: '#06b6d4' },
  { value: 'ownership', label: 'Ownership', color: '#8b5cf6' },
];

export default function PresentationStepEditor() {
  const { activePresentation, selectedStepId, updateStep } = usePresentationStore();
  const { currentMap } = useMapStore();

  if (!activePresentation || !selectedStepId) {
    return (
      <div style={{
        position: 'fixed', top: 68, right: 0, bottom: 0, width: 300,
        background: 'rgba(10,17,34,0.97)',
        borderLeft: '1px solid rgba(59,130,246,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 10,
        zIndex: 50, backdropFilter: 'blur(12px)',
      }}>
        <div style={{ fontSize: 28, opacity: 0.2 }}>🎬</div>
        <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 1.6 }}>
          Select a step on the left<br />to edit its properties
        </div>
      </div>
    );
  }

  const step = activePresentation.steps.find((s) => s.id === selectedStepId);
  if (!step) return null;

  const entities = currentMap.entities.filter((e) => !e.hidden);
  const connections = currentMap.relationships.filter((r) => !r.hidden);

  const update = (updates: Parameters<typeof updateStep>[1]) => updateStep(selectedStepId, updates);

  const toggleEntity = (id: string) => {
    const next = step.targetEntityIds.includes(id)
      ? step.targetEntityIds.filter((e) => e !== id)
      : [...step.targetEntityIds, id];
    update({ targetEntityIds: next });
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 7,
    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
    color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box',
  };

  const label = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, marginTop: 12 }}>
      {text}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: 68, right: 0, bottom: 0, width: 300,
      background: 'rgba(10,17,34,0.97)',
      borderLeft: '1px solid rgba(59,130,246,0.2)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, backdropFilter: 'blur(12px)',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>Step Editor</div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
          {step.heading || (step.targetEntityIds[0] && entities.find(e => e.id === step.targetEntityIds[0])?.name) || 'Untitled step'}
        </div>
      </div>

      <div style={{ padding: '0 14px 20px', flex: 1, overflowY: 'auto' }}>

        {/* ── Target entities ── */}
        {label('Target Entities')}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {entities.map((e) => {
            const selected = step.targetEntityIds.includes(e.id);
            return (
              <button key={e.id} onClick={() => toggleEntity(e.id)} style={{
                padding: '3px 8px', borderRadius: 5, fontSize: 11,
                background: selected ? 'rgba(59,130,246,0.25)' : 'rgba(30,41,59,0.7)',
                border: `1px solid ${selected ? 'rgba(59,130,246,0.5)' : 'rgba(51,65,85,0.4)'}`,
                color: selected ? '#93c5fd' : '#64748b',
                cursor: 'pointer', transition: 'all 0.12s',
              }}>
                {e.icon} {e.name}
              </button>
            );
          })}
        </div>

        {/* ── Connections (relation step) ── */}
        {label('Follow a Connection')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {connections.length === 0 && (
            <div style={{ fontSize: 11, color: '#475569' }}>No connections on this map yet.</div>
          )}
          {connections.map((rel) => {
            const from = entities.find((e) => e.id === rel.fromEntityId);
            const to = entities.find((e) => e.id === rel.toEntityId);
            if (!from || !to) return null;
            const isActive = step.sourceEntityId === rel.fromEntityId && step.destinationEntityId === rel.toEntityId;
            return (
              <button
                key={rel.id}
                onClick={() => {
                  if (isActive) {
                    update({ sourceEntityId: undefined, destinationEntityId: undefined });
                  } else {
                    update({
                      sourceEntityId: rel.fromEntityId,
                      destinationEntityId: rel.toEntityId,
                      targetEntityIds: [rel.fromEntityId, rel.toEntityId],
                    });
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 7, fontSize: 11,
                  background: isActive ? `${rel.color}20` : 'rgba(20,30,50,0.6)',
                  border: `1px solid ${isActive ? rel.color + '60' : 'rgba(51,65,85,0.4)'}`,
                  color: isActive ? rel.color : '#64748b',
                  cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left',
                }}
              >
                <Link2 size={10} style={{ flexShrink: 0, color: rel.color }} />
                <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72 }}>{from.icon} {from.name}</span>
                <ArrowRight size={9} style={{ color: rel.color, flexShrink: 0 }} />
                <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72 }}>{to.icon} {to.name}</span>
                {rel.label && <span style={{ fontSize: 9, color: rel.color, marginLeft: 'auto', flexShrink: 0 }}>{rel.label}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Camera ── */}
        {label('Camera')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Zoom level</span>
              <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>{step.zoomLevel.toFixed(1)}×</span>
            </div>
            <input type="range" min={0.5} max={5} step={0.1} value={step.zoomLevel}
              onChange={(e) => update({ zoomLevel: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Move (ms)</div>
              <input type="number" min={200} max={5000} step={100} value={step.cameraMoveDuration}
                onChange={(e) => update({ cameraMoveDuration: Number(e.target.value) })} style={fieldStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Hold (ms)</div>
              <input type="number" min={500} max={15000} step={500} value={step.holdDuration}
                onChange={(e) => update({ holdDuration: Number(e.target.value) })} style={fieldStyle} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Transition</div>
            <select value={step.transitionType} onChange={(e) => update({ transitionType: e.target.value as PresentationTransition })} style={fieldStyle}>
              {TRANSITIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── Emphasis ── */}
        {label('Emphasis Effect')}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {EFFECTS.map((ef) => (
            <button key={ef.value} onClick={() => update({ emphasisEffect: ef.value })} style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 11,
              background: step.emphasisEffect === ef.value ? `${ef.color}25` : 'rgba(20,30,50,0.6)',
              border: `1px solid ${step.emphasisEffect === ef.value ? ef.color + '70' : 'rgba(51,65,85,0.4)'}`,
              color: step.emphasisEffect === ef.value ? ef.color : '#64748b',
              cursor: 'pointer', transition: 'all 0.12s',
            }}>
              {ef.label}
            </button>
          ))}
        </div>

        {/* ── Notes ── */}
        {label('Narrative')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <input value={step.heading} onChange={(e) => update({ heading: e.target.value })}
            style={fieldStyle} placeholder="Heading…" />
          <input value={step.subheading} onChange={(e) => update({ subheading: e.target.value })}
            style={fieldStyle} placeholder="Subheading…" />
          <textarea value={step.bodyNote} onChange={(e) => update({ bodyNote: e.target.value })}
            rows={3} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Body note…" />
          <textarea
            value={step.keyMetrics?.join('\n') ?? ''}
            onChange={(e) => update({ keyMetrics: e.target.value.trim() ? e.target.value.split('\n').filter(Boolean) : undefined })}
            rows={2} style={{ ...fieldStyle, resize: 'vertical' }}
            placeholder={"Key metrics (one per line)\nRevenue: $394B"} />
          <input value={step.whyItMatters ?? ''} onChange={(e) => update({ whyItMatters: e.target.value || undefined })}
            style={fieldStyle} placeholder="Why this matters…" />
        </div>
      </div>
    </div>
  );
}
