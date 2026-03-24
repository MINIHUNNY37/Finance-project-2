'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Map, Clock, Globe, Square, LogIn, Upload, AlertCircle, LayoutTemplate, Download, CheckCircle, Pencil, Check } from 'lucide-react';
import { useMapStore } from '../store/mapStore';

interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  updatedAt: string;
}

interface MapsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  required?: boolean;
  loading?: boolean;
  session?: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null;
  onSignIn?: () => void;
}

export default function MapsDialog({ isOpen, onClose, required = false, loading = false, session, onSignIn }: MapsDialogProps) {
  const { savedMaps, currentMap, loadMap, createNewMap, deleteMap, renameMap, saveCurrentMap, importMapFromCode, mergeCloudMaps } = useMapStore();
  const [creating, setCreating] = useState(false);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [mapTypeChoice, setMapTypeChoice] = useState<'world' | 'plain'>('world');
  const [showAuthGate, setShowAuthGate] = useState(false);

  // Import from code
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');

  // Templates
  const [activeTab, setActiveTab] = useState<'my-maps' | 'templates'>('my-maps');
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [clonedId, setClonedId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!session?.user) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/markets/template');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
      }
    } catch { /* ignore */ }
    finally { setTemplatesLoading(false); }
  }, [session?.user]);

  useEffect(() => {
    if (isOpen && activeTab === 'templates') {
      fetchTemplates();
    }
  }, [isOpen, activeTab, fetchTemplates]);

  const handleCloneTemplate = async (templateId: string) => {
    if (!session?.user) { onSignIn?.(); return; }
    setCloningId(templateId);
    try {
      const res = await fetch('/api/markets/template/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (res.ok) {
        const { mapId } = await res.json();
        setClonedId(templateId);
        // Pull from cloud so the new map appears in savedMaps
        const mapsRes = await fetch('/api/maps');
        if (mapsRes.ok) {
          const { maps } = await mapsRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mergeCloudMaps(maps.map((m: any) => JSON.parse(m.data)));
        }
        setTimeout(() => {
          loadMap(mapId);
          onClose();
        }, 800);
      }
    } catch { /* ignore */ }
    finally { setCloningId(null); }
  };

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
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Map size={18} style={{ color: '#06b6d4' }} />
            <h2 style={{ color: '#93c5fd', fontSize: 18, fontWeight: 700 }}>
              {required ? 'Welcome to Plotifolio' : 'My Maps'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab === 'my-maps' && (
              <>
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
              </>
            )}
            {!required && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0' }}>
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(59,130,246,0.15)', paddingBottom: 0 }}>
          {(['my-maps', 'templates'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                color: activeTab === tab ? '#06b6d4' : '#8899b0',
                borderBottom: activeTab === tab ? '2px solid #06b6d4' : '2px solid transparent',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {tab === 'my-maps' ? <><Map size={12} /> My Maps</> : <><LayoutTemplate size={12} /> Market Templates</>}
            </button>
          ))}
        </div>

        {required && activeTab === 'my-maps' && (
          <p style={{ fontSize: 13, color: '#8899b0', marginBottom: 16, lineHeight: 1.5 }}>
            {loading ? 'Loading your maps…' : 'Choose a map to open, import one, or create a new one to get started.'}
          </p>
        )}

        {/* ── Templates tab ─────────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {templatesLoading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 14 }}>
                Loading templates…
              </div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13, lineHeight: 1.6 }}>
                <LayoutTemplate size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
                <div>No market templates available yet.</div>
                {session?.user && (
                  <div style={{ fontSize: 11, marginTop: 6 }}>
                    An admin needs to run the market seeder at<br />
                    <code style={{ color: '#06b6d4' }}>POST /api/admin/seed-markets</code>
                  </div>
                )}
              </div>
            ) : (
              templates.map(t => (
                <div
                  key={t.id}
                  style={{
                    padding: '14px 16px', borderRadius: 12, marginBottom: 10,
                    background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(6,182,212,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <LayoutTemplate size={14} style={{ color: '#06b6d4', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>{t.name}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: 'rgba(6,182,212,0.15)', color: '#06b6d4',
                          borderRadius: 4, padding: '2px 6px', flexShrink: 0,
                        }}>
                          {t.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#8899b0', lineHeight: 1.5, marginBottom: 6 }}>
                        {t.description}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        Updated {new Date(t.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCloneTemplate(t.id)}
                      disabled={cloningId === t.id || clonedId === t.id}
                      style={{
                        flexShrink: 0,
                        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: clonedId === t.id
                          ? 'rgba(16,185,129,0.2)'
                          : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                        color: clonedId === t.id ? '#10b981' : 'white',
                        fontSize: 11, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 5,
                        opacity: cloningId === t.id ? 0.6 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {clonedId === t.id
                        ? <><CheckCircle size={12} /> Added!</>
                        : cloningId === t.id
                        ? 'Adding…'
                        : <><Download size={12} /> Use Template</>
                      }
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── My Maps tab ───────────────────────────────────────────────── */}
        {activeTab === 'my-maps' && <>

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
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 }}>
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
                  <div style={{ fontSize: 12, color: '#8899b0', lineHeight: 1.5 }}>
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12 }}
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
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8899b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Background Type
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setMapTypeChoice('world')}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8,
                        border: `1px solid ${mapTypeChoice === 'world' ? 'rgba(6,182,212,0.6)' : 'rgba(59,130,246,0.2)'}`,
                        background: mapTypeChoice === 'world' ? 'rgba(6,182,212,0.1)' : 'transparent',
                        color: mapTypeChoice === 'world' ? '#06b6d4' : '#8899b0',
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
                        color: mapTypeChoice === 'plain' ? '#93c5fd' : '#8899b0',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontSize: 12, fontWeight: mapTypeChoice === 'plain' ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      <Square size={13} /> Plain
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, lineHeight: 1.4 }}>
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
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 14 }}>
              Loading your maps…
            </div>
          ) : (
            <>
              {allMaps.map((map) => {
                const isCurrent = map.id === currentMap.id;
                const isEditing = editingMapId === map.id;
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
                    onClick={() => !isCurrent && !isEditing && handleLoad(map.id)}
                    onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.08)'; }}
                    onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.5)'; }}
                  >
                    {map.mapType === 'plain'
                      ? <Square size={18} style={{ color: isCurrent ? '#06b6d4' : '#3b82f6', flexShrink: 0 }} />
                      : <Map size={18} style={{ color: isCurrent ? '#06b6d4' : '#3b82f6', flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter' && editingName.trim()) {
                                renameMap(map.id, editingName.trim());
                                setEditingMapId(null);
                              } else if (e.key === 'Escape') {
                                setEditingMapId(null);
                              }
                            }}
                            style={{
                              flex: 1, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.4)',
                              color: '#e2e8f0', borderRadius: 6, padding: '2px 8px', fontSize: 14, outline: 'none',
                            }}
                          />
                        ) : (
                          <span style={{ fontWeight: 600, color: isCurrent ? '#93c5fd' : '#e2e8f0', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {map.name}
                          </span>
                        )}
                        {isCurrent && !isEditing && (
                          <span style={{ fontSize: 10, background: 'rgba(6,182,212,0.2)', color: '#06b6d4', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                            Active
                          </span>
                        )}
                        {!isEditing && (
                          <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.1)', color: '#94a3b8', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                            {map.mapType === 'plain' ? 'Plain' : 'World Map'}
                          </span>
                        )}
                      </div>
                      {map.description && !isEditing && (
                        <div style={{ fontSize: 11, color: '#8899b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {map.description}
                        </div>
                      )}
                      {!isEditing && (
                        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{(map.entities ?? []).length} entities</span>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{(map.relationships ?? []).length} connections</span>
                          <span style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={9} />
                            {new Date(map.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Rename confirm button */}
                    {isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingName.trim()) { renameMap(map.id, editingName.trim()); }
                          setEditingMapId(null);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: 4, flexShrink: 0 }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {/* Rename (pencil) button */}
                    {!isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMapId(map.id);
                          setEditingName(map.name);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, flexShrink: 0 }}
                        title="Rename map"
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#93c5fd')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#94a3b8')}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {/* Delete button */}
                    {!isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrent && allMaps.length === 1) return; // keep at least one map
                          deleteMap(map.id);
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: isCurrent && allMaps.length === 1 ? '#334155' : '#94a3b8',
                          padding: 4, flexShrink: 0,
                        }}
                        title={isCurrent && allMaps.length === 1 ? 'Cannot delete the only map' : 'Delete map'}
                        onMouseEnter={(e) => { if (!(isCurrent && allMaps.length === 1)) (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                        onMouseLeave={(e) => { if (!(isCurrent && allMaps.length === 1)) (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}

              {allMaps.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 14 }}>
                  No maps yet. Create your first map, or check the{' '}
                  <button
                    onClick={() => setActiveTab('templates')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#06b6d4', fontSize: 14, padding: 0 }}
                  >
                    Market Templates
                  </button>{' '}tab to get started instantly.
                </div>
              )}
            </>
          )}
        </div>

        </> /* end my-maps tab */}
      </div>
    </div>
  );
}
