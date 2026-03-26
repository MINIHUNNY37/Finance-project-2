'use client';

import React, { useState } from 'react';
import { Trash2, Edit2, MessageSquare } from 'lucide-react';
import type { Entity, Relationship, EmphasisEffect } from '../types';
import { useMapStore } from '../store/mapStore';

interface EmphasisState {
  activeEntityIds: string[];
  sourceEntityId?: string;
  destinationEntityId?: string;
  effect: EmphasisEffect;
}

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
  /** Presentation emphasis state */
  emphasisState?: EmphasisState | null;
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

function getEmphasisClass(effect: EmphasisEffect): string {
  switch (effect) {
    case 'pulse': return 'em-pulse';
    case 'cash-flow': return 'em-cash-flow';
    case 'competitor': return 'em-competitor';
    case 'risk': return 'em-risk';
    case 'supply-chain': return 'em-supply-chain';
    case 'ownership': return 'em-ownership';
    default: return '';
  }
}

type AnimFlavor = 'capital' | 'conflict' | 'synergy' | 'logistics' | 'default';

function getAnimFlavor(label: string): AnimFlavor {
  const l = label.toLowerCase();
  if (/capital|invest|cash|fund|money|flow|bank|credit|equity/.test(l)) return 'capital';
  if (/rival|compet|conflict|friction|tension|war|oppose|versus|vs/.test(l)) return 'conflict';
  if (/synergy|partner|collab|team|cowork|alliance|joint|cooperat|merge|integrat/.test(l)) return 'synergy';
  if (/logistic|supply|freight|ship|deliver|transport|cargo|truck|distribut/.test(l)) return 'logistics';
  return 'default';
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
  emphasisState,
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
            @keyframes emphasisPulse {
              0%, 100% { stroke-opacity: 0.4; filter: none; }
              50% { stroke-opacity: 1; filter: drop-shadow(0 0 6px var(--em-color, #3b82f6)); }
            }
            @keyframes emphasisCashFlow {
              from { stroke-dashoffset: 0; }
              to { stroke-dashoffset: -24; }
            }
            @keyframes emphasisRisk {
              0%, 100% { stroke-opacity: 0.5; }
              30% { stroke-opacity: 1; filter: drop-shadow(0 0 8px #ef4444); }
              60% { stroke-opacity: 0.3; }
            }
            .em-pulse { animation: emphasisPulse 1.8s ease-in-out infinite; }
            .em-cash-flow { animation: emphasisCashFlow 0.8s linear infinite; }
            .em-competitor { stroke: #ef4444 !important; stroke-opacity: 0.9; filter: drop-shadow(0 0 4px rgba(239,68,68,0.5)); }
            .em-risk { animation: emphasisRisk 1.2s ease-in-out infinite; }
            .em-supply-chain { animation: emphasisCashFlow 1.0s linear infinite; }
            .em-ownership { stroke-opacity: 1; filter: drop-shadow(0 0 6px var(--em-color, #8b5cf6)); }
            .em-dimmed { opacity: 0.15 !important; }
            @keyframes relDash { to { stroke-dashoffset: -90; } }
            .rel-dash-fwd { animation: relDash 1.5s linear infinite; }
            .rel-dash-rev { animation: relDash 1.5s linear infinite reverse; }
          `}</style>

          {/* === Animated connection symbols === */}
          {/* Green coin (capital flow) */}
          <g id="rel-coin">
            <circle cx="0" cy="0" r="6" fill="#10b981" stroke="#064e3b" strokeWidth="1.2" />
            <circle cx="0" cy="0" r="4" fill="none" stroke="#34d399" strokeWidth="0.5" />
            <text x="0" y="2.5" fontSize="7" textAnchor="middle" fill="#022c22" fontWeight="bold">$</text>
          </g>
          {/* Purple truck (logistics) */}
          <g id="rel-truck" stroke="#a855f7" fill="rgba(11,20,38,0.8)" strokeWidth="1.2">
            <rect x="-10" y="-5" width="13" height="9" rx="1.5" fill="#a855f7" fillOpacity="0.1" />
            <path d="M3 -5 L7 -5 L10 0 L10 4 L3 4 Z" fill="#a855f7" fillOpacity="0.2" />
            <line x1="3" y1="-5" x2="3" y2="4" />
            <circle cx="-4" cy="5" r="2" fill="rgba(11,20,38,0.8)" />
            <circle cx="6" cy="5" r="2" fill="rgba(11,20,38,0.8)" />
            <circle cx="-4" cy="5" r="0.8" fill="#a855f7" />
            <circle cx="6" cy="5" r="0.8" fill="#a855f7" />
          </g>
          {/* Purple plane (logistics — plane) — nose on RIGHT (+X) */}
          <g id="rel-plane" fill="#a855f7" stroke="none">
            {/* Fuselage — tapers to a point on the right (nose) */}
            <path d="M-10,1.2 L7,1.8 L11,0 L7,-1.8 L-10,-1.2 Z" />
            {/* Wings — root at center, sweep BACKWARD toward -X (correct aviation orientation) */}
            <path d="M1,-1.5 L-5,-11 L-8,-10 L-1,0 Z" fillOpacity="0.85" />
            <path d="M1,1.5 L-5,11 L-8,10 L-1,0 Z" fillOpacity="0.85" />
            {/* Tail fins — small, at rear (-X) */}
            <path d="M-8,-1.2 L-12,-5 L-10,-1.2 Z" fillOpacity="0.7" />
            <path d="M-8,1.2 L-12,5 L-10,1.2 Z" fillOpacity="0.7" />
            {/* Nose highlight */}
            <ellipse cx="10" cy="0" rx="1.5" ry="1" fill="#c084fc" />
          </g>
          {/* Purple ship (logistics — ship) — bow on RIGHT (+X) */}
          <g id="rel-ship" fill="#a855f7" stroke="none">
            {/* Hull — clearly boat-shaped, pointed bow on right */}
            <path d="M-13,5 L-13,1 L-10,-1 L8,-1 L13,2.5 L8,5 Z" />
            {/* Main cabin — wide base */}
            <rect x="-9" y="-5" width="15" height="6" rx="1.5" fillOpacity="0.85" />
            {/* Bridge — upper tier (stepped profile = ship, not tank) */}
            <rect x="-3" y="-9" width="8" height="4" rx="1" fillOpacity="0.75" />
            {/* Funnel — wide + short so it doesn't look like a gun barrel */}
            <rect x="-0.5" y="-12" width="5" height="3" rx="2" fill="#c084fc" fillOpacity="0.9" />
            {/* Bow highlight */}
            <ellipse cx="12" cy="2.5" rx="1.8" ry="1.2" fill="#c084fc" fillOpacity="0.8" />
          </g>
          {/* Gear (synergy) */}
          <g id="rel-gear" stroke="currentColor" fill="none">
            <circle r="7" strokeWidth="3" strokeDasharray="2.75 2.75" />
            <circle r="5.5" strokeWidth="1.5" fill="rgba(11,20,38,0.85)" />
            <circle r="1.5" strokeWidth="1" />
          </g>
          {/* Glow filters */}
          <filter id="rel-glow-lg" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="rel-glow-sm" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

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

          // Emphasis state
          const isEmphasized = emphasisState && (
            (emphasisState.sourceEntityId === rel.fromEntityId && emphasisState.destinationEntityId === rel.toEntityId) ||
            (emphasisState.activeEntityIds.includes(rel.fromEntityId) && emphasisState.activeEntityIds.includes(rel.toEntityId))
          );
          const isDimmed = emphasisState && !isEmphasized;
          const emClass = isEmphasized ? getEmphasisClass(emphasisState.effect) : '';

          return (
            <g key={rel.id} className={isDimmed ? 'em-dimmed' : undefined}>
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
                strokeWidth={isEmphasized ? sw * 1.5 : sw}
                fill="none"
                strokeDasharray={
                  isEmphasized && (emphasisState!.effect === 'cash-flow' || emphasisState!.effect === 'supply-chain')
                    ? `${12 / zf} ${6 / zf}`
                    : isAnimated ? `${8 / zf} ${8 / zf}` : isSelected ? `${7 / zf} ${4 / zf}` : 'none'
                }
                className={isEmphasized ? emClass : isAnimated ? 'arrow-animated' : undefined}
                markerEnd={`url(#arrow-${rel.id})`}
                opacity={isSelected ? 1 : 0.85}
                style={{ pointerEvents: 'none', ['--em-color' as string]: rel.color }}
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

              {/* === Rich animated overlays (animated style only) === */}
              {isAnimated && (() => {
                const flavor = rel.animFlavor ?? getAnimFlavor(rel.label);
                const pid = `path-rel-${rel.id}`;

                if (flavor === 'capital') {
                  // Green coins flowing along the path
                  return (
                    <g style={{ pointerEvents: 'none' }} filter="url(#rel-glow-sm)">
                      <path id={pid} d={pathD} fill="none" stroke="none" />
                      {[0, 1, 2].map((i) => (
                        <use key={i} href="#rel-coin">
                          <animateMotion dur="2.5s" begin={`${i * 0.83}s`} repeatCount="indefinite" rotate="auto">
                            <mpath href={`#${pid}`} />
                          </animateMotion>
                        </use>
                      ))}
                    </g>
                  );
                }

                if (flavor === 'conflict') {
                  // Electric signals flying at each other + spark burst at midpoint
                  const pidA = `${pid}-A`;
                  const pidB = `${pid}-B`;
                  // Reverse path for signal B
                  const x1 = from!.position.x, y1 = from!.position.y;
                  const x2 = to!.position.x, y2 = to!.position.y;
                  const cp = getControlPoint(x1, y1, x2, y2);
                  const pathDRev = `M ${x2} ${y2} Q ${cp.x} ${cp.y} ${x1} ${y1}`;
                  return (
                    <g style={{ pointerEvents: 'none' }} filter="url(#rel-glow-sm)">
                      <path id={pidA} d={pathD} fill="none" stroke="none" />
                      <path id={pidB} d={pathDRev} fill="none" stroke="none" />
                      {/* Signal from → to */}
                      <g>
                        <circle r={3 / zf} fill="#fff" />
                        <path d={`M${-6/zf},0 L0,${2.5/zf} L${3/zf},${-2.5/zf} L${6/zf},0`} fill="none" stroke="#fb7185" strokeWidth={1.2 / zf} />
                        <animateMotion dur="1.8s" repeatCount="indefinite" keyPoints="0;0.5;0.5" keyTimes="0;0.5;1" calcMode="linear" rotate="auto">
                          <mpath href={`#${pidA}`} />
                        </animateMotion>
                        <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.49;0.5;1" dur="1.8s" repeatCount="indefinite" />
                      </g>
                      {/* Signal to → from */}
                      <g>
                        <circle r={3 / zf} fill="#fff" />
                        <path d={`M${-6/zf},0 L0,${2.5/zf} L${3/zf},${-2.5/zf} L${6/zf},0`} fill="none" stroke="#fb7185" strokeWidth={1.2 / zf} />
                        <animateMotion dur="1.8s" repeatCount="indefinite" keyPoints="0;0.5;0.5" keyTimes="0;0.5;1" calcMode="linear" rotate="auto">
                          <mpath href={`#${pidB}`} />
                        </animateMotion>
                        <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.49;0.5;1" dur="1.8s" repeatCount="indefinite" />
                      </g>
                      {/* Spark burst at midpoint */}
                      <g transform={`translate(${mid.x}, ${mid.y})`} filter="url(#rel-glow-sm)">
                        {[
                          `M0,0 l${-10/zf},${-14/zf} l${6/zf},${-2/zf} l${-8/zf},${-10/zf}`,
                          `M0,0 l${12/zf},${-10/zf} l${-5/zf},${-5/zf} l${11/zf},${-11/zf}`,
                          `M0,0 l${-8/zf},${12/zf} l${10/zf},${3/zf} l${-6/zf},${13/zf}`,
                          `M0,0 l${12/zf},${8/zf} l${-3/zf},${6/zf} l${13/zf},${10/zf}`,
                        ].map((d, i) => (
                          <path key={i} d={d} fill="none" stroke={i % 2 === 0 ? '#fb7185' : '#f43f5e'} strokeWidth={2 / zf} strokeLinecap="round" strokeLinejoin="round">
                            <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.48;0.5;0.55;1" dur="1.8s" repeatCount="indefinite" />
                          </path>
                        ))}
                        <circle r={0} fill="#fff">
                          <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;0.48;0.5;0.55;1" dur="1.8s" repeatCount="indefinite" />
                          <animate attributeName="r" values={`0;0;${10/zf};0;0`} keyTimes="0;0.48;0.5;0.55;1" dur="1.8s" repeatCount="indefinite" />
                        </circle>
                      </g>
                    </g>
                  );
                }

                if (flavor === 'synergy') {
                  // Two interlocking gears at midpoint
                  const gearColor = rel.color || '#8b5cf6';
                  const gs = 1 / zf;
                  return (
                    <g transform={`translate(${mid.x}, ${mid.y})`} style={{ pointerEvents: 'none' }} filter="url(#rel-glow-sm)">
                      {/* Dashed partner lines */}
                      <path d={`M${-30/zf},${-8/zf} Q${-15/zf},${0} ${-12/zf},${0}`} fill="none" stroke={gearColor} strokeWidth={1.5/zf} strokeDasharray={`${4/zf} ${3/zf}`} strokeOpacity={0.5} className="rel-dash-fwd" />
                      <path d={`M${30/zf},${-8/zf} Q${15/zf},${0} ${12/zf},${0}`} fill="none" stroke="#3b82f6" strokeWidth={1.5/zf} strokeDasharray={`${4/zf} ${3/zf}`} strokeOpacity={0.5} className="rel-dash-rev" />
                      {/* Left gear */}
                      <g transform={`translate(${-12/zf}, 0) scale(${gs})`} stroke={gearColor} fill="none">
                        <g><circle r="10" strokeWidth="4" strokeDasharray="3.92 3.92" />
                          <circle r="8" strokeWidth="2" fill="rgba(11,20,38,0.9)" />
                          <circle r="2" strokeWidth="1.5" />
                          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
                        </g>
                      </g>
                      {/* Right gear — counter-rotates */}
                      <g transform={`translate(${12/zf}, 0) scale(${gs})`} stroke="#3b82f6" fill="none">
                        <g><circle r="10" strokeWidth="4" strokeDasharray="3.92 3.92" />
                          <circle r="8" strokeWidth="2" fill="rgba(11,20,38,0.9)" />
                          <circle r="2" strokeWidth="1.5" />
                          <animateTransform attributeName="transform" type="rotate" from="22.5" to="-337.5" dur="4s" repeatCount="indefinite" />
                        </g>
                      </g>
                    </g>
                  );
                }

                if (flavor === 'logistics') {
                  const vehicle = rel.logisticsVehicle ?? 'truck';
                  const vehicleRef = vehicle === 'plane' ? '#rel-plane' : vehicle === 'ship' ? '#rel-ship' : '#rel-truck';
                  const dur = vehicle === 'plane' ? '6s' : vehicle === 'ship' ? '14s' : '10s';
                  return (
                    <g style={{ pointerEvents: 'none' }} filter="url(#rel-glow-sm)">
                      <path id={pid} d={pathD} fill="none" stroke="none" />
                      <use href={vehicleRef}>
                        <animateMotion dur={dur} repeatCount="indefinite" rotate="auto">
                          <mpath href={`#${pid}`} />
                        </animateMotion>
                      </use>
                    </g>
                  );
                }

                // Default: flowing dot along path
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <path id={pid} d={pathD} fill="none" stroke="none" />
                    <circle r={4 / zf} fill={rel.color} opacity={0.9} filter="url(#rel-glow-sm)">
                      <animateMotion dur="2s" repeatCount="indefinite">
                        <mpath href={`#${pid}`} />
                      </animateMotion>
                    </circle>
                  </g>
                );
              })()}
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
            <div style={{ color: rel.description ? '#06b6d4' : '#94a3b8', display: 'flex', alignItems: 'center', padding: '3px 5px' }}>
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
