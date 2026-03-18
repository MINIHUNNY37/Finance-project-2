'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { GeoEvent, GeoEventType } from '../types';
import { GEO_EVENT_TYPES } from '../types';

interface GeoEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<GeoEvent, 'id' | 'createdAt'>) => void;
  initialData?: Partial<GeoEvent>;
  defaultPosition?: { x: number; y: number };
}

export default function GeoEventDialog({
  isOpen, onClose, onSave, initialData, defaultPosition,
}: GeoEventDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<GeoEventType>('war');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setType(initialData.type || 'war');
      setStartDate(initialData.startDate || '');
      setEndDate(initialData.endDate || '');
      setHasEndDate(!!initialData.endDate);
      setDetails(initialData.details || '');
    } else {
      setName(''); setType('war'); setStartDate(''); setEndDate('');
      setHasEndDate(false); setDetails('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const selectedMeta = GEO_EVENT_TYPES.find((t) => t.value === type)!;
  const color = selectedMeta.color;

  const handleSave = () => {
    if (!name.trim() || !startDate) return;
    onSave({
      name: name.trim(),
      type,
      startDate,
      endDate: hasEndDate && endDate ? endDate : undefined,
      details: details.trim(),
      position: initialData?.position ?? defaultPosition ?? { x: 400, y: 300 },
    });
    onClose();
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 6, display: 'block',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="glass-panel fade-in"
        style={{
          width: '100%', maxWidth: 480, borderRadius: 16, overflow: 'hidden',
          border: `1px solid ${color}44`,
          boxShadow: `0 0 40px ${color}18, 0 16px 48px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: `1px solid ${color}30`,
          background: `linear-gradient(135deg, ${color}12, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{selectedMeta.emoji}</span>
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700, margin: 0 }}>
                {initialData?.id ? 'Edit Geopolitical Event' : 'Add Geopolitical Event'}
              </h2>
              <div style={{ fontSize: 11, color: color, marginTop: 2 }}>{selectedMeta.label}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', maxHeight: '70vh', overflowY: 'auto' }}>

          {/* Event Type */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Event Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {GEO_EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8, fontSize: 11,
                    cursor: 'pointer', transition: 'all 0.12s',
                    background: type === t.value ? `${t.color}28` : 'rgba(15,23,42,0.5)',
                    border: `1px solid ${type === t.value ? t.color : 'rgba(59,130,246,0.2)'}`,
                    color: type === t.value ? t.color : '#8899b0',
                    fontWeight: type === t.value ? 700 : 400,
                    outline: type === t.value ? `2px solid ${t.color}44` : 'none',
                  }}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label.split(' ')[0]}{t.label.includes('/') ? ' / ' + t.label.split('/')[1]?.trim().split(' ')[0] : ''}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Event Name *</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. ${selectedMeta.value === 'war' ? 'Russia-Ukraine War' : selectedMeta.value === 'election' ? 'US Presidential Election' : selectedMeta.value === 'sanctions' ? 'US-China Semiconductor Sanctions' : 'Event name'}`}
              style={{ width: '100%' }}
            />
          </div>

          {/* Dates */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              {hasEndDate ? 'Date Range' : 'Date'} *
              <button
                onClick={() => setHasEndDate((v) => !v)}
                style={{
                  marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer',
                  color: hasEndDate ? color : '#8899b0', fontSize: 10, textTransform: 'none',
                  letterSpacing: 0, fontWeight: 500,
                }}
              >
                {hasEndDate ? '✓ Date range' : '+ Add end date'}
              </button>
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  flex: 1, fontSize: 12, padding: '7px 10px',
                  background: 'rgba(15,23,42,0.6)', border: `1px solid ${color}44`,
                  borderRadius: 8, color: '#e2e8f0', outline: 'none', colorScheme: 'dark',
                }}
              />
              {hasEndDate && (
                <>
                  <span style={{ color: '#8899b0', fontSize: 11 }}>to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      flex: 1, fontSize: 12, padding: '7px 10px',
                      background: 'rgba(15,23,42,0.6)', border: `1px solid ${color}44`,
                      borderRadius: 8, color: '#e2e8f0', outline: 'none', colorScheme: 'dark',
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Details</label>
            <textarea
              className="input-field"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Background, key players, expected market impact, what changed..."
              rows={4}
              style={{ resize: 'vertical', width: '100%', lineHeight: 1.55 }}
            />
          </div>

          {/* Hint */}
          <div style={{ fontSize: 10.5, color: '#8899b0', lineHeight: 1.5, marginTop: 6 }}>
            💡 Place it anywhere on the map and drag to reposition. Click to edit · Right-click to delete.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: `1px solid ${color}25`,
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          background: 'rgba(8,15,30,0.4)',
        }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !startDate}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: name.trim() && startDate ? 'pointer' : 'not-allowed',
              background: name.trim() && startDate ? `${color}28` : 'rgba(59,130,246,0.06)',
              border: `1px solid ${name.trim() && startDate ? color : 'rgba(59,130,246,0.2)'}`,
              color: name.trim() && startDate ? color : '#8899b0',
              transition: 'all 0.15s',
            }}
          >
            {initialData?.id ? 'Save Changes' : `Place on Map`}
          </button>
        </div>
      </div>
    </div>
  );
}
