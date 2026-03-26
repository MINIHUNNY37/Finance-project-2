'use client';

import React, { useRef, useState, useCallback } from 'react';
import {
  Edit2, Trash2, Link2, ChevronDown, ChevronUp,
  Lock, Unlock, GitMerge,
  Zap, Minus, X, TrendingUp, TrendingDown,
  Star, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import type { Entity, ArrowStyle } from '../types';
import { RELATIONSHIP_COLORS } from '../types';
import { useMapStore } from '../store/mapStore';
import { isVisibleAtDate, getLatestStatsByLabel } from '../utils/dateFilter';

interface RelSettings {
  label: string;
  description: string;
  color: string;
  arrowStyle: ArrowStyle;
}

interface EntityCardProps {
  entity: Entity;
  onEdit: (entity: Entity) => void;
  onDelete: (id: string) => void;
  isConnecting: boolean;
  isConnectingFrom: boolean;
  mapWidth: number;
  mapHeight: number;
  zoom: number;
  onConnectWithSettings: (fromId: string, settings: RelSettings) => void;
  pendingRelSettings: RelSettings | null;
  entitySizeMult?: number;
  onStartDrawConnection?: (id: string) => void;
  isDrawTarget?: boolean;
  onDropConnection?: (id: string) => void;
  isDrawMode?: boolean;
  /** Horizontal offset (in map-space pixels) for world-wrap ghost copies. Default 0. */
  offsetX?: number;
}

export default function EntityCard({
  entity,
  onEdit,
  onDelete,
  isConnecting,
  isConnectingFrom,
  mapWidth,
  mapHeight,
  zoom,
  onConnectWithSettings,
  pendingRelSettings,
  entitySizeMult = 1,
  onStartDrawConnection,
  isDrawTarget = false,
  onDropConnection,
  isDrawMode = false,
  offsetX = 0,
}: EntityCardProps) {
  const {
    moveEntity,
    setSelectedEntity,
    setConnectingFrom,
    addRelationship,
    toggleEntityLock,
    connectingFromId,
    selectedEntityId,
    globalViewDate,
  } = useMapStore();

  const [cardHovered, setCardHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showRelPanel, setShowRelPanel] = useState(false);
  const [relLabel, setRelLabel] = useState('');
  const [relDesc, setRelDesc] = useState('');
  const [relColor, setRelColor] = useState(RELATIONSHIP_COLORS[0]);
  const [relArrowStyle, setRelArrowStyle] = useState<ArrowStyle>('normal');

  const isDragging = useRef(false);
  const dragStart = useRef<{
    mouseX: number; mouseY: number; entityX: number; entityY: number;
  } | null>(null);

  const isSelected = selectedEntityId === entity.id;
  const isLocked = !!entity.locked;

  // Always fixed size: scale(1/zoom) → constant visual size on screen regardless of zoom.
  // entitySizeMult lets the user adjust the overall size from the sidebar slider.
  const entityScale = (1 / zoom) * entitySizeMult;

  // Drag to move
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.no-drag')) return;
      if (e.button !== 0) return;
      if (isLocked) return;
      e.preventDefault();
      isDragging.current = false;
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        entityX: entity.position.x,
        entityY: entity.position.y,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragStart.current) return;
        const dx = (ev.clientX - dragStart.current.mouseX) / zoom;
        const dy = (ev.clientY - dragStart.current.mouseY) / zoom;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging.current = true;
        if (isDragging.current) {
          const newX = Math.max(60, Math.min(mapWidth - 60, dragStart.current.entityX + dx));
          const newY = Math.max(60, Math.min(mapHeight - 60, dragStart.current.entityY + dy));
          moveEntity(entity.id, { x: newX, y: newY });
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        dragStart.current = null;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [entity.id, entity.position, mapWidth, mapHeight, moveEntity, zoom, isLocked]
  );

  const makeRelPayload = useCallback(
    (overrides?: Partial<RelSettings>) => ({
      label: '',
      description: '',
      color: '#10B981',
      arrowStyle: 'normal' as ArrowStyle,
      ...(pendingRelSettings || {}),
      ...overrides,
    }),
    [pendingRelSettings]
  );

  // Right-click: start drawing in draw mode, otherwise normal connect
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isDrawMode) {
        // drawing is started on mousedown; contextmenu just suppresses the menu
        return;
      }
      if (isConnecting && connectingFromId && connectingFromId !== entity.id) {
        const rel = makeRelPayload();
        addRelationship({
          fromEntityId: connectingFromId,
          toEntityId: entity.id,
          label: rel.label,
          description: rel.description,
          color: rel.color,
          arrowStyle: rel.arrowStyle,
          createdBy: 'local',
        });
        setConnectingFrom(null);
      } else {
        setConnectingFrom(entity.id);
        setSelectedEntity(entity.id);
      }
    },
    [isDrawMode, isConnecting, connectingFromId, entity.id, addRelationship, setConnectingFrom, setSelectedEntity, makeRelPayload]
  );

  // Right-mousedown in draw mode → start the draw line
  const handleMouseDownDraw = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawMode || e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      onStartDrawConnection?.(entity.id);
    },
    [isDrawMode, entity.id, onStartDrawConnection]
  );

  // Right-mouseup in draw mode over this entity → complete the connection
  const handleMouseUpDraw = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawMode || e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      onDropConnection?.(entity.id);
    },
    [isDrawMode, entity.id, onDropConnection]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) return;
      e.stopPropagation();
      if (isConnecting && connectingFromId && connectingFromId !== entity.id) {
        const rel = makeRelPayload();
        addRelationship({
          fromEntityId: connectingFromId,
          toEntityId: entity.id,
          label: rel.label,
          description: rel.description,
          color: rel.color,
          arrowStyle: rel.arrowStyle,
          createdBy: 'local',
        });
        setConnectingFrom(null);
        return;
      }
      setSelectedEntity(entity.id);
    },
    [isConnecting, connectingFromId, entity.id, addRelationship, setConnectingFrom, setSelectedEntity, makeRelPayload]
  );

  const handleOpenRelPanel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRelLabel('');
    setRelDesc('');
    setRelColor(RELATIONSHIP_COLORS[0]);
    setRelArrowStyle('normal');
    setShowRelPanel(true);
  }, []);

  const handleRelPanelSave = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRelPanel(false);
    onConnectWithSettings(entity.id, {
      label: relLabel.trim(),
      description: relDesc.trim(),
      color: relColor,
      arrowStyle: relArrowStyle,
    });
  }, [entity.id, relLabel, relDesc, relColor, relArrowStyle, onConnectWithSettings]);

  const hasExpandable =
    !!(entity.thesis || entity.exitCriteria ||
      (entity.catalysts && entity.catalysts.length > 0) ||
      (entity.tags && entity.tags.length > 0));

  return (
    /**
     * Outer anchor: zero-size div positioned exactly at entity.position.
     * entityScale counter-acts the parent scaled layer:
     *   - fixedSize: scale(1/zoom) → constant visual size on screen
     *   - auto: scale(1/zoom^1.5) at zoom>1 → entities shrink at high zoom
     *           scale(1/zoom) at zoom≤1 → constant size when zoomed out
     */
    <div
      className={`entity-card ${isConnectingFrom ? 'pulse-connect' : ''}`}
      style={{
        position: 'absolute',
        left: entity.position.x + offsetX,
        top: entity.position.y,
        pointerEvents: 'all',
        zIndex: isSelected ? 200 : 50,
        transform: `scale(${entityScale})`,
        transformOrigin: '0 0',
      }}
      onMouseDown={(e) => { handleMouseDownDraw(e); handleMouseDown(e); }}
      onMouseUp={(e) => {
        handleMouseUpDraw(e);
        if (!isDrawMode && isDrawTarget) {
          e.stopPropagation();
          onDropConnection?.(entity.id);
        }
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
    >
      {isSelected ? (
        /* ── FULL CARD (selected) ── center of card anchored at (0,0) */
        <div style={{ position: 'absolute', left: -65, top: -60 }}>
          {/* Action toolbar above card */}
          {!showRelPanel ? (
            <div
              className="no-drag fade-in"
              style={{
                position: 'absolute',
                top: -38,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 2,
                background: 'rgba(15,23,42,0.97)',
                border: '1px solid rgba(59,130,246,0.35)',
                borderRadius: 10,
                padding: '5px 8px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <ActionBtn icon={<Edit2 size={12} />} title="Edit" label="Edit" onClick={(e) => { e.stopPropagation(); onEdit(entity); }} color="#3b82f6" />
              <ActionBtn icon={<Link2 size={12} />} title="Connect" label="Link" onClick={(e) => { e.stopPropagation(); setConnectingFrom(entity.id); }} color="#06b6d4" />
              <ActionBtn
                icon={entity.locked ? <Unlock size={12} /> : <Lock size={12} />}
                title={entity.locked ? 'Unlock position' : 'Lock position'}
                label={entity.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => { e.stopPropagation(); toggleEntityLock(entity.id); }}
                color="#94a3b8"
              />
              {/* divider */}
              <div style={{ width: 1, height: 28, background: 'rgba(59,130,246,0.2)', margin: '0 2px' }} />
              <ActionBtn icon={<Trash2 size={12} />} title="Delete" label="Del" onClick={(e) => { e.stopPropagation(); onDelete(entity.id); }} color="#ef4444" />
            </div>
          ) : (
            /* ── Inline relationship settings panel ── */
            <div
              className="no-drag fade-in"
              style={{
                position: 'absolute',
                top: -168,
                left: '50%',
                transform: 'translateX(-50%)',
                minWidth: 240,
                background: 'rgba(10,17,34,0.98)',
                border: '1px solid rgba(167,139,250,0.5)',
                borderRadius: 12,
                padding: '12px 14px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Connection Settings
                </span>
                <button onClick={(e) => { e.stopPropagation(); setShowRelPanel(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                  <X size={13} />
                </button>
              </div>

              {/* Label */}
              <input
                className="input-field"
                value={relLabel}
                onChange={(e) => setRelLabel(e.target.value)}
                placeholder="Label (e.g. Supplies to)"
                style={{ width: '100%', fontSize: 11, padding: '5px 8px', marginBottom: 8, boxSizing: 'border-box' }}
              />

              {/* Note */}
              <textarea
                className="input-field"
                value={relDesc}
                onChange={(e) => setRelDesc(e.target.value)}
                placeholder="Note (shown on arrow)"
                rows={2}
                style={{ width: '100%', fontSize: 11, padding: '5px 8px', marginBottom: 8, resize: 'none', boxSizing: 'border-box' }}
              />

              {/* Arrow style */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button
                  onClick={() => setRelArrowStyle('normal')}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: 7, cursor: 'pointer', fontSize: 10,
                    border: `1px solid ${relArrowStyle === 'normal' ? relColor : 'rgba(59,130,246,0.2)'}`,
                    background: relArrowStyle === 'normal' ? `${relColor}20` : 'transparent',
                    color: relArrowStyle === 'normal' ? relColor : '#8899b0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <Minus size={10} /> Normal
                </button>
                <button
                  onClick={() => setRelArrowStyle('animated')}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: 7, cursor: 'pointer', fontSize: 10,
                    border: `1px solid ${relArrowStyle === 'animated' ? relColor : 'rgba(59,130,246,0.2)'}`,
                    background: relArrowStyle === 'animated' ? `${relColor}20` : 'transparent',
                    color: relArrowStyle === 'animated' ? relColor : '#8899b0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <Zap size={10} /> Animated
                </button>
              </div>

              {/* Color swatches */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {RELATIONSHIP_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setRelColor(c)}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: relColor === c ? '2px solid white' : '2px solid transparent',
                      boxShadow: relColor === c ? `0 0 6px ${c}` : 'none',
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRelPanel(false); }}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 7, cursor: 'pointer', fontSize: 11,
                    background: 'transparent', border: '1px solid rgba(59,130,246,0.2)', color: '#8899b0',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRelPanelSave}
                  style={{
                    flex: 2, padding: '5px 0', borderRadius: 7, cursor: 'pointer', fontSize: 11,
                    background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.5)',
                    color: '#a78bfa', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  <GitMerge size={11} /> Save &amp; Connect
                </button>
              </div>
            </div>
          )}

          {isConnectingFrom && (
            <div style={{
              position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
              fontSize: 10, color: '#06b6d4', whiteSpace: 'nowrap',
              background: 'rgba(26,39,68,0.95)', border: '1px solid #06b6d4',
              borderRadius: 5, padding: '2px 8px',
            }}>
              Click target to connect
            </div>
          )}

          {/* Card body */}
          <div
            className="relative flex flex-col items-center transition-all duration-150 glow-cyan"
            style={{
              background: `linear-gradient(135deg, ${entity.color}44, ${entity.color}66)`,
              border: `2px solid ${entity.color}`,
              borderRadius: 14,
              minWidth: 130,
              maxWidth: 200,
              padding: '12px 14px',
              backdropFilter: 'blur(10px)',
              cursor: isLocked ? 'default' : isConnecting ? 'crosshair' : 'grab',
            }}
          >
            {isLocked && (
              <div style={{ position: 'absolute', top: 6, right: 6, color: entity.color, opacity: 0.6 }}>
                <Lock size={9} />
              </div>
            )}


            <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>{entity.icon}</div>
            <div style={{ color: entity.color, fontWeight: 700, fontSize: 13, textAlign: 'center', lineHeight: 1.3, maxWidth: 170 }}>
              {entity.name}
            </div>
            {entity.subtitle && (
              <div style={{ color: 'rgba(148,163,184,0.9)', fontSize: 11, textAlign: 'center', marginTop: 3 }}>
                {entity.subtitle}
              </div>
            )}
            {/* Conviction stars */}
            {entity.conviction != null && entity.conviction > 0 && (
              <div style={{ display: 'flex', gap: 2, marginTop: 4, justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={10} fill={n <= entity.conviction! ? entity.color : 'none'}
                    color={n <= entity.conviction! ? entity.color : '#8899b0'} />
                ))}
              </div>
            )}
            {/* Sector badge */}
            {entity.sector && (
              <div style={{ marginTop: 4, fontSize: 9, color: entity.color, background: `${entity.color}15`,
                border: `1px solid ${entity.color}30`, borderRadius: 4, padding: '1px 6px', textAlign: 'center' }}>
                {entity.sector}
              </div>
            )}
            {/* Live price row */}
            {entity.livePrice != null && (
              <div style={{
                marginTop: 7,
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: '5px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                justifyContent: 'center',
                width: '100%',
                boxSizing: 'border-box',
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                  ${entity.livePrice.toFixed(2)}
                </span>
                {entity.priceChangePct != null && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: entity.priceChangePct >= 0 ? '#22c55e' : '#ef4444',
                    display: 'flex', alignItems: 'center', gap: 2,
                    background: entity.priceChangePct >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    borderRadius: 5, padding: '1px 5px',
                  }}>
                    {entity.priceChangePct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {entity.priceChangePct >= 0 ? '+' : ''}{entity.priceChangePct.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
            {/* Upside indicator */}
            {(() => {
              const base = entity.livePrice ?? entity.entryPrice;
              const tp = entity.targetPrice;
              if (base == null || tp == null) return null;
              const upside = ((tp - base) / base) * 100;
              const col = upside >= 20 ? '#22c55e' : upside >= 5 ? '#84cc16' : upside >= -5 ? '#f59e0b' : '#ef4444';
              const barPct = Math.min(100, Math.max(0, upside + 50)); // 0–100 visual range
              return (
                <div style={{ marginTop: 6, width: '100%' }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: col,
                    display: 'flex', justifyContent: 'space-between', marginBottom: 3,
                  }}>
                    <span style={{ color: '#94a3b8', fontWeight: 400 }}>Target</span>
                    <span>{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: col, borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })()}

            {hasExpandable && (
              <button
                className="no-drag"
                style={{ color: 'rgba(148,163,184,0.5)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}

            {expanded && (
              <div
                className="no-drag fade-in"
                style={{
                  marginTop: 8, background: 'rgba(15,23,42,0.93)',
                  border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10,
                  padding: 10, width: '100%', minWidth: 160,
                }}
              >
                {/* Thesis */}
                {entity.thesis && (
                  <div style={{ marginTop: 6, borderTop: '1px solid rgba(59,130,246,0.15)', paddingTop: 6 }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Thesis</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>{entity.thesis}</div>
                  </div>
                )}
                {entity.exitCriteria && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 9, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, opacity: 0.8 }}>Exit If</div>
                    <div style={{ fontSize: 10, color: '#fca5a5', lineHeight: 1.4 }}>{entity.exitCriteria}</div>
                  </div>
                )}
                {/* Catalysts */}
                {entity.catalysts && entity.catalysts.length > 0 && (
                  <div style={{ marginTop: 6, borderTop: '1px solid rgba(59,130,246,0.15)', paddingTop: 6 }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Catalysts</div>
                    {entity.catalysts.map((cat) => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        {cat.status === 'hit' ? <CheckCircle size={10} style={{ color: '#22c55e', flexShrink: 0 }} />
                          : cat.status === 'miss' ? <XCircle size={10} style={{ color: '#ef4444', flexShrink: 0 }} />
                          : <Clock size={10} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                        <span style={{ fontSize: 10, color: cat.status === 'hit' ? '#86efac' : cat.status === 'miss' ? '#fca5a5' : '#94a3b8',
                          textDecoration: cat.status !== 'pending' ? 'line-through' : 'none', flex: 1 }}>
                          {cat.event}
                        </span>
                        {cat.expectedDate && (
                          <span style={{ fontSize: 8, color: '#94a3b8' }}>
                            {new Date(cat.expectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Tags */}
                {entity.tags && entity.tags.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {entity.tags.map((t) => (
                      <span key={t} style={{ fontSize: 8, color: '#8899b0', background: 'rgba(59,130,246,0.06)',
                        border: '1px solid rgba(59,130,246,0.12)', borderRadius: 3, padding: '1px 5px' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── PIN MODE (not selected) ──
           translate(-50%, -100%) puts the bottom-center of this stack
           exactly at (0,0) = entity.position, so the pin tip is on the map point. */
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: cardHovered ? 'translate(-50%, -100%) translateY(-4px)' : 'translate(-50%, -100%)',
            transition: 'transform 0.18s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: isLocked ? 'default' : isConnecting ? 'crosshair' : 'pointer',
            userSelect: 'none',
          }}
        >
          {/* Stock entity hint — appears above the badge on hover */}
          {cardHovered && entity.entityKind === 'stock' && (
            <div
              className="fade-in"
              style={{
                fontSize: 9,
                color: '#06b6d4',
                background: 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.3)',
                borderRadius: 5,
                padding: '2px 7px',
                marginBottom: 4,
                whiteSpace: 'nowrap',
                letterSpacing: '0.04em',
              }}
            >
              double-click for analysis
            </div>
          )}

          {/* Label badge */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(20,30,55,0.92))',
              border: `2px solid ${entity.color}`,
              borderRadius: 10,
              padding: '5px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: cardHovered
                ? `0 6px 20px rgba(0,0,0,0.65), 0 0 0 1px ${entity.color}55, 0 0 14px ${entity.color}33`
                : `0 3px 14px rgba(0,0,0,0.55), 0 0 0 1px ${entity.color}33`,
              backdropFilter: 'blur(10px)',
              maxWidth: 170,
              transition: 'box-shadow 0.18s ease',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{entity.icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 120 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  color: entity.color, fontWeight: 700, fontSize: 12,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {entity.name}
                </span>
                {entity.conviction != null && entity.conviction > 0 && (
                  <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                    {[1,2,3,4,5].map(n => (
                      <div key={n} style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: n <= entity.conviction! ? entity.color : 'rgba(148,163,184,0.25)',
                      }} />
                    ))}
                  </div>
                )}
              </div>
              {entity.livePrice != null ? (
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.85)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: '#e2e8f0' }}>${entity.livePrice.toFixed(2)}</span>
                  {entity.priceChangePct != null && (
                    <span style={{ color: entity.priceChangePct >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {entity.priceChangePct >= 0 ? '▲' : '▼'}{Math.abs(entity.priceChangePct).toFixed(1)}%
                    </span>
                  )}
                </span>
              ) : entity.ticker ? (
                <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 1 }}>{entity.ticker}</span>
              ) : null}
            </div>
            {entity.entityKind === 'stock' && (
              <div style={{
                fontSize: 8, fontWeight: 700, color: '#06b6d4',
                background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)',
                borderRadius: 4, padding: '1px 4px', flexShrink: 0, alignSelf: 'flex-start',
              }}>STOCK</div>
            )}
          </div>

          {/* Triangle pointer */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: `10px solid ${entity.color}`,
              marginTop: -1,
            }}
          />

          {/* Dot at the map point */}
          <div
            style={{
              width: cardHovered ? 10 : 8,
              height: cardHovered ? 10 : 8,
              borderRadius: '50%',
              background: entity.color,
              boxShadow: cardHovered
                ? `0 0 12px ${entity.color}, 0 0 24px ${entity.color}88`
                : `0 0 8px ${entity.color}, 0 0 16px ${entity.color}55`,
              marginTop: -1,
              transition: 'width 0.18s ease, height 0.18s ease, box-shadow 0.18s ease',
            }}
          />
        </div>
      )}

      {/* ── Draw-connection port: visible on hover, draggable ── */}
      {cardHovered && !isConnecting && onStartDrawConnection && (
        <div
          className="no-drag fade-in"
          title="Drag to draw a connection"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onStartDrawConnection(entity.id);
          }}
          style={{
            position: 'absolute',
            /* pin mode: card top-right corner; selected: top-right of card body */
            left: isSelected ? 60 : 58,
            top: isSelected ? -58 : -80,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'rgba(6,182,212,0.95)',
            border: '2px solid rgba(255,255,255,0.7)',
            cursor: 'crosshair',
            zIndex: 400,
            boxShadow: '0 0 0 3px rgba(6,182,212,0.25), 0 0 12px rgba(6,182,212,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
        </div>
      )}

      {/* ── Draw target ring ── */}
      {isDrawTarget && (
        <div
          style={{
            position: 'absolute',
            left: isSelected ? -68 : -22,
            top: isSelected ? -63 : -85,
            width: isSelected ? 220 : 160,
            height: isSelected ? 280 : 88,
            borderRadius: 14,
            border: '2px solid #06b6d4',
            boxShadow: '0 0 16px rgba(6,182,212,0.55)',
            pointerEvents: 'none',
            zIndex: 300,
            animation: 'pulseRing 1s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

function ActionBtn({ icon, title, label, onClick, color }: {
  icon: React.ReactNode; title: string; label?: string;
  onClick: (e: React.MouseEvent) => void; color: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none', border: 'none', color, cursor: 'pointer',
        padding: '4px 6px', borderRadius: 6,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        transition: 'background 0.12s ease, transform 0.1s ease',
        minWidth: 32,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = `${color}20`;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'none';
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      {icon}
      {label && (
        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1, opacity: 0.85 }}>
          {label}
        </span>
      )}
    </button>
  );
}
