'use client';

import React, { useState } from 'react';
import {
  Save, Share2, Map, Plus, Link2, X,
  ChevronDown, TrendingUp, LogIn, LogOut, User,
  ZoomIn, ZoomOut, RotateCcw, Lock, Unlock, Clock,
} from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import ShareDialog from './ShareDialog';
import MapsDialog from './MapsDialog';
import WorldClockPanel from './WorldClockPanel';

interface ToolbarProps {
  onAddEntity: () => void;
  isConnecting: boolean;
  onToggleConnect: () => void;
  session: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null;
  onSignIn: () => void;
  onSignOut: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  fixedEntitySize: boolean;
  onToggleFixedEntitySize: () => void;
}

export default function Toolbar({
  onAddEntity, isConnecting, onToggleConnect,
  session, onSignIn, onSignOut,
  zoom, onZoomIn, onZoomOut, onZoomReset,
  fixedEntitySize, onToggleFixedEntitySize,
}: ToolbarProps) {
  const { currentMap, saveCurrentMap, globalLocked, toggleGlobalLock } = useMapStore();
  const [showShare, setShowShare] = useState(false);
  const [showMaps, setShowMaps] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveCurrentMap();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        background: 'rgba(10,17,34,0.97)',
        borderBottom: '1px solid rgba(59,130,246,0.18)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 6, zIndex: 500,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 10, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={16} color="white" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>StockMapper</span>
            <span style={{ fontSize: 9, color: '#64748b', lineHeight: 1 }}>Scenario Planner</span>
          </div>
        </div>

        {/* Map name */}
        <div
          style={{
            fontSize: 13, fontWeight: 600, color: '#93c5fd',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
            transition: 'background 0.15s', flexShrink: 1, minWidth: 0,
          }}
          onClick={() => setShowMaps(true)}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          title="Click to manage maps"
        >
          {currentMap.name}
          <ChevronDown size={11} style={{ marginLeft: 4, color: '#64748b', display: 'inline' }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginRight: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#475569' }}>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{currentMap.entities.length}</span> entities
          </span>
          <span style={{ fontSize: 11, color: '#475569' }}>
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>{currentMap.relationships.length}</span> connections
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* === Action group === */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>

          {/* Add Entity */}
          <button className="btn-primary" onClick={onAddEntity}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12 }}>
            <Plus size={13} />Add Entity
          </button>

          {/* Connect toggle */}
          <button onClick={onToggleConnect} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 8, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${isConnecting ? '#06b6d4' : 'rgba(59,130,246,0.3)'}`,
            background: isConnecting ? 'rgba(6,182,212,0.15)' : 'transparent',
            color: isConnecting ? '#06b6d4' : '#93c5fd',
            transition: 'all 0.15s ease',
          }}>
            {isConnecting ? <X size={13} /> : <Link2 size={13} />}
            <span>{isConnecting ? 'Cancel' : 'Connect'}</span>
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(59,130,246,0.15)', margin: '0 2px' }} />

          {/* Zoom controls */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 1,
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 8, padding: '2px 4px',
          }}>
            <IconBtn icon={<ZoomOut size={13} />} title="Zoom out (Ctrl –)" onClick={onZoomOut} />
            <button onClick={onZoomReset} title="Reset zoom (Ctrl 0)" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: zoom !== 1 ? '#3b82f6' : '#475569', fontSize: 11, fontWeight: 600,
              padding: '3px 6px', borderRadius: 5, minWidth: 38, textAlign: 'center',
              transition: 'color 0.15s',
            }}>
              {Math.round(zoom * 100)}%
            </button>
            <IconBtn icon={<ZoomIn size={13} />} title="Zoom in (Ctrl +)" onClick={onZoomIn} />
          </div>

          {/* Global entity size mode toggle */}
          <button
            onClick={onToggleFixedEntitySize}
            title={fixedEntitySize
              ? 'All entities: fixed size (same on screen at any zoom) — click to auto-scale'
              : 'All entities: auto-scale (shrink at high zoom for country-level view) — click to fix size'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${fixedEntitySize ? '#3b82f6' : 'rgba(59,130,246,0.2)'}`,
              background: fixedEntitySize ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: fixedEntitySize ? '#3b82f6' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            {fixedEntitySize ? <Lock size={13} /> : <Unlock size={13} />}
            <span>{fixedEntitySize ? 'Fixed size' : 'Auto size'}</span>
          </button>

          {/* Global lock */}
          <button
            onClick={toggleGlobalLock}
            title={globalLocked ? 'Unlock all entities' : 'Lock all entities'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${globalLocked ? '#f59e0b' : 'rgba(59,130,246,0.2)'}`,
              background: globalLocked ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: globalLocked ? '#f59e0b' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            {globalLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>

          {/* World Clock */}
          <button
            onClick={() => setShowClock((v) => !v)}
            title="World Time"
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${showClock ? '#3b82f6' : 'rgba(59,130,246,0.2)'}`,
              background: showClock ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: showClock ? '#3b82f6' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            <Clock size={13} />
          </button>

          {/* Save */}
          <button className="btn-ghost" onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
            <Save size={13} />{saved ? '✓ Saved' : 'Save'}
          </button>

          {/* Maps */}
          <button className="btn-ghost" onClick={() => setShowMaps(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
            <Map size={13} />Maps
          </button>

          {/* Share */}
          <button className="btn-ghost" onClick={() => setShowShare(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
            <Share2 size={13} />Share
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(59,130,246,0.15)', margin: '0 2px' }} />

          {/* Auth */}
          {session?.user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt={session.user.name || 'User'}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.4)' }} />
              ) : (
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={13} style={{ color: '#3b82f6' }} />
                </div>
              )}
              <button onClick={onSignOut} title="Sign out"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button className="btn-ghost" onClick={onSignIn}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
              <LogIn size={13} />Sign In
            </button>
          )}
        </div>
      </div>

      <ShareDialog isOpen={showShare} onClose={() => setShowShare(false)} />
      <MapsDialog isOpen={showMaps} onClose={() => setShowMaps(false)} />
      {showClock && <WorldClockPanel onClose={() => setShowClock(false)} />}
    </>
  );
}

function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
      padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center',
      transition: 'color 0.12s',
    }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
    >
      {icon}
    </button>
  );
}
