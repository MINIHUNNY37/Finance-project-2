'use client';

import React, { useRef, useState, useCallback } from 'react';
import {
  Edit2, Trash2, Link2, ChevronDown, ChevronUp,
  Lock, Unlock, GitMerge, Maximize2, Minimize2,
  Zap, Minus, X,
} from 'lucide-react';
import type { Entity, ArrowStyle } from '../types';
import { RELATIONSHIP_COLORS } from '../types';
import { useMapStore } from '../store/mapStore';

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
  fixedEntitySize?: boolean;
  onConnectWithSettings: (fromId: string, settings: RelSettings) => void;
  pendingRelSettings: RelSettings | null;
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
  fixedEntitySize = false,
  onConnectWithSettings,
  pendingRelSettings,
}: EntityCardProps) {
  const {
    moveEntity,
    setSelectedEntity,
    setConnectingFrom,
    addRelationship,
    toggleEntityLock,
    toggleEntityFixedSize,
    connectingFromId,
    selectedEntityId,
    globalLocked,
  } = useMapStore();

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
  const isLocked = globalLocked || !!entity.locked;
  const isFixedSize = entity.fixedSize || fixedEntitySize;

  // Scale formula:
  // - fixedSize mode: scale(1/zoom) → entity stays constant visual size on screen
  // - auto mode: scale(1 / zoom^1.5) when zoom>1, scale(1/zoom) when zoom≤1
  //   → entities maintain native size when zoomed out, shrink as you zoom in
  const entityScale = (() => {
    if (isFixedSize) return 1 / zoom;
    const z = zoom > 1 ? Math.pow(zoom, 1.5) : zoom;
    return 1 / z;
  })();

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

  // Right-click to connect
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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
    [isConnecting, connectingFromId, entity.id, addRelationship, setConnectingFrom, setSelectedEntity, makeRelPayload]
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
    entity.description ||
    entity.subItems?.length > 0 ||
    entity.statistics?.length > 0;

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
        left: entity.position.x,
        top: entity.position.y,
        pointerEvents: 'all',
        zIndex: isSelected ? 200 : 50,
        transform: `scale(${entityScale})`,
        transformOrigin: '0 0',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
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
              <ActionBtn icon={<Edit2 size={13} />} title="Edit" onClick={(e) => { e.stopPropagation(); onEdit(entity); }} color="#3b82f6" />
              <ActionBtn icon={<Link2 size={13} />} title="Connect" onClick={(e) => { e.stopPropagation(); setConnectingFrom(entity.id); }} color="#06b6d4" />
              <ActionBtn
                icon={<GitMerge size={13} />}
                title="Connect with settings"
                onClick={handleOpenRelPanel}
                color="#a78bfa"
              />
              <ActionBtn
                icon={entity.fixedSize ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                title={entity.fixedSize ? 'Size locked (click to auto-scale)' : 'Lock size (keep fixed on zoom)'}
                onClick={(e) => { e.stopPropagation(); toggleEntityFixedSize(entity.id); }}
                color="#f59e0b"
              />
              <ActionBtn
                icon={entity.locked ? <Unlock size={13} /> : <Lock size={13} />}
                title={entity.locked ? 'Unlock position' : 'Lock position'}
                onClick={(e) => { e.stopPropagation(); toggleEntityLock(entity.id); }}
                color="#94a3b8"
              />
              <ActionBtn icon={<Trash2 size={13} />} title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(entity.id); }} color="#ef4444" />
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}>
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
                    color: relArrowStyle === 'normal' ? relColor : '#64748b',
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
                    color: relArrowStyle === 'animated' ? relColor : '#64748b',
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
                    background: 'transparent', border: '1px solid rgba(59,130,246,0.2)', color: '#64748b',
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
            {entity.fixedSize && (
              <div style={{ position: 'absolute', top: 6, left: 6, color: '#f59e0b', opacity: 0.7 }}>
                <Maximize2 size={9} />
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
            {entity.country && (
              <div style={{
                marginTop: 6, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(15,23,42,0.75)', color: 'rgba(147,197,253,0.85)',
                fontSize: 10, border: '1px solid rgba(59,130,246,0.25)',
              }}>
                {entity.country}
              </div>
            )}

            {entity.statistics?.length > 0 && (
              <div style={{ marginTop: 6, width: '100%' }}>
                {entity.statistics.slice(0, 2).map((stat) => (
                  <div key={stat.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 2 }}>
                    <span style={{ color: 'rgba(148,163,184,0.7)' }}>{stat.name}</span>
                    <span style={{ color: entity.color, fontWeight: 600 }}>{stat.value || '—'}</span>
                  </div>
                ))}
              </div>
            )}

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
                {entity.description && (
                  <p style={{ color: 'rgba(148,163,184,0.9)', fontSize: 11, lineHeight: 1.4, marginBottom: 6 }}>
                    {entity.description}
                  </p>
                )}
                {entity.subItems?.map((sub) => (
                  <div key={sub.id} style={{ marginBottom: 6 }}>
                    <div style={{ color: '#93c5fd', fontWeight: 600, fontSize: 11 }}>{sub.title}</div>
                    <div style={{ color: 'rgba(148,163,184,0.8)', fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>{sub.description}</div>
                  </div>
                ))}
                {entity.statistics?.length > 0 && (
                  <div style={{ marginTop: 4, borderTop: '1px solid rgba(59,130,246,0.15)', paddingTop: 6 }}>
                    <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      Key Statistics
                    </div>
                    {entity.statistics.map((stat) => (
                      <div key={stat.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ color: 'rgba(148,163,184,0.75)' }}>{stat.name}</span>
                        <span style={{ color: entity.color, fontWeight: 600 }}>{stat.value || '—'}</span>
                      </div>
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
            transform: 'translate(-50%, -100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: isLocked ? 'default' : isConnecting ? 'crosshair' : 'pointer',
            userSelect: 'none',
          }}
        >
          {/* Label badge */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(20,30,55,0.88))',
              border: `2px solid ${entity.color}`,
              borderRadius: 10,
              padding: '5px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: `0 3px 14px rgba(0,0,0,0.55), 0 0 0 1px ${entity.color}33`,
              backdropFilter: 'blur(10px)',
              maxWidth: 170,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{entity.icon}</span>
            <span
              style={{
                color: entity.color,
                fontWeight: 700,
                fontSize: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 120,
              }}
            >
              {entity.name}
            </span>
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
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: entity.color,
              boxShadow: `0 0 8px ${entity.color}, 0 0 16px ${entity.color}55`,
              marginTop: -1,
            }}
          />
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon, title, onClick, color }: {
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
