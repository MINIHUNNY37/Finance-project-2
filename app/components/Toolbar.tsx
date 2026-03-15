'use client';

import React, { useState } from 'react';
import {
  Save,
  Share2,
  Map,
  Plus,
  Link2,
  X,
  ChevronDown,
  TrendingUp,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import ShareDialog from './ShareDialog';
import MapsDialog from './MapsDialog';

interface ToolbarProps {
  onAddEntity: () => void;
  isConnecting: boolean;
  onToggleConnect: () => void;
  session: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function Toolbar({
  onAddEntity,
  isConnecting,
  onToggleConnect,
  session,
  onSignIn,
  onSignOut,
}: ToolbarProps) {
  const { currentMap, saveCurrentMap } = useMapStore();
  const [showShare, setShowShare] = useState(false);
  const [showMaps, setShowMaps] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveCurrentMap();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          background: 'rgba(15,23,42,0.96)',
          borderBottom: '1px solid rgba(59,130,246,0.2)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          zIndex: 500,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={16} style={{ color: 'white' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>StockMapper</div>
            <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1 }}>Scenario Planner</div>
          </div>
        </div>

        {/* Map name */}
        <div
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: '#93c5fd',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 6,
            transition: 'background 0.15s',
          }}
          onClick={() => setShowMaps(true)}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          title="Click to manage maps"
        >
          {currentMap.name}
          <ChevronDown size={12} style={{ marginLeft: 4, color: '#64748b', display: 'inline' }} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginRight: 8 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{currentMap.entities.length}</span> entities
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>{currentMap.relationships.length}</span> connections
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn-primary"
            onClick={onAddEntity}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
          >
            <Plus size={14} />
            <span style={{ fontSize: 13 }}>Add Entity</span>
          </button>

          <button
            onClick={onToggleConnect}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: `1px solid ${isConnecting ? '#06b6d4' : 'rgba(59,130,246,0.3)'}`,
              background: isConnecting ? 'rgba(6,182,212,0.15)' : 'transparent',
              color: isConnecting ? '#06b6d4' : '#93c5fd',
              cursor: 'pointer',
              fontSize: 13,
              transition: 'all 0.15s ease',
            }}
          >
            {isConnecting ? <X size={14} /> : <Link2 size={14} />}
            <span>{isConnecting ? 'Cancel' : 'Connect'}</span>
          </button>

          <button
            className="btn-ghost"
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}
            title="Save"
          >
            <Save size={14} />
            <span style={{ fontSize: 13 }}>{saved ? 'Saved!' : 'Save'}</span>
          </button>

          <button
            className="btn-ghost"
            onClick={() => setShowMaps(true)}
            style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Maps"
          >
            <Map size={14} />
            <span style={{ fontSize: 13 }}>Maps</span>
          </button>

          <button
            className="btn-ghost"
            onClick={() => setShowShare(true)}
            style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Share"
          >
            <Share2 size={14} />
            <span style={{ fontSize: 13 }}>Share</span>
          </button>

          {/* Auth */}
          <div style={{ width: 1, background: 'rgba(59,130,246,0.2)', margin: '0 4px' }} />

          {session?.user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.4)' }}
                />
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={14} style={{ color: '#3b82f6' }} />
                </div>
              )}
              <span style={{ fontSize: 12, color: '#94a3b8', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.user.name}
              </span>
              <button
                onClick={onSignOut}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              className="btn-ghost"
              onClick={onSignIn}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}
            >
              <LogIn size={14} />
              <span style={{ fontSize: 13 }}>Sign In</span>
            </button>
          )}
        </div>
      </div>

      <ShareDialog isOpen={showShare} onClose={() => setShowShare(false)} />
      <MapsDialog isOpen={showMaps} onClose={() => setShowMaps(false)} />
    </>
  );
}
