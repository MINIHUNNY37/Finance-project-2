'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Clock, Trash2 } from 'lucide-react';
import { useMapStore } from '../store/mapStore';

const ALL_ZONES: { label: string; tz: string }[] = [
  { label: 'New York', tz: 'America/New_York' },
  { label: 'Toronto', tz: 'America/Toronto' },
  { label: 'Chicago', tz: 'America/Chicago' },
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'São Paulo', tz: 'America/Sao_Paulo' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'Paris', tz: 'Europe/Paris' },
  { label: 'Frankfurt', tz: 'Europe/Berlin' },
  { label: 'Zurich', tz: 'Europe/Zurich' },
  { label: 'Dubai', tz: 'Asia/Dubai' },
  { label: 'Mumbai', tz: 'Asia/Kolkata' },
  { label: 'Singapore', tz: 'Asia/Singapore' },
  { label: 'Hong Kong', tz: 'Asia/Hong_Kong' },
  { label: 'Shanghai', tz: 'Asia/Shanghai' },
  { label: 'Seoul', tz: 'Asia/Seoul' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
  { label: 'Sydney', tz: 'Australia/Sydney' },
];

function formatTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDate(date: Date, tz: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getLocalHour(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  return parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
}

function isMarketOpen(tz: string, hour: number): boolean {
  // Simple business hours check (9–17 local time)
  return hour >= 9 && hour < 17;
}

interface Props {
  onClose: () => void;
}

export default function WorldClockPanel({ onClose }: Props) {
  const { worldClockTimezones, setWorldClockTimezones } = useMapStore();
  const [now, setNow] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const addZone = (tz: string) => {
    if (!worldClockTimezones.includes(tz)) {
      setWorldClockTimezones([...worldClockTimezones, tz]);
    }
    setShowAdd(false);
  };

  const removeZone = (tz: string) => {
    setWorldClockTimezones(worldClockTimezones.filter((z) => z !== tz));
  };

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div
      className="fade-in"
      style={{
        position: 'fixed',
        top: 64,
        right: 12,
        width: 300,
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        background: 'rgba(10,17,34,0.97)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        zIndex: 450,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(59,130,246,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Clock size={14} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>World Time</span>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
          <X size={15} />
        </button>
      </div>

      {/* Local time hero */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(59,130,246,0.08)' }}>
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Local — {localTz.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
          {formatTime(now, localTz)}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {formatDate(now, localTz)}
        </div>
      </div>

      {/* World clocks */}
      <div style={{ padding: '8px 12px' }}>
        {worldClockTimezones.map((tz) => {
          const zoneMeta = ALL_ZONES.find((z) => z.tz === tz);
          const label = zoneMeta?.label ?? tz.split('/')[1]?.replace(/_/g, ' ') ?? tz;
          const hour = getLocalHour(now, tz);
          const open = isMarketOpen(tz, hour);
          return (
            <div key={tz} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 8, marginBottom: 2,
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(59,130,246,0.08)',
            }}>
              {/* Market-open indicator */}
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: open ? '#10b981' : '#334155',
                boxShadow: open ? '0 0 6px #10b981' : 'none',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </div>
              </div>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color: '#e2e8f0', flexShrink: 0 }}>
                {formatTime(now, tz)}
              </div>
              <div style={{ fontSize: 10, color: '#475569', flexShrink: 0, minWidth: 56 }}>
                {formatDate(now, tz).split(',')[0]}
              </div>
              <button onClick={() => removeZone(tz)}
                title="Remove"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: '2px', display: 'flex', flexShrink: 0 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#334155')}
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}

        {worldClockTimezones.length === 0 && !showAdd && (
          <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
            No world clocks added yet
          </div>
        )}
      </div>

      {/* Add zone */}
      <div style={{ padding: '4px 12px 14px' }}>
        {showAdd ? (
          <div className="fade-in" style={{
            background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10, padding: 10,
          }}>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Add city
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
              {ALL_ZONES.filter((z) => !worldClockTimezones.includes(z.tz)).map((z) => (
                <button key={z.tz} onClick={() => addZone(z.tz)} style={{
                  textAlign: 'left', padding: '6px 8px', borderRadius: 6,
                  background: 'transparent', border: 'none', color: '#94a3b8',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.1s',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                >
                  {z.label}
                </button>
              ))}
              {ALL_ZONES.filter((z) => !worldClockTimezones.includes(z.tz)).length === 0 && (
                <div style={{ color: '#475569', fontSize: 12, padding: '8px 4px' }}>All cities added</div>
              )}
            </div>
            <button onClick={() => setShowAdd(false)} style={{
              marginTop: 8, width: '100%', padding: '5px 0', borderRadius: 7,
              background: 'transparent', border: '1px solid rgba(59,130,246,0.15)',
              color: '#475569', fontSize: 11, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} style={{
            width: '100%', padding: '6px 0', borderRadius: 8,
            background: 'transparent', border: '1px dashed rgba(59,130,246,0.25)',
            color: '#475569', fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.5)'; (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.25)'; (e.currentTarget as HTMLElement).style.color = '#475569'; }}
          >
            <Plus size={12} /> Add city
          </button>
        )}
      </div>
    </div>
  );
}
