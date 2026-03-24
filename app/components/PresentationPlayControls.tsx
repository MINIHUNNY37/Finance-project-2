'use client';

import React from 'react';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, X, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  isAutoPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRestart: () => void;
  onToggleAutoPlay: () => void;
  onExit: () => void;
}

export default function PresentationPlayControls({
  currentStep, totalSteps, isPlaying, isAutoPlay,
  onPlay, onPause, onNext, onPrev, onRestart, onToggleAutoPlay, onExit,
}: Props) {
  const btnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#94a3b8', padding: '8px', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  };

  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'rgba(10,17,34,0.92)', border: '1px solid rgba(59,130,246,0.25)',
      borderRadius: 12, padding: '4px 12px', zIndex: 100,
      backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <button onClick={onPrev} style={btnStyle} title="Previous step"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
        <SkipBack size={16} />
      </button>

      {isPlaying ? (
        <button onClick={onPause} style={{ ...btnStyle, color: '#3b82f6' }} title="Pause">
          <Pause size={18} />
        </button>
      ) : (
        <button onClick={onPlay} style={{ ...btnStyle, color: '#3b82f6' }} title="Play">
          <Play size={18} />
        </button>
      )}

      <button onClick={onNext} style={btnStyle} title="Next step"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
        <SkipForward size={16} />
      </button>

      <div style={{
        fontSize: 11, color: '#64748b', fontWeight: 600,
        padding: '0 8px', borderLeft: '1px solid rgba(59,130,246,0.15)',
        borderRight: '1px solid rgba(59,130,246,0.15)',
        margin: '0 4px', minWidth: 48, textAlign: 'center',
      }}>
        {currentStep + 1} / {totalSteps}
      </div>

      <button onClick={onRestart} style={btnStyle} title="Restart"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f59e0b'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
        <RotateCcw size={14} />
      </button>

      <button onClick={onToggleAutoPlay} style={btnStyle}
        title={isAutoPlay ? 'Switch to manual' : 'Switch to auto-play'}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = isAutoPlay ? '#10b981' : '#94a3b8'; }}>
        {isAutoPlay ? <ToggleRight size={18} style={{ color: '#10b981' }} /> : <ToggleLeft size={18} />}
      </button>

      <button onClick={onExit} style={{ ...btnStyle, marginLeft: 4 }} title="Exit presentation"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
        <X size={16} />
      </button>
    </div>
  );
}
