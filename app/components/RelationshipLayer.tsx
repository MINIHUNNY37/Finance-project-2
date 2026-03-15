'use client';

import React, { useState } from 'react';
import { Trash2, Edit2 } from 'lucide-react';
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

  const getCenter = (entity: Entity) => ({
    x: entity.position.x,
    y: entity.position.y,
  });

  const getMidPoint = (x1: number, y1: number, x2: number, y2: number) => ({
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
  });

  const getControlPoint = (x1: number, y1: number, x2: number, y2: number) => {
    const mid = getMidPoint(x1, y1, x2, y2);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const offset = Math.min(60, len * 0.3);
    // Perpendicular offset for curved arrow
    return {
      x: mid.x - (dy / len) * offset,
      y: mid.y + (dx / len) * offset,
    };
  };

  const connectingEntity = connectingFromId ? entityMap.get(connectingFromId) : null;

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      width={width}
      height={height}
    >
      <defs>
        {relationships.map((rel) => (
          <marker
            key={`arrow-${rel.id}`}
            id={`arrow-${rel.id}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={rel.color} opacity={0.9} />
          </marker>
        ))}
        <marker id="arrow-preview" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#06b6d4" opacity={0.7} />
        </marker>
      </defs>

      {/* Existing relationships */}
      {relationships.map((rel) => {
        const from = entityMap.get(rel.fromEntityId);
        const to = entityMap.get(rel.toEntityId);
        if (!from || !to) return null;

        const { x: x1, y: y1 } = getCenter(from);
        const { x: x2, y: y2 } = getCenter(to);
        const cp = getControlPoint(x1, y1, x2, y2);
        const mid = getMidPoint(x1, y1, x2, y2);
        const isSelected = selectedRelationshipId === rel.id;
        const isHovered = hoveredRelId === rel.id;
        const pathD = `M ${x1} ${y1} Q ${cp.x} ${cp.y} ${x2} ${y2}`;

        return (
          <g key={rel.id}>
            {/* Wider invisible hit area */}
            <path
              d={pathD}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredRelId(rel.id)}
              onMouseLeave={() => setHoveredRelId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRelationship(rel.id);
              }}
            />

            {/* Visual line */}
            <path
              d={pathD}
              stroke={rel.color}
              strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
              fill="none"
              strokeDasharray={isSelected ? '6,3' : 'none'}
              markerEnd={`url(#arrow-${rel.id})`}
              opacity={isSelected ? 1 : 0.75}
              style={{ pointerEvents: 'none' }}
            />

            {/* Label at midpoint */}
            {(rel.label || isSelected) && (
              <g
                style={{ pointerEvents: isSelected ? 'all' : 'none' }}
                transform={`translate(${mid.x}, ${mid.y})`}
              >
                {rel.label && (
                  <>
                    <rect
                      x={-rel.label.length * 3.5 - 8}
                      y={-10}
                      width={rel.label.length * 7 + 16}
                      height={20}
                      rx={4}
                      fill="rgba(26,39,68,0.92)"
                      stroke={rel.color}
                      strokeWidth={0.5}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={rel.color}
                      fontSize={10}
                      fontWeight={500}
                    >
                      {rel.label}
                    </text>
                  </>
                )}

                {/* Action buttons when selected */}
                {isSelected && (
                  <g transform="translate(0, -28)" style={{ pointerEvents: 'all' }}>
                    <rect x={-30} y={-10} width={60} height={20} rx={4}
                      fill="rgba(26,39,68,0.95)"
                      stroke="rgba(59,130,246,0.4)"
                      strokeWidth={0.5}
                    />
                    <g
                      transform="translate(-16, 0)"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onEditRelationship(rel)}
                    >
                      <Edit2 size={11} color="#3b82f6" />
                    </g>
                    <g
                      transform="translate(8, 0)"
                      style={{ cursor: 'pointer' }}
                      onClick={() => deleteRelationship(rel.id)}
                    >
                      <Trash2 size={11} color="#ef4444" />
                    </g>
                  </g>
                )}
              </g>
            )}
          </g>
        );
      })}

      {/* Preview line while connecting */}
      {connectingEntity && (
        <line
          x1={connectingEntity.position.x}
          y1={connectingEntity.position.y}
          x2={mousePos.x}
          y2={mousePos.y}
          stroke="#06b6d4"
          strokeWidth={2}
          strokeDasharray="6,4"
          markerEnd="url(#arrow-preview)"
          opacity={0.7}
        />
      )}
    </svg>
  );
}
