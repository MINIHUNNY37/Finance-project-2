'use client';

import React, { useState, useEffect } from 'react';
import { X, Zap, Minus } from 'lucide-react';
import type { Relationship, ArrowStyle } from '../types';
type AnimFlavor = NonNullable<Relationship['animFlavor']>;
type LogisticsVehicle = NonNullable<Relationship['logisticsVehicle']>;
import { RELATIONSHIP_COLORS } from '../types';

interface RelationshipDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Relationship>) => void;
  initialData?: Partial<Relationship>;
}

export default function RelationshipDialog({ isOpen, onClose, onSave, initialData }: RelationshipDialogProps) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(RELATIONSHIP_COLORS[0]); // defaults to green
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>('normal');
  const [animFlavor, setAnimFlavor] = useState<AnimFlavor | undefined>(undefined);
  const [logisticsVehicle, setLogisticsVehicle] = useState<LogisticsVehicle>('truck');

  useEffect(() => {
    if (initialData) {
      setLabel(initialData.label || '');
      setDescription(initialData.description || '');
      setColor(initialData.color || RELATIONSHIP_COLORS[0]);
      setArrowStyle(initialData.arrowStyle || 'normal');
      setAnimFlavor(initialData.animFlavor ?? undefined);
      setLogisticsVehicle(initialData.logisticsVehicle ?? 'truck');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ label: label.trim(), description: description.trim(), color, arrowStyle, animFlavor: animFlavor || undefined, logisticsVehicle: (animFlavor === 'logistics' ? logisticsVehicle : undefined) });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: 420, borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ color: '#93c5fd', fontSize: 17, fontWeight: 700 }}>Edit Connection</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0' }}>
            <X size={20} />
          </button>
        </div>

        {/* Label */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Label</label>
          <input
            className="input-field mt-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Supplies to, Invests in, Manufactures for"
          />
        </div>

        {/* Note / Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Note (shown as box on arrow)</label>
          <textarea
            className="input-field mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Supply disrupted due to war — ~40% capacity reduction"
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Arrow Style */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Arrow Style</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <StyleOption
              active={arrowStyle === 'normal'}
              onClick={() => setArrowStyle('normal')}
              icon={<Minus size={16} />}
              label="Normal"
              description="Static arrow"
              color={color}
            />
            <StyleOption
              active={arrowStyle === 'animated'}
              onClick={() => setArrowStyle('animated')}
              icon={<Zap size={16} />}
              label="Animated"
              description="Flowing supply chain"
              color={color}
            />
          </div>
        </div>

        {/* Animation Type — only shown when Animated is selected */}
        {arrowStyle === 'animated' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Animation Type</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {([
                { key: undefined,    label: 'Auto',     icon: '⚡', desc: 'Detect from label', accent: '#94a3b8' },
                { key: 'capital',    label: 'Cash Flow', icon: '$', desc: 'Green coins flow',   accent: '#10b981' },
                { key: 'logistics',  label: 'Logistics', icon: '⬡', desc: 'Purple truck',       accent: '#a855f7' },
                { key: 'conflict',   label: 'Electric',  icon: '⚡', desc: 'Spark friction',    accent: '#f43f5e' },
                { key: 'synergy',    label: 'Synergy',   icon: '⚙', desc: 'Gear interlock',     accent: '#6366f1' },
              ] as const).map(({ key, label: lbl, icon, desc, accent }) => {
                const active = animFlavor === key;
                return (
                  <button
                    key={lbl}
                    onClick={() => setAnimFlavor(key as AnimFlavor | undefined)}
                    style={{
                      flex: 1, minWidth: 0, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                      background: active ? `${accent}18` : 'rgba(15,23,42,0.5)',
                      border: active ? `1.5px solid ${accent}` : `1.5px solid ${accent}33`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 16, color: active ? accent : '#9ca3af', lineHeight: 1 }}>{icon}</span>
                    <span style={{ fontSize: 11, color: active ? accent : '#94a3b8', fontWeight: 600 }}>{lbl}</span>
                    <span style={{ fontSize: 9, color: active ? `${accent}cc` : '#4b5563', whiteSpace: 'nowrap' }}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Logistics Vehicle — only shown when logistics flavor is selected */}
        {arrowStyle === 'animated' && animFlavor === 'logistics' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Vehicle</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {([
                { key: 'truck', icon: '🚚', label: 'Truck' },
                { key: 'plane', icon: '✈️', label: 'Plane' },
                { key: 'ship',  icon: '🚢', label: 'Ship' },
              ] as const).map(({ key, icon, label: lbl }) => {
                const active = logisticsVehicle === key;
                return (
                  <button
                    key={key}
                    onClick={() => setLogisticsVehicle(key)}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                      background: active ? 'rgba(168,85,247,0.15)' : 'rgba(15,23,42,0.5)',
                      border: active ? '1.5px solid #a855f7' : '1.5px solid rgba(168,85,247,0.2)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ fontSize: 12, color: active ? '#c084fc' : '#94a3b8', fontWeight: active ? 600 : 400 }}>{lbl}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Arrow Color */}
        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {RELATIONSHIP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 30, height: 30, borderRadius: '50%', background: c,
                  border: color === c ? '3px solid white' : '2px solid transparent',
                  cursor: 'pointer',
                  boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                  transition: 'all 0.15s ease',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function StyleOption({ active, onClick, icon, label, description, color }: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; description: string; color: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
        background: active ? `${color}18` : 'rgba(15,23,42,0.5)',
        border: `2px solid ${active ? color : 'rgba(59,130,246,0.15)'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ color: active ? color : '#8899b0' }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: active ? color : '#94a3b8' }}>{label}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>{description}</div>
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
