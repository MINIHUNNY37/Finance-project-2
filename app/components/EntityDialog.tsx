'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, EntitySubItem, EntityStatistic } from '../types';
import { ENTITY_ICONS, ENTITY_COLORS } from '../types';
import { useMapStore } from '../store/mapStore';

interface EntityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Entity>) => void;
  initialData?: Partial<Entity>;
  defaultPosition?: { x: number; y: number };
  defaultCountry?: string;
}

type Tab = 'basic' | 'details' | 'stats';

export default function EntityDialog({
  isOpen, onClose, onSave, initialData, defaultPosition, defaultCountry,
}: EntityDialogProps) {
  const {
    customStatPresets, addCustomStatPreset, removeCustomStatPreset,
    customDetailPresets, addCustomDetailPreset, removeCustomDetailPreset,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [newStatPreset, setNewStatPreset] = useState('');
  const [newDetailPreset, setNewDetailPreset] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏢');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(ENTITY_COLORS[0]);
  const [subItems, setSubItems] = useState<EntitySubItem[]>([]);
  const [statistics, setStatistics] = useState<EntityStatistic[]>([]);
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setIcon(initialData.icon || '🏢');
      setSubtitle(initialData.subtitle || '');
      setDescription(initialData.description || '');
      setColor(initialData.color || ENTITY_COLORS[0]);
      setSubItems(initialData.subItems || []);
      setStatistics(initialData.statistics || []);
      setCountry(initialData.country || defaultCountry || '');
    } else {
      // Empty icon forces the user to explicitly pick one before saving
      setName(''); setIcon(''); setSubtitle(''); setDescription('');
      setColor(ENTITY_COLORS[0]); setSubItems([]); setStatistics([]);
      setCountry(defaultCountry || '');
    }
    setActiveTab('basic');
  }, [initialData, defaultCountry, isOpen]);

  if (!isOpen) return null;

  // Sub-items
  const addSubItem = () => setSubItems([...subItems, { id: uuidv4(), title: '', description: '' }]);
  const updateSubItem = (id: string, field: keyof EntitySubItem, value: string) =>
    setSubItems(subItems.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  const removeSubItem = (id: string) => setSubItems(subItems.filter((s) => s.id !== id));

  // Statistics
  const addStat = () => setStatistics([...statistics, { id: uuidv4(), name: '', value: '', asOf: '' }]);
  const updateStat = (id: string, field: keyof EntityStatistic, value: string) =>
    setStatistics(statistics.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  const removeStat = (id: string) => setStatistics(statistics.filter((s) => s.id !== id));

  const handleSave = () => {
    if (!name.trim() || !icon) return;
    onSave({
      name: name.trim(), icon, subtitle: subtitle.trim(),
      description: description.trim(), color, subItems, statistics,
      country: country.trim(),
      position: defaultPosition || { x: 400, y: 300 },
    });
    onClose();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'basic', label: 'Basic' },
    { id: 'details', label: 'Details' },
    { id: 'stats', label: 'Statistics' },
  ];

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
        width: '100%', maxWidth: 540, borderRadius: 16, padding: 0,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ color: '#93c5fd', fontSize: 18, fontWeight: 700 }}>
              {initialData?.id ? 'Edit Entity' : 'Create Entity'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={20} />
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: '8px 4px', background: 'none', border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#3b82f6' : 'transparent'}`,
                color: activeTab === tab.id ? '#3b82f6' : '#475569',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {tab.label}
                {tab.id === 'stats' && statistics.length > 0 && (
                  <span style={{
                    marginLeft: 5, background: '#3b82f6', color: 'white',
                    borderRadius: 8, padding: '1px 5px', fontSize: 10,
                  }}>{statistics.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* === BASIC TAB === */}
          {activeTab === 'basic' && (
            <>
              {/* Icon picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Icon
                  {!icon && (
                    <span style={{ marginLeft: 6, color: '#ef4444', fontSize: 10, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      — required
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {ENTITY_ICONS.map((ic) => (
                    <button key={ic.value} title={ic.label} onClick={() => setIcon(ic.value)} style={{
                      width: 38, height: 38, borderRadius: 8,
                      border: icon === ic.value ? '2px solid #06b6d4' : '1px solid rgba(59,130,246,0.2)',
                      background: icon === ic.value ? 'rgba(6,182,212,0.15)' : 'rgba(15,23,42,0.6)',
                      fontSize: 19, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s ease',
                    }}>
                      {ic.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Color</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {ENTITY_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} style={{
                      width: 30, height: 30, borderRadius: '50%', background: c,
                      border: color === c ? '3px solid white' : '2px solid transparent',
                      cursor: 'pointer', boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                      transition: 'all 0.15s ease',
                    }} />
                  ))}
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Name *</label>
                <input className="input-field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apple Inc." />
              </div>

              {/* Subtitle */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Subtitle</label>
                <input className="input-field mt-1" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Technology Giant · $AAPL" />
              </div>

              {/* Country */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Country / Location</label>
                <input className="input-field mt-1" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Description</label>
                <textarea className="input-field mt-1" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Business model, role in the scenario..." rows={3} style={{ resize: 'vertical' }} />
              </div>
            </>
          )}

          {/* === DETAILS TAB === */}
          {activeTab === 'details' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={labelStyle}>Sub-sections</label>
                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addSubItem}>
                  <Plus size={12} style={{ display: 'inline', marginRight: 4 }} />Add
                </button>
              </div>

              {/* Quick add preset sub-sections */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Quick add:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {['Revenue Streams', 'Key Risks', 'Customers', 'Competitors', 'Operations', 'Products', 'Key People', 'Supply Chain'].map((preset) => (
                    <button key={preset}
                      onClick={() => setSubItems([...subItems, { id: uuidv4(), title: preset, description: '' }])}
                      style={{
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#93c5fd', cursor: 'pointer',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.2)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)'}
                    >
                      + {preset}
                    </button>
                  ))}
                  {/* User-saved custom detail presets */}
                  {customDetailPresets.map((preset) => (
                    <span key={preset} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <button
                        onClick={() => setSubItems([...subItems, { id: uuidv4(), title: preset, description: '' }])}
                        style={{
                          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: '6px 0 0 6px', padding: '3px 8px', fontSize: 11, color: '#6ee7b7', cursor: 'pointer',
                        }}
                      >+ {preset}</button>
                      <button
                        onClick={() => removeCustomDetailPreset(preset)}
                        title="Remove preset"
                        style={{
                          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                          borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '3px 5px',
                          fontSize: 10, color: '#64748b', cursor: 'pointer',
                        }}
                      >×</button>
                    </span>
                  ))}
                </div>
                {/* Add custom preset */}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    className="input-field"
                    value={newDetailPreset}
                    onChange={(e) => setNewDetailPreset(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newDetailPreset.trim()) {
                        addCustomDetailPreset(newDetailPreset.trim());
                        setSubItems([...subItems, { id: uuidv4(), title: newDetailPreset.trim(), description: '' }]);
                        setNewDetailPreset('');
                      }
                    }}
                    placeholder="Save custom preset…"
                    style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                  />
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
                    disabled={!newDetailPreset.trim()}
                    onClick={() => {
                      if (!newDetailPreset.trim()) return;
                      addCustomDetailPreset(newDetailPreset.trim());
                      setSubItems([...subItems, { id: uuidv4(), title: newDetailPreset.trim(), description: '' }]);
                      setNewDetailPreset('');
                    }}
                  >
                    <Plus size={11} style={{ display: 'inline', marginRight: 3 }} />Save & Add
                  </button>
                </div>
              </div>

              {subItems.length === 0 && (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                  No sub-sections yet. Use quick add above or click Add.
                </div>
              )}
              {subItems.map((sub) => (
                <div key={sub.id} style={{
                  background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 10, padding: 12, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input className="input-field" value={sub.title}
                      onChange={(e) => updateSubItem(sub.id, 'title', e.target.value)}
                      placeholder="Heading (e.g. Revenue Streams)" style={{ flex: 1 }} />
                    <button onClick={() => removeSubItem(sub.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea className="input-field" value={sub.description}
                    onChange={(e) => updateSubItem(sub.id, 'description', e.target.value)}
                    placeholder="Description..." rows={2} style={{ resize: 'vertical', marginBottom: 6 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>Date</span>
                    <input
                      type="date"
                      value={sub.date || ''}
                      onChange={(e) => updateSubItem(sub.id, 'date', e.target.value)}
                      style={{
                        flex: 1, fontSize: 11, padding: '3px 7px',
                        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 6, color: '#94a3b8', outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === STATISTICS TAB === */}
          {activeTab === 'stats' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Key Statistics</label>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                    Stat names are saved as templates. Values can be updated any time.
                  </div>
                </div>
                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, flexShrink: 0 }} onClick={addStat}>
                  <Plus size={12} style={{ display: 'inline', marginRight: 4 }} />Add
                </button>
              </div>

              {statistics.length === 0 && (
                <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                  <BarChart2 size={24} style={{ margin: '0 auto 8px', color: '#334155' }} />
                  No statistics yet. Use quick add below.
                </div>
              )}

              {/* Preset suggestions — always visible */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Quick add:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {['Revenue', 'Net Income', 'Market Cap', 'P/E Ratio', 'EPS', 'Dividend Yield', 'Employees', 'Debt/Equity'].map((statName) => (
                    <button key={statName} onClick={() => setStatistics([...statistics, { id: uuidv4(), name: statName, value: '' }])}
                      style={{
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#93c5fd', cursor: 'pointer',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.2)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)'}
                    >
                      + {statName}
                    </button>
                  ))}
                  {/* User-saved custom presets */}
                  {customStatPresets.map((preset) => (
                    <span key={preset} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <button
                        onClick={() => setStatistics([...statistics, { id: uuidv4(), name: preset, value: '' }])}
                        style={{
                          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: '6px 0 0 6px', padding: '3px 8px', fontSize: 11, color: '#6ee7b7', cursor: 'pointer',
                        }}
                      >+ {preset}</button>
                      <button
                        onClick={() => removeCustomStatPreset(preset)}
                        title="Remove preset"
                        style={{
                          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                          borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '3px 5px',
                          fontSize: 10, color: '#64748b', cursor: 'pointer',
                        }}
                      >×</button>
                    </span>
                  ))}
                </div>
                {/* Add custom preset */}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    className="input-field"
                    value={newStatPreset}
                    onChange={(e) => setNewStatPreset(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newStatPreset.trim()) {
                        addCustomStatPreset(newStatPreset.trim());
                        setStatistics([...statistics, { id: uuidv4(), name: newStatPreset.trim(), value: '' }]);
                        setNewStatPreset('');
                      }
                    }}
                    placeholder="Save custom preset…"
                    style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                  />
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
                    disabled={!newStatPreset.trim()}
                    onClick={() => {
                      if (!newStatPreset.trim()) return;
                      addCustomStatPreset(newStatPreset.trim());
                      setStatistics([...statistics, { id: uuidv4(), name: newStatPreset.trim(), value: '' }]);
                      setNewStatPreset('');
                    }}
                  >
                    <Plus size={11} style={{ display: 'inline', marginRight: 3 }} />Save & Add
                  </button>
                </div>
              </div>

              {statistics.map((stat, i) => (
                <div key={stat.id} style={{
                  marginBottom: 8,
                  background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(59,130,246,0.15)',
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: '#475569', width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
                    <input
                      className="input-field"
                      value={stat.name}
                      onChange={(e) => updateStat(stat.id, 'name', e.target.value)}
                      placeholder="Stat name (e.g. Revenue)"
                      style={{ flex: 1 }}
                    />
                    <input
                      className="input-field"
                      value={stat.value}
                      onChange={(e) => updateStat(stat.id, 'value', e.target.value)}
                      placeholder="Value (e.g. $394B)"
                      style={{ flex: 1 }}
                    />
                    <button onClick={() => removeStat(stat.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 28 }}>
                    <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>As of</span>
                    <input
                      type="date"
                      value={stat.asOf || ''}
                      onChange={(e) => updateStat(stat.id, 'asOf', e.target.value)}
                      style={{
                        flex: 1, fontSize: 11, padding: '3px 7px',
                        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 6, color: '#94a3b8', outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(59,130,246,0.1)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!name.trim() || !icon}>
            {initialData?.id ? 'Save Changes' : 'Create Entity'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
