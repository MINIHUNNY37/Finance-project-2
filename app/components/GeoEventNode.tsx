'use client';

import React, { useRef, useCallback, useState } from 'react';
import type { GeoEvent } from '../types';
import { GEO_EVENT_TYPES } from '../types';
import { useMapStore } from '../store/mapStore';
import { Pencil, Pin, PinOff } from 'lucide-react';

interface GeoEventNodeProps {
  event: GeoEvent;
  onEdit: (event: GeoEvent) => void;
  mapWidth: number;
  mapHeight: number;
  zoom: number;
  selected: boolean;
  onSelect: (id: string | null) => void;
}

const BASE = 50; // hit-area half-size in unscaled px

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
  const DRAG_PX = 6; // screen-pixel threshold, zoom-independent

  const meta = GEO_EVENT_TYPES.find((t) => t.value === event.type) ?? GEO_EVENT_TYPES[0];
  const color = meta.color;
  const userSize = event.size ?? 1;
  const isFixed = event.fixedSize === true; // default false = relative (scales with zoom)
  // Fixed: undo canvas zoom so node stays constant screen size
  // Relative: scale WITH canvas zoom (grows/shrinks as you zoom)
  const totalScale = isFixed ? (1 / zoom) * userSize : userSize;

  // ── Move drag ─────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = false;
      setGrabbing(true);
      dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, evX: event.position.x, evY: event.position.y };

      const onMove = (ev: MouseEvent) => {
        if (!dragStart.current) return;
        const screenDx = ev.clientX - dragStart.current.mouseX;
        const screenDy = ev.clientY - dragStart.current.mouseY;
        if (Math.abs(screenDx) > DRAG_PX || Math.abs(screenDy) > DRAG_PX) isDragging.current = true;
        if (isDragging.current) {
          const dx = screenDx / zoom;
          const dy = screenDy / zoom;
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
        if (!isDragging.current) onSelect(selected ? null : event.id);
        isDragging.current = false;
        dragStart.current = null;
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [event, mapWidth, mapHeight, zoom, moveGeoEvent, onSelect, selected]
  );

  // ── Resize handle drag ────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br') => {
      e.preventDefault();
      e.stopPropagation();
      const startSize = event.size ?? 1;
      const startX = e.clientX;
      const startY = e.clientY;
      // For fixed-size nodes the resize happens in screen space; for relative, in map space
      const spaceFactor = isFixed ? 1 : zoom;

      const onMove = (ev: MouseEvent) => {
        const ddx = ev.clientX - startX;
        const ddy = ev.clientY - startY;
        const mx = corner === 'tl' || corner === 'bl' ? -1 : 1;
        const my = corner === 'tl' || corner === 'tr' ? -1 : 1;
        const delta = (ddx * mx + ddy * my) / (80 * spaceFactor);
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
    [event, zoom, isFixed, updateGeoEvent]
  );

  const formattedDate = (() => {
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (event.startDate && event.endDate) return `${fmt(event.startDate)} – ${fmt(event.endDate)}`;
    return event.startDate ? fmt(event.startDate) : '';
  })();

  const handles: { key: 'tl' | 'tr' | 'bl' | 'br'; left: number; top: number }[] = [
    { key: 'tl', left: -BASE + 4, top: -BASE + 4 },
    { key: 'tr', left: BASE - 4,  top: -BASE + 4 },
    { key: 'bl', left: -BASE + 4, top: BASE - 4  },
    { key: 'br', left: BASE - 4,  top: BASE - 4  },
  ];

  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>

      {/* Outer: zero-size positioning anchor */}
      <div style={{
        position: 'absolute',
        left: event.position.x,
        top: event.position.y,
        width: 0, height: 0,
        pointerEvents: event.hidden ? 'none' : undefined,
        opacity: event.hidden ? 0 : 1,
        transition: 'opacity 0.15s',
      }}>
        {/* Inner: hit area, centered, scaled */}
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
            <div key={i} style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: 56, height: 56,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              animation: `geo-pulse-${i + 1} 2.6s ${delay}s ease-out infinite`,
              pointerEvents: 'none',
            }} />
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

          {/* Name + date */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% + 28px)',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', textShadow: `0 0 8px ${color}, 0 1px 3px rgba(0,0,0,0.8)`, marginBottom: 2 }}>
              {event.name}
            </div>
            {formattedDate && (
              <div style={{ fontSize: 9.5, fontWeight: 500, color, textShadow: '0 1px 3px rgba(0,0,0,0.8)', background: 'rgba(8,15,30,0.65)', padding: '1px 5px', borderRadius: 4, display: 'inline-block' }}>
                {formattedDate}
              </div>
            )}
          </div>

          {/* Type badge */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% - 38px)', left: 'calc(50% + 16px)',
            fontSize: 9, fontWeight: 600, color,
            background: 'rgba(8,15,30,0.8)', border: `1px solid ${color}55`,
            borderRadius: 4, padding: '1px 5px',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            {meta.label.split(' ')[0]}
          </div>

          {/* Fixed-size indicator (always visible, small pin icon top-left of diamond) */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% - 38px)', right: 'calc(50% + 14px)',
            fontSize: 9, color: isFixed ? color : '#64748b',
            pointerEvents: 'none', opacity: 0.7,
          }}>
            {isFixed ? '📌' : '↔'}
          </div>

          {/* ── Selected UI ── */}
          {selected && (
            <>
              {/* Toolbar row: [Pin toggle] [Pencil] */}
              <div style={{
                position: 'absolute',
                top: 'calc(50% - 72px)',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex', gap: 6,
                pointerEvents: 'all',
                zIndex: 2,
              }}>
                {/* Fixed / Relative size toggle */}
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); updateGeoEvent(event.id, { fixedSize: !isFixed }); }}
                  title={isFixed ? 'Switch to relative size (scales with zoom)' : 'Switch to fixed size (constant screen size)'}
                  style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: isFixed ? `${color}22` : 'rgba(15,23,42,0.95)',
                    border: `2px solid ${isFixed ? color : '#64748b'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: isFixed ? color : '#94a3b8',
                    boxShadow: isFixed ? `0 0 10px ${color}44` : 'none',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}30`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isFixed ? `${color}22` : 'rgba(15,23,42,0.95)'; }}
                >
                  {isFixed ? <Pin size={15} /> : <PinOff size={15} />}
                </div>

                {/* Pencil / Edit */}
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                  title="Edit event"
                  style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: 'rgba(15,23,42,0.95)',
                    border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color,
                    boxShadow: `0 0 12px ${color}66`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}30`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.95)'; }}
                >
                  <Pencil size={16} />
                </div>
              </div>

              {/* Corner resize handles */}
              {handles.map(({ key, left, top }) => (
                <div
                  key={key}
                  onMouseDown={(e) => handleResizeMouseDown(e, key)}
                  style={{
                    position: 'absolute',
                    left: BASE + left - 8,
                    top: BASE + top - 8,
                    width: 16, height: 16,
                    borderRadius: 3,
                    background: 'rgba(15,23,42,0.9)',
                    border: `2px solid ${color}`,
                    cursor: key === 'tl' || key === 'br' ? 'nwse-resize' : 'nesw-resize',
                    pointerEvents: 'all',
                    zIndex: 3,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
              ))}

              {/* Size + mode readout */}
              <div style={{
                position: 'absolute',
                bottom: 'calc(50% + 30px)',
                left: '50%', transform: 'translateX(-50%)',
                fontSize: 9, fontWeight: 700, color,
                background: 'rgba(8,15,30,0.9)',
                border: `1px solid ${color}44`,
                borderRadius: 4, padding: '2px 7px',
                pointerEvents: 'none', whiteSpace: 'nowrap',
              }}>
                {(event.size ?? 1).toFixed(1)}× {isFixed ? '📌' : '↔'}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
