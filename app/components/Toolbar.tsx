'use client';

import React, { useState } from 'react';
import {
  Save, Share2, Map, Plus, Link2, X,
  ChevronDown, TrendingUp, LogIn, LogOut, User,
  ZoomIn, ZoomOut, RotateCcw, Lock, Unlock, Clock, Globe, Square, BarChart3, Newspaper, Zap,
} from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import ShareDialog from './ShareDialog';
import ComparisonOverlay from './ComparisonOverlay';
import NewsFeed from './NewsFeed';
import ScenarioPropagator from './ScenarioPropagator';
import MapsDialog from './MapsDialog';
import WorldClockPanel from './WorldClockPanel';
import CalendarPicker from './CalendarPicker';

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
  showWorldMap: boolean;
  onToggleWorldMap: () => void;
}

export default function Toolbar({
  onAddEntity, isConnecting, onToggleConnect,
  session, onSignIn, onSignOut,
  zoom, onZoomIn, onZoomOut, onZoomReset,
  showWorldMap, onToggleWorldMap,
}: ToolbarProps) {
  const { currentMap, saveCurrentMap, globalLocked, toggleGlobalLock } = useMapStore();
  const [showShare, setShowShare] = useState(false);
  const [showMaps, setShowMaps] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [showScenario, setShowScenario] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const handleSave = async () => {
    // Always save locally first
    saveCurrentMap();

    if (!session?.user) {
      // Not logged in — show prompt
      setShowLoginPrompt(true);
      return;
    }

    // Logged in — also save to cloud
    setSaving(true);
    try {
      await fetch('/api/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: currentMap }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
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
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>Plotifolio</span>
            <span style={{ fontSize: 9, color: '#8899b0', lineHeight: 1 }}>Scenario Planner</span>
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
          <ChevronDown size={11} style={{ marginLeft: 4, color: '#8899b0', display: 'inline' }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginRight: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{currentMap.entities.length}</span> entities
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
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
              color: zoom !== 1 ? '#3b82f6' : '#94a3b8', fontSize: 11, fontWeight: 600,
              padding: '3px 6px', borderRadius: 5, minWidth: 38, textAlign: 'center',
              transition: 'color 0.15s',
            }}>
              {Math.round(zoom * 100)}%
            </button>
            <IconBtn icon={<ZoomIn size={13} />} title="Zoom in (Ctrl +)" onClick={onZoomIn} />
          </div>

          {/* Global lock */}
          <button
            onClick={toggleGlobalLock}
            title={globalLocked ? 'Unlock all entities' : 'Lock all entities'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${globalLocked ? '#f59e0b' : 'rgba(59,130,246,0.2)'}`,
              background: globalLocked ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: globalLocked ? '#f59e0b' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            {globalLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>

          {/* Calendar date filter */}
          <CalendarPicker />

          {/* Background type — two separate buttons */}
          <div style={{
            display: 'flex', borderRadius: 8, overflow: 'hidden',
            border: '1px solid rgba(59,130,246,0.2)',
          }}>
            <button
              title={showWorldMap ? 'World map active' : 'Cannot switch back to world map (irreversible)'}
              onClick={undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                fontSize: 12, cursor: 'default', border: 'none',
                borderRight: '1px solid rgba(59,130,246,0.2)',
                background: showWorldMap ? 'rgba(6,182,212,0.15)' : 'transparent',
                color: showWorldMap ? '#06b6d4' : '#8899b0',
                opacity: showWorldMap ? 1 : 0.35,
                transition: 'all 0.15s',
              }}
            >
              <Globe size={13} />
              <span>World</span>
            </button>
            <button
              title={showWorldMap ? 'Switch to plain canvas (irreversible — warns first)' : 'Plain canvas active'}
              onClick={showWorldMap ? onToggleWorldMap : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                fontSize: 12, border: 'none',
                cursor: showWorldMap ? 'pointer' : 'default',
                background: !showWorldMap ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: !showWorldMap ? '#93c5fd' : '#94a3b8',
                transition: 'all 0.15s',
              }}
            >
              <Square size={13} />
              <span>Plain</span>
            </button>
          </div>

          {/* World Clock */}
          <button
            onClick={() => setShowClock((v) => !v)}
            title="World Time"
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${showClock ? '#3b82f6' : 'rgba(59,130,246,0.2)'}`,
              background: showClock ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: showClock ? '#3b82f6' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            <Clock size={13} />
          </button>

          {/* Save */}
          <button className="btn-ghost" onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12, opacity: saving ? 0.7 : 1 }}>
            <Save size={13} />
            {saving ? 'Saving…' : saved ? '✓ Cloud Saved' : 'Save'}
          </button>

          {/* Maps */}
          <button className="btn-ghost" onClick={() => setShowMaps(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
            <Map size={13} />Maps
          </button>

          {/* Compare */}
          <button className="btn-ghost" onClick={() => setShowComparison(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
            <BarChart3 size={13} />Compare
          </button>

          {/* News */}
          <button className="btn-ghost" onClick={() => setShowNews(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
            <Newspaper size={13} />News
          </button>

          {/* Scenario */}
          <button className="btn-ghost" onClick={() => setShowScenario(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
            <Zap size={13} />Scenario
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0', display: 'flex' }}>
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
      <MapsDialog isOpen={showMaps} onClose={() => setShowMaps(false)} session={session} onSignIn={onSignIn} />
      <ComparisonOverlay isOpen={showComparison} onClose={() => setShowComparison(false)} />
      <NewsFeed isOpen={showNews} onClose={() => setShowNews(false)} />
      <ScenarioPropagator isOpen={showScenario} onClose={() => setShowScenario(false)} />
      {showClock && <WorldClockPanel onClose={() => setShowClock(false)} />}

      {/* Login prompt modal */}
      {showLoginPrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowLoginPrompt(false)}>
          <div style={{
            background: 'rgba(15,23,42,0.98)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 16, padding: 32, maxWidth: 380, width: '90%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Save size={22} color="white" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                Sign in to save to the cloud
              </div>
              <div style={{ fontSize: 13, color: '#8899b0', lineHeight: 1.5 }}>
                Your map was saved locally. Sign in with Google to sync it to your account and access it from any device.
              </div>
            </div>
            <button
              onClick={() => { setShowLoginPrompt(false); onSignIn(); }}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                border: 'none', cursor: 'pointer',
                color: 'white', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <LogIn size={15} /> Sign in with Google
            </button>
            <button
              onClick={() => setShowLoginPrompt(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#94a3b8', fontSize: 13,
              }}
            >
              Continue without signing in
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0',
      padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center',
      transition: 'color 0.12s',
    }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#8899b0')}
    >
      {icon}
    </button>
  );
}
