'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Map, Clock } from 'lucide-react';
import { useMapStore } from '../store/mapStore';

interface MapsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  required?: boolean;
  loading?: boolean;
}

export default function MapsDialog({ isOpen, onClose, required = false, loading = false }: MapsDialogProps) {
  const { savedMaps, currentMap, loadMap, createNewMap, deleteMap, saveCurrentMap } = useMapStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    createNewMap(newName.trim(), newDesc.trim());
    setNewName('');
    setNewDesc('');
    setCreating(false);
    onClose();
  };

  const handleLoad = (id: string) => {
    saveCurrentMap();
    loadMap(id);
    onClose();
  };

  const allMaps = [
    currentMap,
    ...savedMaps.filter((m) => m.id !== currentMap.id),
  ];

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
      onClick={(e) => { if (!required && e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="glass-panel fade-in"
        style={{ width: '100%', maxWidth: 520, borderRadius: 16, padding: 24, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: required ? 8 : 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Map size={18} style={{ color: '#06b6d4' }} />
            <h2 style={{ color: '#93c5fd', fontSize: 18, fontWeight: 700 }}>
              {required ? 'Welcome to Plotifolio' : 'My Maps'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-primary"
              onClick={() => setCreating(true)}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <Plus size={13} style={{ display: 'inline', marginRight: 4 }} />
              New Map
            </button>
            {!required && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            )}
          </div>
        </div>
        {required && (
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
            {loading ? 'Loading your maps…' : 'Choose a map to open or create a new one to get started.'}
          </p>
        )}

        {/* Create new map form */}
        {creating && (
          <div
            className="fade-in"
            style={{
              marginBottom: 16,
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <input
              className="input-field"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Map name..."
              autoFocus
              style={{ marginBottom: 8 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
            />
            <textarea
              className="input-field"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)..."
              rows={2}
              style={{ marginBottom: 10, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={handleCreate} style={{ flex: 1 }}>Create</button>
              <button className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Maps list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#475569', padding: 32, fontSize: 14 }}>
              Loading your maps…
            </div>
          ) : (
            <>
              {allMaps.map((map) => {
                const isCurrent = map.id === currentMap.id;
                return (
                  <div
                    key={map.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 10,
                      marginBottom: 6,
                      background: isCurrent ? 'rgba(59,130,246,0.12)' : 'rgba(15,23,42,0.5)',
                      border: `1px solid ${isCurrent ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.1)'}`,
                      cursor: isCurrent ? 'default' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => !isCurrent && handleLoad(map.id)}
                    onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.08)'; }}
                    onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.5)'; }}
                  >
                    <Map size={18} style={{ color: isCurrent ? '#06b6d4' : '#3b82f6', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: isCurrent ? '#93c5fd' : '#e2e8f0', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {map.name}
                        </span>
                        {isCurrent && (
                          <span style={{ fontSize: 10, background: 'rgba(6,182,212,0.2)', color: '#06b6d4', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                            Active
                          </span>
                        )}
                      </div>
                      {map.description && (
                        <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {map.description}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: '#475569' }}>{map.entities.length} entities</span>
                        <span style={{ fontSize: 10, color: '#475569' }}>{map.relationships.length} connections</span>
                        <span style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={9} />
                          {new Date(map.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMap(map.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, flexShrink: 0 }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#475569')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}

              {allMaps.length === 0 && (
                <div style={{ textAlign: 'center', color: '#475569', padding: 32, fontSize: 14 }}>
                  No maps yet. Create your first map!
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
