'use client';

import React, { useState } from 'react';
import { Trash2, Edit2, MessageSquare } from 'lucide-react';
import type { Entity, Relationship } from '../types';
import { useMapStore } from '../store/mapStore';

interface RelationshipLayerProps {
  entities: Entity[];
  relationships: Relationship[];
  width: number;
  height: number;
  connectingFromId: string | null;
  mousePos: { x: number; y: number };
  onEditRelationship: (rel: Relationship) => void;
  zoom: number;
  arrowSizeMult: number;
  drawingFromId?: string | null;
  drawPath?: { x: number; y: number }[];
  /** Horizontal offset for world-wrap ghost copies. Default 0. */
  offsetX?: number;
}

/** Convert an array of points into a smooth SVG path using midpoint quadratic beziers */
function pointsToPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// Quadratic bezier point at t=0.5
function bezierMid(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  return {
    x: 0.25 * x1 + 0.5 * cx + 0.25 * x2,
    y: 0.25 * y1 + 0.5 * cy + 0.25 * y2,
  };
}

function getControlPoint(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = Math.min(70, len * 0.3);
  return { x: midX - (dy / len) * offset, y: midY + (dx / len) * offset };
}

export default function RelationshipLayer({
  entities,
  relationships,
  width,
  height,
  connectingFromId,
  mousePos,
  onEditRelationship,
  zoom,
  arrowSizeMult,
  drawingFromId,
  drawPath = [],
  offsetX = 0,
}: RelationshipLayerProps) {
  const { deleteRelationship, setSelectedRelationship, selectedRelationshipId } = useMapStore();
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);

  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const connectingEntity = connectingFromId ? entityMap.get(connectingFromId) : null;

  // Fixed-size arrows: fully counter-scale with zoom so arrows/labels always
  // appear the same size on screen regardless of zoom level (mirrors entity fixed-size mode).
  const arrowBaseStroke = 3.5 * arrowSizeMult;
  const strokeNormal = arrowBaseStroke / zoom;
  const strokeSelected = (arrowBaseStroke * 1.4) / zoom;
  const strokeTrack = (arrowBaseStroke * 1.15) / zoom;
  const labelFontSize = (11 * arrowSizeMult) / zoom;
  // zf used by SVG marker path scaling — equals zoom for fixed-size mode
  const zf = zoom;

  // HTML elements (note boxes, action toolbar) — counter-scale fully with zoom.
  const htmlScale = 1 / zoom;

  // Ghost copies (offsetX !== 0) render arrows only, no interactive HTML overlays
  const isGhost = offsetX !== 0;

  return (
    <>
      {/* SVG layer for arrows */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
        width={width}
        height={height}
      >
        {/* Translate all content by offsetX for world-wrap ghost copies */}
        <g transform={offsetX !== 0 ? `translate(${offsetX}, 0)` : undefined}>
        <defs>
          {/* Animated flow */}
          <style>{`
            @keyframes flowDash {
              from { stroke-dashoffset: 0; }
              to { stroke-dashoffset: -16; }
            }
            .arrow-animated {
              animation: flowDash 0.6s linear infinite;
            }
          `}</style>

          {relationships.map((rel) => (
            <marker
              key={`arrow-${rel.id}`}
              id={`arrow-${rel.id}`}
              markerWidth={9 * arrowSizeMult}
              markerHeight={9 * arrowSizeMult}
              refX={7 * arrowSizeMult}
              refY={3.5 * arrowSizeMult}
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d={`M0,0 L0,${7 * arrowSizeMult / zf} L${9 * arrowSizeMult / zf},${3.5 * arrowSizeMult / zf} z`}
                transform={`scale(${zf})`}
                fill={rel.color}
                opacity={0.95}
              />
            </marker>
          ))}
          <marker
            id="arrow-preview"
            markerWidth={9 * arrowSizeMult}
            markerHeight={9 * arrowSizeMult}
            refX={7 * arrowSizeMult}
            refY={3.5 * arrowSizeMult}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d={`M0,0 L0,${7 * arrowSizeMult / zf} L${9 * arrowSizeMult / zf},${3.5 * arrowSizeMult / zf} z`}
              transform={`scale(${zf})`}
              fill="#06b6d4"
              opacity={0.7}
            />
          </marker>
          <marker
            id="arrow-draw"
            markerWidth={9 * arrowSizeMult}
            markerHeight={9 * arrowSizeMult}
            refX={7 * arrowSizeMult}
            refY={3.5 * arrowSizeMult}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d={`M0,0 L0,${7 * arrowSizeMult / zf} L${9 * arrowSizeMult / zf},${3.5 * arrowSizeMult / zf} z`}
              transform={`scale(${zf})`}
              fill="#a78bfa"
              opacity={0.85}
            />
          </marker>
        </defs>

        {relationships.map((rel) => {
          const from = entityMap.get(rel.fromEntityId);
          const to = entityMap.get(rel.toEntityId);
          if (!from || !to) return null;

          const x1 = from.position.x;
          const y1 = from.position.y;
          const x2 = to.position.x;
          const y2 = to.position.y;

          // Use freehand drawn path if available, otherwise bezier
          const hasDrawn = rel.drawnPath && rel.drawnPath.length > 1;
          const pathD = hasDrawn
            ? pointsToPath(rel.drawnPath!)
            : (() => {
                const cp = getControlPoint(x1, y1, x2, y2);
                return `M ${x1} ${y1} Q ${cp.x} ${cp.y} ${x2} ${y2}`;
              })();
          const mid = hasDrawn
            ? rel.drawnPath![Math.floor(rel.drawnPath!.length / 2)]
            : (() => {
                const cp = getControlPoint(x1, y1, x2, y2);
                return bezierMid(x1, y1, cp.x, cp.y, x2, y2);
              })();

          const isSelected = selectedRelationshipId === rel.id;
          const isHovered = hoveredRelId === rel.id;
          const isAnimated = rel.arrowStyle === 'animated';
          const sw = isSelected || isHovered ? strokeSelected : strokeNormal;

          return (
            <g key={rel.id}>
              {/* Wide invisible hit area (counter-scaled so it stays usable at any zoom) */}
              <path
                d={pathD}
                stroke="transparent"
                strokeWidth={22 / zf}
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredRelId(rel.id)}
                onMouseLeave={() => setHoveredRelId(null)}
                onClick={(e) => { e.stopPropagation(); setSelectedRelationship(rel.id); }}
              />

              {/* Animated background track */}
              {isAnimated && (
                <path
                  d={pathD}
                  stroke={rel.color}
                  strokeWidth={strokeTrack}
                  fill="none"
                  strokeOpacity={0.18}
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Main arrow path */}
              <path
                d={pathD}
                stroke={rel.color}
                strokeWidth={sw}
                fill="none"
                strokeDasharray={isAnimated ? `${8 / zf} ${8 / zf}` : isSelected ? `${7 / zf} ${4 / zf}` : 'none'}
                className={isAnimated ? 'arrow-animated' : undefined}
                markerEnd={`url(#arrow-${rel.id})`}
                opacity={isSelected ? 1 : 0.85}
                style={{ pointerEvents: 'none' }}
              />

              {/* Label pill at bezier midpoint */}
              {rel.label && (
                <g transform={`translate(${mid.x}, ${mid.y})`} style={{ pointerEvents: 'none' }}>
                  <rect
                    x={-(rel.label.length * 3.8 + 10) / zf}
                    y={-11 / zf}
                    width={(rel.label.length * 7.6 + 20) / zf}
                    height={22 / zf}
                    rx={6 / zf}
                    fill="rgba(15,23,42,0.92)"
                    stroke={rel.color}
                    strokeWidth={0.8 / zf}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={rel.color}
                    fontSize={labelFontSize}
                    fontWeight={600}
                  >
                    {rel.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Preview line while connecting (click-mode) — center copy only */}
        {!isGhost && connectingEntity && (
          <line
            x1={connectingEntity.position.x}
            y1={connectingEntity.position.y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="#06b6d4"
            strokeWidth={2 / zf}
            strokeDasharray={`${7 / zf} ${5 / zf}`}
            markerEnd="url(#arrow-preview)"
            opacity={0.75}
          />
        )}

        {/* Freehand path preview while drawing — center copy only */}
        {!isGhost && drawingFromId && drawPath.length > 1 && (() => {
          const allPts = [...drawPath, mousePos];
          return (
            <path
              d={pointsToPath(allPts)}
              stroke="#a78bfa"
              strokeWidth={2.5 / zf}
              fill="none"
              markerEnd="url(#arrow-draw)"
              opacity={0.85}
            />
          );
        })()}
        </g>
      </svg>

      {/* HTML overlay: action toolbar for selected relationship — center copy only */}
      {!isGhost && relationships.map((rel) => {
        const isSelected = selectedRelationshipId === rel.id;
        if (!isSelected) return null;
        const from = entityMap.get(rel.fromEntityId);
        const to = entityMap.get(rel.toEntityId);
        if (!from || !to) return null;

        const x1 = from.position.x, y1 = from.position.y;
        const x2 = to.position.x, y2 = to.position.y;
        const cp = getControlPoint(x1, y1, x2, y2);
        const mid = bezierMid(x1, y1, cp.x, cp.y, x2, y2);

        return (
          <div
            key={`toolbar-${rel.id}`}
            style={{
              position: 'absolute',
              left: mid.x,
              top: mid.y - (rel.label ? 50 : 42),
              transform: `translateX(-50%) scale(${htmlScale})`,
              transformOrigin: 'center bottom',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'rgba(15,23,42,0.97)',
              border: '1px solid rgba(59,130,246,0.4)',
              borderRadius: 10,
              padding: '5px 8px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              pointerEvents: 'all',
              zIndex: 200,
            }}
          >
            <RelActionBtn
              icon={<Edit2 size={13} />}
              title="Edit connection"
              onClick={(e) => { e.stopPropagation(); onEditRelationship(rel); }}
              color="#3b82f6"
            />
            <div style={{ color: rel.description ? '#06b6d4' : '#475569', display: 'flex', alignItems: 'center', padding: '3px 5px' }}>
              <MessageSquare size={13} />
            </div>
            <RelActionBtn
              icon={<Trash2 size={13} />}
              title="Delete connection"
              onClick={(e) => { e.stopPropagation(); deleteRelationship(rel.id); }}
              color="#ef4444"
            />
          </div>
        );
      })}

      {/* HTML note boxes for relationship descriptions — center copy only */}
      {!isGhost && relationships.map((rel) => {
        if (!rel.description) return null;
        const from = entityMap.get(rel.fromEntityId);
        const to = entityMap.get(rel.toEntityId);
        if (!from || !to) return null;

        const x1 = from.position.x;
        const y1 = from.position.y;
        const x2 = to.position.x;
        const y2 = to.position.y;
        const cp = getControlPoint(x1, y1, x2, y2);
        const mid = bezierMid(x1, y1, cp.x, cp.y, x2, y2);
        const isSelected = selectedRelationshipId === rel.id;

        const noteX = mid.x;
        const noteY = mid.y + (rel.label ? 20 : 10);

        return (
          <div
            key={`note-${rel.id}`}
            style={{
              position: 'absolute',
              left: noteX,
              top: noteY,
              transform: `translate(-50%, 0) scale(${htmlScale})`,
              transformOrigin: 'top center',
              pointerEvents: 'all',
              cursor: 'pointer',
              zIndex: isSelected ? 150 : 80,
            }}
            onClick={(e) => { e.stopPropagation(); setSelectedRelationship(rel.id); }}
          >
            <div style={{
              background: isSelected ? 'rgba(6,182,212,0.12)' : 'rgba(15,23,42,0.88)',
              border: `1px solid ${isSelected ? rel.color : 'rgba(59,130,246,0.25)'}`,
              borderRadius: 8,
              padding: '5px 10px',
              maxWidth: 180,
              minWidth: 80,
              fontSize: 11,
              color: 'rgba(148,163,184,0.95)',
              lineHeight: 1.4,
              boxShadow: isSelected ? `0 0 10px ${rel.color}44` : '0 2px 8px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(6px)',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: `5px solid ${isSelected ? rel.color : 'rgba(59,130,246,0.25)'}`,
              }} />
              <span style={{ color: rel.color, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>
                Note
              </span>
              {rel.description}
            </div>
          </div>
        );
      })}
    </>
  );
}

function RelActionBtn({ icon, title, onClick, color }: {
  icon: React.ReactNode; title: string;
  onClick: (e: React.MouseEvent) => void; color: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none', border: 'none', color, cursor: 'pointer',
        padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = `${color}25`)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'none')}
    >
      {icon}
    </button>
  );
}
