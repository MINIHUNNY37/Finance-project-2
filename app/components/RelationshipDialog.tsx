'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Relationship } from '../types';
import { RELATIONSHIP_COLORS } from '../types';

interface RelationshipDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Relationship>) => void;
  initialData?: Partial<Relationship>;
}

export default function RelationshipDialog({
  isOpen,
  onClose,
  onSave,
  initialData,
}: RelationshipDialogProps) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(RELATIONSHIP_COLORS[0]);

  useEffect(() => {
    if (initialData) {
      setLabel(initialData.label || '');
      setDescription(initialData.description || '');
      setColor(initialData.color || RELATIONSHIP_COLORS[0]);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ label: label.trim(), description: description.trim(), color });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="glass-panel fade-in"
        style={{ width: '100%', maxWidth: 400, borderRadius: 16, padding: 24 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ color: '#93c5fd', fontSize: 18, fontWeight: 700 }}>
            Edit Relationship
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <label style={labelStyle}>Label</label>
          <input
            className="input-field mt-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Supplies to, Invests in, Manufactures for"
          />
        </div>

        <div className="mb-4">
          <label style={labelStyle}>Description</label>
          <textarea
            className="input-field mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the relationship between these entities..."
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="mb-6">
          <label style={labelStyle}>Arrow Color</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {RELATIONSHIP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '3px solid white' : '2px solid transparent',
                  cursor: 'pointer',
                  boxShadow: color === c ? `0 0 8px ${c}` : 'none',
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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
