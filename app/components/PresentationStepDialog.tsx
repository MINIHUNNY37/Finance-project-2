'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { PresentationStep, PresentationTransition, EmphasisEffect } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (step: Omit<PresentationStep, 'id' | 'order'>) => void;
  initialData?: PresentationStep;
  entities: { id: string; name: string; icon: string }[];
}

const TRANSITIONS: { value: PresentationTransition; label: string }[] = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
];

const EFFECTS: { value: EmphasisEffect; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'pulse', label: 'Pulse Glow' },
  { value: 'cash-flow', label: 'Cash Flow' },
  { value: 'competitor', label: 'Competitor Tension' },
  { value: 'risk', label: 'Risk Warning' },
  { value: 'supply-chain', label: 'Supply Chain Flow' },
  { value: 'ownership', label: 'Ownership Glow' },
];

export default function PresentationStepDialog({ isOpen, onClose, onSave, initialData, entities }: Props) {
  const [targetEntityIds, setTargetEntityIds] = useState<string[]>([]);
  const [sourceEntityId, setSourceEntityId] = useState('');
  const [destinationEntityId, setDestinationEntityId] = useState('');
  const [zoomLevel, setZoomLevel] = useState(2.0);
  const [cameraMoveDuration, setCameraMoveDuration] = useState(1200);
  const [holdDuration, setHoldDuration] = useState(3000);
  const [transitionType, setTransitionType] = useState<PresentationTransition>('smooth');
  const [emphasisEffect, setEmphasisEffect] = useState<EmphasisEffect>('pulse');
  const [heading, setHeading] = useState('');
  const [subheading, setSubheading] = useState('');
  const [bodyNote, setBodyNote] = useState('');
  const [keyMetrics, setKeyMetrics] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');

  useEffect(() => {
    if (initialData) {
      setTargetEntityIds(initialData.targetEntityIds);
      setSourceEntityId(initialData.sourceEntityId || '');
      setDestinationEntityId(initialData.destinationEntityId || '');
      setZoomLevel(initialData.zoomLevel);
      setCameraMoveDuration(initialData.cameraMoveDuration);
      setHoldDuration(initialData.holdDuration);
      setTransitionType(initialData.transitionType);
      setEmphasisEffect(initialData.emphasisEffect);
      setHeading(initialData.heading);
      setSubheading(initialData.subheading);
      setBodyNote(initialData.bodyNote);
      setKeyMetrics(initialData.keyMetrics?.join('\n') || '');
      setWhyItMatters(initialData.whyItMatters || '');
    } else {
      setTargetEntityIds([]);
      setSourceEntityId('');
      setDestinationEntityId('');
      setZoomLevel(2.0);
      setCameraMoveDuration(1200);
      setHoldDuration(3000);
      setTransitionType('smooth');
      setEmphasisEffect('pulse');
      setHeading('');
      setSubheading('');
      setBodyNote('');
      setKeyMetrics('');
      setWhyItMatters('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      targetEntityIds,
      sourceEntityId: sourceEntityId || undefined,
      destinationEntityId: destinationEntityId || undefined,
      zoomLevel,
      cameraMoveDuration,
      holdDuration,
      transitionType,
      emphasisEffect,
      heading,
      subheading,
      bodyNote,
      keyMetrics: keyMetrics.trim() ? keyMetrics.trim().split('\n').filter(Boolean) : undefined,
      whyItMatters: whyItMatters.trim() || undefined,
    });
    onClose();
  };

  const toggleEntity = (id: string) => {
    setTargetEntityIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
    color: '#e2e8f0', fontSize: 13, outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4, display: 'block' };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 16, padding: 24, maxWidth: 540, width: '95%',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
            {initialData ? 'Edit Step' : 'Add Step'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Target Entities */}
          <div>
            <label style={labelStyle}>Target Entities</label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6,
              maxHeight: 120, overflowY: 'auto', padding: 4,
            }}>
              {entities.map((e) => (
                <button
                  key={e.id}
                  onClick={() => toggleEntity(e.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12,
                    background: targetEntityIds.includes(e.id) ? 'rgba(59,130,246,0.3)' : 'rgba(30,41,59,0.8)',
                    border: `1px solid ${targetEntityIds.includes(e.id) ? 'rgba(59,130,246,0.6)' : 'rgba(51,65,85,0.5)'}`,
                    color: targetEntityIds.includes(e.id) ? '#93c5fd' : '#94a3b8',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {e.icon} {e.name}
                </button>
              ))}
            </div>
          </div>

          {/* Source / Destination for relation movement */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Source Entity (relation)</label>
              <select value={sourceEntityId} onChange={(e) => setSourceEntityId(e.target.value)} style={fieldStyle}>
                <option value="">None</option>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.icon} {e.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Destination Entity (relation)</label>
              <select value={destinationEntityId} onChange={(e) => setDestinationEntityId(e.target.value)} style={fieldStyle}>
                <option value="">None</option>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.icon} {e.name}</option>)}
              </select>
            </div>
          </div>

          {/* Camera settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Zoom ({zoomLevel.toFixed(1)}x)</label>
              <input type="range" min={0.5} max={5} step={0.1} value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#3b82f6' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Move Duration (ms)</label>
              <input type="number" min={200} max={5000} step={100} value={cameraMoveDuration}
                onChange={(e) => setCameraMoveDuration(Number(e.target.value))} style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Hold Duration (ms)</label>
              <input type="number" min={500} max={15000} step={500} value={holdDuration}
                onChange={(e) => setHoldDuration(Number(e.target.value))} style={fieldStyle}
              />
            </div>
          </div>

          {/* Transition + Effect */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Transition</label>
              <select value={transitionType} onChange={(e) => setTransitionType(e.target.value as PresentationTransition)} style={fieldStyle}>
                {TRANSITIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Emphasis Effect</label>
              <select value={emphasisEffect} onChange={(e) => setEmphasisEffect(e.target.value as EmphasisEffect)} style={fieldStyle}>
                {EFFECTS.map((ef) => <option key={ef.value} value={ef.value}>{ef.label}</option>)}
              </select>
            </div>
          </div>

          {/* Note content */}
          <div>
            <label style={labelStyle}>Heading</label>
            <input value={heading} onChange={(e) => setHeading(e.target.value)} style={fieldStyle} placeholder="Step heading..." />
          </div>
          <div>
            <label style={labelStyle}>Subheading</label>
            <input value={subheading} onChange={(e) => setSubheading(e.target.value)} style={fieldStyle} placeholder="Subheading..." />
          </div>
          <div>
            <label style={labelStyle}>Body Note</label>
            <textarea value={bodyNote} onChange={(e) => setBodyNote(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Short explanation..." />
          </div>
          <div>
            <label style={labelStyle}>Key Metrics (one per line)</label>
            <textarea value={keyMetrics} onChange={(e) => setKeyMetrics(e.target.value)} rows={2} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Revenue: $394B&#10;P/E: 28.5x" />
          </div>
          <div>
            <label style={labelStyle}>Why This Matters</label>
            <input value={whyItMatters} onChange={(e) => setWhyItMatters(e.target.value)} style={fieldStyle} placeholder="Brief insight..." />
          </div>

          {/* Save */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              onClick={handleSave}
              disabled={targetEntityIds.length === 0}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8,
                background: targetEntityIds.length > 0 ? 'rgba(59,130,246,0.85)' : 'rgba(59,130,246,0.3)',
                border: '1px solid rgba(59,130,246,0.5)', color: 'white',
                cursor: targetEntityIds.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {initialData ? 'Update Step' : 'Add Step'}
            </button>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              background: 'rgba(51,65,85,0.5)', border: '1px solid rgba(51,65,85,0.5)',
              color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
