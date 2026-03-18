'use client';

import React, { useRef, useCallback } from 'react';
import type { GeoEvent } from '../types';
import { GEO_EVENT_TYPES } from '../types';
import { useMapStore } from '../store/mapStore';

interface GeoEventNodeProps {
  event: GeoEvent;
  onEdit: (event: GeoEvent) => void;
  mapWidth: number;
  mapHeight: number;
  zoom: number;
}

const PULSE_KEYFRAMES = `
@keyframes geo-pulse-1 {
  0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7; }
  100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; }
}
@keyframes geo-pulse-2 {
  0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.5; }
  100% { transform: translate(-50%,-50%) scale(2.0); opacity: 0; }
}
@keyframes geo-pulse-3 {
  0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.3; }
  100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
}
@keyframes geo-diamond-glow {
  0%, 100% { box-shadow: 0 0 8px 2px var(--geo-color), 0 0 0 1px var(--geo-color-dim); }
  50%       { box-shadow: 0 0 18px 5px var(--geo-color), 0 0 0 1px var(--geo-color-dim); }
}
@keyframes geo-float {
  0%, 100% { transform: translate(-50%, -50%) translateY(0px) rotate(45deg); }
  50%       { transform: translate(-50%, -50%) translateY(-3px) rotate(45deg); }
}
`;

export default function GeoEventNode({
  event, onEdit, mapWidth, mapHeight, zoom,
}: GeoEventNodeProps) {
  const { moveGeoEvent, deleteGeoEvent } = useMapStore();
  const isDragging = useRef(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; evX: number; evY: number } | null>(null);

  const meta = GEO_EVENT_TYPES.find((t) => t.value === event.type) ?? GEO_EVENT_TYPES[0];
  const color = meta.color;
  const scale = 1 / zoom;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = false;
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
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging.current = true;
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
        if (!isDragging.current) onEdit(event);
        dragStart.current = null;
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [event, mapWidth, mapHeight, zoom, moveGeoEvent, onEdit]
  );

  const formattedDate = (() => {
    const start = event.startDate ? new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    const end = event.endDate ? new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    if (start && end) return `${start} – ${end}`;
    return start;
  })();

  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); deleteGeoEvent(event.id); }}
        style={{
          position: 'absolute',
          left: event.position.x,
          top: event.position.y,
          transform: 'translate(-50%, -50%)',
          cursor: 'grab',
          userSelect: 'none',
          // Fixed visual size regardless of zoom
          width: 0, height: 0,
        }}
      >
        {/* Scaling wrapper — undoes canvas zoom for constant screen size */}
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>

          {/* Pulse rings — 3 concentric expanding circles */}
          {[1.8, 1.3, 1.0].map((delay, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: 56, height: 56,
                borderRadius: '50%',
                border: `2px solid ${color}`,
                animation: `geo-pulse-${i + 1} 2.4s ${delay}s ease-out infinite`,
                pointerEvents: 'none',
              }}
            />
          ))}

          {/* Diamond body */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: 40, height: 40,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            background: `linear-gradient(135deg, ${color}30, ${color}18)`,
            border: `2px solid ${color}`,
            borderRadius: 6,
            animation: 'geo-diamond-glow 2.4s ease-in-out infinite',
            // CSS variable for keyframe shadow
            ['--geo-color' as string]: color,
            ['--geo-color-dim' as string]: `${color}66`,
          }}>
            {/* Emoji — counter-rotate so it stays upright */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-45deg)',
              fontSize: 17, lineHeight: 1,
            }}>
              {meta.emoji}
            </div>
          </div>

          {/* Label below */}
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
                fontSize: 9.5, fontWeight: 500,
                color: color,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                background: 'rgba(8,15,30,0.6)',
                padding: '1px 5px', borderRadius: 4,
                display: 'inline-block',
              }}>
                {formattedDate}
              </div>
            )}
          </div>

          {/* Type badge top-right */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% - 36px)',
            left: 'calc(50% + 14px)',
            fontSize: 9, fontWeight: 600,
            color: color,
            background: 'rgba(8,15,30,0.75)',
            border: `1px solid ${color}55`,
            borderRadius: 4, padding: '1px 5px',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            {meta.label.split(' ')[0]}
          </div>
        </div>
      </div>
    </>
  );
}
