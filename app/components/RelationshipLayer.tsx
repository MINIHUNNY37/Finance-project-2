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
}: RelationshipLayerProps) {
  const { deleteRelationship, setSelectedRelationship, selectedRelationshipId } = useMapStore();
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);

  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const connectingEntity = connectingFromId ? entityMap.get(connectingFromId) : null;

  return (
    <>
      {/* SVG layer for arrows */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
        width={width}
        height={height}
      >
        <defs>
          {/* Animated flow gradient for supply-chain style */}
          <style>{`
            @keyframes flowDash {
              from { stroke-dashoffset: 24; }
              to { stroke-dashoffset: 0; }
            }
            .arrow-animated {
              animation: flowDash 0.8s linear infinite;
            }
          `}</style>

          {relationships.map((rel) => (
            <marker
              key={`arrow-${rel.id}`}
              id={`arrow-${rel.id}`}
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L0,7 L9,3.5 z" fill={rel.color} opacity={0.95} />
            </marker>
          ))}
          <marker id="arrow-preview" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L9,3.5 z" fill="#06b6d4" opacity={0.7} />
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
          const cp = getControlPoint(x1, y1, x2, y2);
          const pathD = `M ${x1} ${y1} Q ${cp.x} ${cp.y} ${x2} ${y2}`;
          const mid = bezierMid(x1, y1, cp.x, cp.y, x2, y2);

          const isSelected = selectedRelationshipId === rel.id;
          const isHovered = hoveredRelId === rel.id;
          const isAnimated = rel.arrowStyle === 'animated';

          return (
            <g key={rel.id}>
              {/* Wide invisible hit area */}
              <path
                d={pathD}
                stroke="transparent"
                strokeWidth={18}
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredRelId(rel.id)}
                onMouseLeave={() => setHoveredRelId(null)}
                onClick={(e) => { e.stopPropagation(); setSelectedRelationship(rel.id); }}
              />

              {/* Animated background track (for animated style) */}
              {isAnimated && (
                <path
                  d={pathD}
                  stroke={rel.color}
                  strokeWidth={isSelected || isHovered ? 3.5 : 2.5}
                  fill="none"
                  strokeOpacity={0.18}
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Main arrow path */}
              <path
                d={pathD}
                stroke={rel.color}
                strokeWidth={isSelected || isHovered ? 3 : 2}
                fill="none"
                strokeDasharray={isAnimated ? '8 8' : isSelected ? '7 4' : 'none'}
                className={isAnimated ? 'arrow-animated' : undefined}
                markerEnd={`url(#arrow-${rel.id})`}
                opacity={isSelected ? 1 : 0.8}
                style={{ pointerEvents: 'none' }}
              />

              {/* Label pill at bezier midpoint */}
              {rel.label && (
                <g transform={`translate(${mid.x}, ${mid.y})`} style={{ pointerEvents: 'none' }}>
                  <rect
                    x={-rel.label.length * 3.8 - 10}
                    y={-11}
                    width={rel.label.length * 7.6 + 20}
                    height={22}
                    rx={6}
                    fill="rgba(15,23,42,0.92)"
                    stroke={rel.color}
                    strokeWidth={0.8}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={rel.color}
                    fontSize={11}
                    fontWeight={600}
                  >
                    {rel.label}
                  </text>
                </g>
              )}

              {/* Action buttons when selected */}
              {isSelected && (
                <g transform={`translate(${mid.x}, ${mid.y - (rel.label ? 30 : 22)})`} style={{ pointerEvents: 'all' }}>
                  <rect x={-38} y={-12} width={76} height={24} rx={6}
                    fill="rgba(15,23,42,0.97)"
                    stroke="rgba(59,130,246,0.4)"
                    strokeWidth={0.8}
                  />
                  {/* Edit */}
                  <g transform="translate(-22, 0)" style={{ cursor: 'pointer' }}
                    onClick={() => onEditRelationship(rel)}>
                    <rect x={-9} y={-9} width={18} height={18} rx={3} fill="transparent" />
                    <Edit2 size={12} color="#3b82f6" />
                  </g>
                  {/* Note indicator */}
                  <g transform="translate(0, 0)" style={{ cursor: 'default' }}>
                    <MessageSquare size={12} color={rel.description ? '#06b6d4' : '#475569'} />
                  </g>
                  {/* Delete */}
                  <g transform="translate(22, 0)" style={{ cursor: 'pointer' }}
                    onClick={() => deleteRelationship(rel.id)}>
                    <rect x={-9} y={-9} width={18} height={18} rx={3} fill="transparent" />
                    <Trash2 size={12} color="#ef4444" />
                  </g>
                </g>
              )}
            </g>
          );
        })}

        {/* Preview line while dragging a connection */}
        {connectingEntity && (
          <line
            x1={connectingEntity.position.x}
            y1={connectingEntity.position.y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="#06b6d4"
            strokeWidth={2}
            strokeDasharray="7 5"
            markerEnd="url(#arrow-preview)"
            opacity={0.75}
          />
        )}
      </svg>

      {/* HTML note boxes for relationship descriptions */}
      {relationships.map((rel) => {
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

        // Offset note box slightly below the midpoint
        const noteX = mid.x + (rel.label ? 0 : 0);
        const noteY = mid.y + (rel.label ? 20 : 10);

        return (
          <div
            key={`note-${rel.id}`}
            style={{
              position: 'absolute',
              left: noteX,
              top: noteY,
              transform: 'translate(-50%, 0)',
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
              // Small "sticky note" triangle pointer at top
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
