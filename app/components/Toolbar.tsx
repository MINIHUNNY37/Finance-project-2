'use client';

import React, { useState } from 'react';
import {
  Save, Share2, Map,
  ChevronDown, TrendingUp, LogIn, LogOut, User,
  Clock, Globe, Square, BarChart3,
} from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import ShareDialog from './ShareDialog';
import ComparisonOverlay from './ComparisonOverlay';
import MapsDialog from './MapsDialog';
import WorldClockPanel from './WorldClockPanel';
import CalendarPicker from './CalendarPicker';

interface ToolbarProps {
  isConnecting: boolean;
  onToggleConnect: () => void;
  session: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null;
  onSignIn: () => void;
  onSignOut: () => void;
  showWorldMap: boolean;
  onToggleWorldMap: () => void;
}

export default function Toolbar({
  isConnecting, onToggleConnect,
  session, onSignIn, onSignOut,
  showWorldMap, onToggleWorldMap,
}: ToolbarProps) {
  const { currentMap, saveCurrentMap, globalLocked, toggleGlobalLock } = useMapStore();
  const [showShare, setShowShare] = useState(false);
  const [showMaps, setShowMaps] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
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
        position: 'fixed', top: 0, left: 0, right: 0, height: 68,
        background: 'rgba(10,17,34,0.97)',
        borderBottom: '1px solid rgba(59,130,246,0.18)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 7, zIndex: 500,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 10, flexShrink: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={19} color="white" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>Plotifolio</span>
            <span style={{ fontSize: 11, color: '#8899b0', lineHeight: 1 }}>Scenario Planner</span>
          </div>
        </div>

        {/* Map name */}
        <div
          style={{
            fontSize: 14, fontWeight: 600, color: '#93c5fd',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: 'pointer', padding: '5px 10px', borderRadius: 7,
            transition: 'background 0.15s', flexShrink: 1, minWidth: 0,
          }}
          onClick={() => setShowMaps(true)}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          title="Click to manage maps"
        >
          {currentMap.name}
          <ChevronDown size={13} style={{ marginLeft: 4, color: '#8899b0', display: 'inline' }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginRight: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{currentMap.entities.length}</span> entities
          </span>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>{currentMap.relationships.length}</span> connections
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* === Action group === */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>

          {/* Calendar date filter */}
          <CalendarPicker />

          {/* Background type — two separate buttons */}
          <div style={{
            display: 'flex', borderRadius: 8, overflow: 'visible',
            border: '1px solid rgba(59,130,246,0.2)', flexShrink: 0,
          }}>
            <button
              title={showWorldMap ? 'World map active' : 'Cannot switch back to world map (irreversible)'}
              onClick={undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                fontSize: 13, cursor: 'default', border: 'none', whiteSpace: 'nowrap',
                borderRight: '1px solid rgba(59,130,246,0.2)',
                borderRadius: '8px 0 0 8px',
                background: showWorldMap ? 'rgba(6,182,212,0.15)' : 'transparent',
                color: showWorldMap ? '#06b6d4' : '#8899b0',
                opacity: showWorldMap ? 1 : 0.35,
                transition: 'all 0.15s',
              }}
            >
              <Globe size={15} />
              <span>World</span>
            </button>
            <button
              title={showWorldMap ? 'Switch to plain canvas (irreversible — warns first)' : 'Plain canvas active'}
              onClick={showWorldMap ? onToggleWorldMap : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                fontSize: 13, border: 'none', whiteSpace: 'nowrap',
                borderRadius: '0 8px 8px 0',
                cursor: showWorldMap ? 'pointer' : 'default',
                background: !showWorldMap ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: !showWorldMap ? '#93c5fd' : '#94a3b8',
                transition: 'all 0.15s',
              }}
            >
              <Square size={15} />
              <span>Plain</span>
            </button>
          </div>

          {/* World Clock */}
          <button
            onClick={() => setShowClock((v) => !v)}
            title="World Time"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: `1px solid ${showClock ? '#3b82f6' : 'rgba(59,130,246,0.2)'}`,
              background: showClock ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: showClock ? '#3b82f6' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            <Clock size={15} />
          </button>

          {/* Save */}
          <button className="btn-ghost" onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            <Save size={15} />
            {saving ? 'Saving…' : saved ? '✓ Cloud Saved' : 'Save'}
          </button>

          {/* Maps */}
          <button className="btn-ghost" onClick={() => setShowMaps(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}>
            <Map size={15} />Maps
          </button>

          {/* Compare */}
          <button className="btn-ghost" onClick={() => setShowComparison(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}>
            <BarChart3 size={15} />Compare
          </button>

          {/* Share */}
          <button className="btn-ghost" onClick={() => setShowShare(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}>
            <Share2 size={15} />Share
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: 'rgba(59,130,246,0.15)', margin: '0 2px' }} />

          {/* Auth */}
          {session?.user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt={session.user.name || 'User'}
                  style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.4)' }} />
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={15} style={{ color: '#3b82f6' }} />
                </div>
              )}
              <button onClick={onSignOut} title="Sign out"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0', display: 'flex' }}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="btn-ghost" onClick={onSignIn}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}>
              <LogIn size={15} />Sign In
            </button>
          )}
        </div>
      </div>

      <ShareDialog isOpen={showShare} onClose={() => setShowShare(false)} />
      <MapsDialog isOpen={showMaps} onClose={() => setShowMaps(false)} session={session} onSignIn={onSignIn} />
      <ComparisonOverlay isOpen={showComparison} onClose={() => setShowComparison(false)} />
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
