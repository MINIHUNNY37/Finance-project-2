'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, EntitySubItem } from '../types';
import { ENTITY_ICONS, ENTITY_COLORS } from '../types';

interface EntityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Entity>) => void;
  initialData?: Partial<Entity>;
  defaultPosition?: { x: number; y: number };
  defaultCountry?: string;
}

export default function EntityDialog({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultPosition,
  defaultCountry,
}: EntityDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏢');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(ENTITY_COLORS[0]);
  const [subItems, setSubItems] = useState<EntitySubItem[]>([]);
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setIcon(initialData.icon || '🏢');
      setSubtitle(initialData.subtitle || '');
      setDescription(initialData.description || '');
      setColor(initialData.color || ENTITY_COLORS[0]);
      setSubItems(initialData.subItems || []);
      setCountry(initialData.country || defaultCountry || '');
    } else {
      setName('');
      setIcon('🏢');
      setSubtitle('');
      setDescription('');
      setColor(ENTITY_COLORS[0]);
      setSubItems([]);
      setCountry(defaultCountry || '');
    }
  }, [initialData, defaultCountry, isOpen]);

  if (!isOpen) return null;

  const addSubItem = () => {
    setSubItems([...subItems, { id: uuidv4(), title: '', description: '' }]);
  };

  const updateSubItem = (id: string, field: keyof EntitySubItem, value: string) => {
    setSubItems(subItems.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const removeSubItem = (id: string) => {
    setSubItems(subItems.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      icon,
      subtitle: subtitle.trim(),
      description: description.trim(),
      color,
      subItems,
      country: country.trim(),
      position: defaultPosition || { x: 400, y: 300 },
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="glass-panel fade-in"
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 16,
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ color: '#93c5fd', fontSize: 18, fontWeight: 700 }}>
            {initialData?.id ? 'Edit Entity' : 'Create Entity'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Icon picker */}
        <div className="mb-4">
          <label style={labelStyle}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {ENTITY_ICONS.map((ic) => (
              <button
                key={ic.value}
                title={ic.label}
                onClick={() => setIcon(ic.value)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: icon === ic.value ? '2px solid #06b6d4' : '1px solid rgba(59,130,246,0.2)',
                  background: icon === ic.value ? 'rgba(6,182,212,0.15)' : 'rgba(15,23,42,0.6)',
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {ic.value}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div className="mb-4">
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {ENTITY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? `3px solid white` : '2px solid transparent',
                  cursor: 'pointer',
                  boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                  transition: 'all 0.15s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label style={labelStyle}>Company / Entity Name *</label>
          <input
            className="input-field mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apple Inc."
          />
        </div>

        {/* Subtitle */}
        <div className="mb-4">
          <label style={labelStyle}>Subtitle</label>
          <input
            className="input-field mt-1"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="e.g. Technology Giant, $AAPL"
          />
        </div>

        {/* Country */}
        <div className="mb-4">
          <label style={labelStyle}>Country / Location</label>
          <input
            className="input-field mt-1"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. United States"
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label style={labelStyle}>Description</label>
          <textarea
            className="input-field mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this entity, its role, business model..."
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Sub-items */}
        <div className="mb-6">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={labelStyle}>Details / Sub-sections</label>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addSubItem}>
              <Plus size={12} style={{ display: 'inline', marginRight: 4 }} />
              Add
            </button>
          </div>
          {subItems.map((sub) => (
            <div
              key={sub.id}
              style={{
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  className="input-field"
                  value={sub.title}
                  onChange={(e) => updateSubItem(sub.id, 'title', e.target.value)}
                  placeholder="Heading (e.g. Revenue Streams)"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => removeSubItem(sub.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                className="input-field"
                value={sub.description}
                onChange={(e) => updateSubItem(sub.id, 'description', e.target.value)}
                placeholder="Description..."
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
            {initialData?.id ? 'Save Changes' : 'Create Entity'}
          </button>
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
