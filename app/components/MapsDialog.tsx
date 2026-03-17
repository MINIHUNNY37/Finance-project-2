'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Map, Clock, Globe, Square, LogIn, Upload, AlertCircle } from 'lucide-react';
import { useMapStore } from '../store/mapStore';

interface MapsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  required?: boolean;
  loading?: boolean;
  session?: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null;
  onSignIn?: () => void;
}

export default function MapsDialog({ isOpen, onClose, required = false, loading = false, session, onSignIn }: MapsDialogProps) {
  const { savedMaps, currentMap, loadMap, createNewMap, deleteMap, saveCurrentMap, importMapFromCode } = useMapStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [mapTypeChoice, setMapTypeChoice] = useState<'world' | 'plain'>('world');
  const [showAuthGate, setShowAuthGate] = useState(false);

  // Import from code
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');

  if (!isOpen) return null;

  const isSignedIn = !!session?.user;

  const handleCreate = () => {
    if (!newName.trim()) return;
    if (!isSignedIn) {
      setShowAuthGate(true);
      return;
    }
    createNewMap(newName.trim(), newDesc.trim(), mapTypeChoice);
    setNewName('');
    setNewDesc('');
    setCreating(false);
    setMapTypeChoice('world');
    onClose();
  };

  const handleLoad = (id: string) => {
    saveCurrentMap();
    loadMap(id);
    onClose();
  };

  const handleImport = () => {
    if (!importCode.trim()) return;
    const success = importMapFromCode(importCode.trim());
    if (success) {
      setImportCode('');
      setImportError('');
      setShowImport(false);
      onClose();
    } else {
      setImportError('Invalid map code. Please check and try again.');
    }
  };

  const handleSignIn = () => {
    onSignIn?.();
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
        style={{ width: '100%', maxWidth: 520, borderRadius: 16, padding: 24, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: required ? 8 : 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Map size={18} style={{ color: '#06b6d4' }} />
            <h2 style={{ color: '#93c5fd', fontSize: 18, fontWeight: 700 }}>
              {required ? 'Welcome to Plotifolio' : 'My Maps'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Import from code button */}
            <button
              className="btn-ghost"
              onClick={() => { setShowImport((v) => !v); setCreating(false); }}
              style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              title="Import a map from a shared code"
            >
              <Upload size={13} />
              Import
            </button>
            <button
              className="btn-primary"
              onClick={() => { setCreating(true); setShowImport(false); setShowAuthGate(false); }}
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
            {loading ? 'Loading your maps…' : 'Choose a map to open, import one, or create a new one to get started.'}
          </p>
        )}

        {/* Import from code panel */}
        {showImport && (
          <div
            className="fade-in"
            style={{
              marginBottom: 16,
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(6,182,212,0.25)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#06b6d4', marginBottom: 8 }}>
              Paste Map Code
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, lineHeight: 1.5 }}>
              Paste a map code shared via the Share dialog to create an independent copy of that map.
            </div>
            <textarea
              className="input-field"
              value={importCode}
              onChange={(e) => { setImportCode(e.target.value); setImportError(''); }}
              placeholder="Paste map code here..."
              rows={3}
              style={{ marginBottom: 8, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
            />
            {importError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 12, marginBottom: 8 }}>
                <AlertCircle size={13} />
                {importError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={handleImport} style={{ flex: 1 }}>Import Map</button>
              <button className="btn-ghost" onClick={() => { setShowImport(false); setImportCode(''); setImportError(''); }}>Cancel</button>
            </div>
          </div>
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
            {/* Auth gate — shown when not signed in */}
            {showAuthGate ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <LogIn size={28} style={{ color: '#3b82f6' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
                    Sign in to create a map
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    You need to sign in before creating a new map.
                  </div>
                </div>
                <button
                  onClick={handleSignIn}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                    border: 'none', cursor: 'pointer',
                    color: 'white', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <LogIn size={14} /> Sign in with Google
                </button>
                <button
                  onClick={() => setShowAuthGate(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 12 }}
                >
                  ← Back
                </button>
              </div>
            ) : (
              <>
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
                  style={{ marginBottom: 12, resize: 'vertical' }}
                />

                {/* Map type selection */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Background Type
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setMapTypeChoice('world')}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8,
                        border: `1px solid ${mapTypeChoice === 'world' ? 'rgba(6,182,212,0.6)' : 'rgba(59,130,246,0.2)'}`,
                        background: mapTypeChoice === 'world' ? 'rgba(6,182,212,0.1)' : 'transparent',
                        color: mapTypeChoice === 'world' ? '#06b6d4' : '#64748b',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontSize: 12, fontWeight: mapTypeChoice === 'world' ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      <Globe size={13} /> World Map
                    </button>
                    <button
                      onClick={() => setMapTypeChoice('plain')}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8,
                        border: `1px solid ${mapTypeChoice === 'plain' ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.2)'}`,
                        background: mapTypeChoice === 'plain' ? 'rgba(59,130,246,0.1)' : 'transparent',
                        color: mapTypeChoice === 'plain' ? '#93c5fd' : '#64748b',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontSize: 12, fontWeight: mapTypeChoice === 'plain' ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      <Square size={13} /> Plain
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 6, lineHeight: 1.4 }}>
                    {mapTypeChoice === 'world'
                      ? 'Interactive world map — great for tracking global operations.'
                      : 'Clean blank canvas — great for org charts and abstract diagrams.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={handleCreate} style={{ flex: 1 }}>Create</button>
                  <button className="btn-ghost" onClick={() => { setCreating(false); setShowAuthGate(false); }}>Cancel</button>
                </div>
              </>
            )}
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
                    {map.mapType === 'plain'
                      ? <Square size={18} style={{ color: isCurrent ? '#06b6d4' : '#3b82f6', flexShrink: 0 }} />
                      : <Map size={18} style={{ color: isCurrent ? '#06b6d4' : '#3b82f6', flexShrink: 0 }} />
                    }
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
                        <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.1)', color: '#475569', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                          {map.mapType === 'plain' ? 'Plain' : 'World Map'}
                        </span>
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
