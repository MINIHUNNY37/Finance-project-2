'use client';

import React, { useRef, useCallback, useState } from 'react';
import type { GeoEvent } from '../types';
import { GEO_EVENT_TYPES } from '../types';
import { useMapStore } from '../store/mapStore';
import { Pencil } from 'lucide-react';

interface GeoEventNodeProps {
  event: GeoEvent;
  onEdit: (event: GeoEvent) => void;
  mapWidth: number;
  mapHeight: number;
  zoom: number;
  selected: boolean;
  onSelect: (id: string | null) => void;
}

// Base hit-area radius (half-size) in unscaled pixels
const BASE = 50;

const PULSE_KEYFRAMES = `
@keyframes geo-pulse-1 {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.7; }
  100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
}
@keyframes geo-pulse-2 {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.5; }
  100% { transform: translate(-50%,-50%) scale(2.1); opacity: 0; }
}
@keyframes geo-pulse-3 {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.3; }
  100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
}
@keyframes geo-diamond-glow {
  0%, 100% { box-shadow: 0 0 8px 2px var(--geo-color), 0 0 0 1px var(--geo-color-dim); }
  50%       { box-shadow: 0 0 20px 6px var(--geo-color), 0 0 0 1px var(--geo-color-dim); }
}
`;

export default function GeoEventNode({
  event, onEdit, mapWidth, mapHeight, zoom, selected, onSelect,
}: GeoEventNodeProps) {
  const { moveGeoEvent, updateGeoEvent } = useMapStore();
  const isDragging = useRef(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; evX: number; evY: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const meta = GEO_EVENT_TYPES.find((t) => t.value === event.type) ?? GEO_EVENT_TYPES[0];
  const color = meta.color;
  const userSize = event.size ?? 1;
  const totalScale = (1 / zoom) * userSize;

  // ── Main drag (move) ──────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = false;
      setGrabbing(true);
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        evX: event.position.x,
        evY: event.position.y,
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragStart.current) return;
        const dx = (ev.clientX - dragStart.current.mouseX) / zoom;
        const dy = (ev.clientY - dragStart.current.mouseY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true;
        if (isDragging.current) {
          moveGeoEvent(event.id, {
            x: Math.max(40, Math.min(mapWidth - 40, dragStart.current.evX + dx)),
            y: Math.max(40, Math.min(mapHeight - 40, dragStart.current.evY + dy)),
          });
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setGrabbing(false);
        if (!isDragging.current) {
          // Click → select (not open dialog; dialog opened via pencil)
          onSelect(selected ? null : event.id);
        }
        isDragging.current = false;
        dragStart.current = null;
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [event, mapWidth, mapHeight, zoom, moveGeoEvent, onSelect, selected]
  );

  // ── Resize handle drag ────────────────────────────────────────────────────
  // Each corner handle: dragging away from center → bigger, toward center → smaller
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br') => {
      e.preventDefault();
      e.stopPropagation();

      const startSize = event.size ?? 1;
      const startX = e.clientX;
      const startY = e.clientY;

      const onMove = (ev: MouseEvent) => {
        // Diagonal distance change from start
        const ddx = ev.clientX - startX;
        const ddy = ev.clientY - startY;
        // Corner direction multipliers so "outward" always means bigger
        const mx = corner === 'tl' || corner === 'bl' ? -1 : 1;
        const my = corner === 'tl' || corner === 'tr' ? -1 : 1;
        const delta = (ddx * mx + ddy * my) / (80 * zoom);
        const newSize = Math.max(0.3, Math.min(4, startSize + delta));
        updateGeoEvent(event.id, { size: Math.round(newSize * 10) / 10 });
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [event, zoom, updateGeoEvent]
  );

  const formattedDate = (() => {
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (event.startDate && event.endDate) return `${fmt(event.startDate)} – ${fmt(event.endDate)}`;
    return event.startDate ? fmt(event.startDate) : '';
  })();

  // Resize handle positions relative to the BASE×2 box center
  const handles: { key: 'tl' | 'tr' | 'bl' | 'br'; left: number; top: number }[] = [
    { key: 'tl', left: -BASE + 4, top: -BASE + 4 },
    { key: 'tr', left: BASE - 4,  top: -BASE + 4 },
    { key: 'bl', left: -BASE + 4, top: BASE - 4  },
    { key: 'br', left: BASE - 4,  top: BASE - 4  },
  ];

  const nodeOpacity = event.hidden ? 0.3 : 1;

  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>

      {/* Outer: zero-size positioning anchor */}
      <div style={{
        position: 'absolute',
        left: event.position.x,
        top: event.position.y,
        width: 0, height: 0,
        pointerEvents: 'none',
        opacity: nodeOpacity,
        transition: 'opacity 0.2s',
      }}>
        {/* Inner: actual hit area, centered, scaled */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            left: -BASE,
            top: -BASE,
            width: BASE * 2,
            height: BASE * 2,
            transform: `scale(${totalScale})`,
            transformOrigin: 'center center',
            cursor: grabbing ? 'grabbing' : 'grab',
            userSelect: 'none',
            pointerEvents: 'all',
          }}
        >
          {/* Pulse rings */}
          {[1.6, 1.0, 0.4].map((delay, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: 56, height: 56,
                borderRadius: '50%',
                border: `2px solid ${color}`,
                animation: `geo-pulse-${i + 1} 2.6s ${delay}s ease-out infinite`,
                pointerEvents: 'none',
              }}
            />
          ))}

          {/* Diamond body */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: 42, height: 42,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            background: `linear-gradient(135deg, ${color}35, ${color}18)`,
            border: `2px solid ${selected ? '#fff' : color}`,
            outline: selected ? `2px solid ${color}` : 'none',
            outlineOffset: 3,
            borderRadius: 7,
            animation: 'geo-diamond-glow 2.6s ease-in-out infinite',
            ['--geo-color' as string]: color,
            ['--geo-color-dim' as string]: `${color}66`,
            transition: 'border-color 0.15s',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-45deg)',
              fontSize: 18, lineHeight: 1,
            }}>
              {meta.emoji}
            </div>
          </div>

          {/* Name + date below */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% + 28px)',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#e2e8f0',
              textShadow: `0 0 8px ${color}, 0 1px 3px rgba(0,0,0,0.8)`,
              marginBottom: 2,
            }}>
              {event.name}
            </div>
            {formattedDate && (
              <div style={{
                fontSize: 9.5, fontWeight: 500, color,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                background: 'rgba(8,15,30,0.65)',
                padding: '1px 5px', borderRadius: 4, display: 'inline-block',
              }}>
                {formattedDate}
              </div>
            )}
          </div>

          {/* Type badge top-right */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% - 38px)',
            left: 'calc(50% + 16px)',
            fontSize: 9, fontWeight: 600, color,
            background: 'rgba(8,15,30,0.8)',
            border: `1px solid ${color}55`,
            borderRadius: 4, padding: '1px 5px',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            {meta.label.split(' ')[0]}
          </div>

          {/* ── Selected UI ── */}
          {selected && (
            <>
              {/* Pencil / Edit button — top center */}
              <div
                onMouseDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                title="Edit event"
                style={{
                  position: 'absolute',
                  top: 'calc(50% - 52px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 26, height: 26,
                  borderRadius: 7,
                  background: 'rgba(15,23,42,0.92)',
                  border: `1px solid ${color}88`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  color,
                  pointerEvents: 'all',
                  zIndex: 2,
                  boxShadow: `0 0 8px ${color}44`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}22`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.92)'; }}
              >
                <Pencil size={13} />
              </div>

              {/* Corner resize handles */}
              {handles.map(({ key, left, top }) => (
                <div
                  key={key}
                  onMouseDown={(e) => handleResizeMouseDown(e, key)}
                  style={{
                    position: 'absolute',
                    left: BASE + left - 5,  // offset relative to inner div's top-left (which is at -BASE,-BASE)
                    top: BASE + top - 5,
                    width: 10, height: 10,
                    borderRadius: 2,
                    background: 'rgba(15,23,42,0.9)',
                    border: `2px solid ${color}`,
                    cursor: key === 'tl' || key === 'br' ? 'nwse-resize' : 'nesw-resize',
                    pointerEvents: 'all',
                    zIndex: 3,
                    boxShadow: `0 0 4px ${color}`,
                  }}
                />
              ))}

              {/* Size readout */}
              <div style={{
                position: 'absolute',
                bottom: 'calc(50% + 28px)',
                left: 'calc(50% + 20px)',
                fontSize: 9, fontWeight: 700, color,
                background: 'rgba(8,15,30,0.85)',
                border: `1px solid ${color}44`,
                borderRadius: 4, padding: '1px 5px',
                pointerEvents: 'none', whiteSpace: 'nowrap',
              }}>
                {(event.size ?? 1).toFixed(1)}×
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
