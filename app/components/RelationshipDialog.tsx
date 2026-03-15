'use client';

import React, { useState, useEffect } from 'react';
import { X, Zap, Minus } from 'lucide-react';
import type { Relationship, ArrowStyle } from '../types';
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
  const [color, setColor] = useState(RELATIONSHIP_COLORS[0]);
  const [arrowStyle, setArrowStyle] = useState<ArrowStyle>('normal');

  useEffect(() => {
    if (initialData) {
      setLabel(initialData.label || '');
      setDescription(initialData.description || '');
      setColor(initialData.color || RELATIONSHIP_COLORS[0]);
      setArrowStyle(initialData.arrowStyle || 'normal');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ label: label.trim(), description: description.trim(), color, arrowStyle });
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
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
      <div style={{ color: active ? color : '#64748b' }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: active ? color : '#94a3b8' }}>{label}</div>
      <div style={{ fontSize: 10, color: '#475569', textAlign: 'center' }}>{description}</div>
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
