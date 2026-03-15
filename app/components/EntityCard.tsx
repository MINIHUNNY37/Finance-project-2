'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Edit2, Trash2, Link2, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react';
import type { Entity } from '../types';
import { useMapStore } from '../store/mapStore';

interface EntityCardProps {
  entity: Entity;
  onEdit: (entity: Entity) => void;
  onDelete: (id: string) => void;
  isConnecting: boolean;
  isConnectingFrom: boolean;
  mapWidth: number;
  mapHeight: number;
  zoom: number;
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
}: EntityCardProps) {
  const {
    moveEntity,
    setSelectedEntity,
    setConnectingFrom,
    addRelationship,
    toggleEntityLock,
    connectingFromId,
    selectedEntityId,
    globalLocked,
  } = useMapStore();

  const [expanded, setExpanded] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef<{
    mouseX: number; mouseY: number; entityX: number; entityY: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedEntityId === entity.id;
  const isLocked = globalLocked || !!entity.locked;

  // Left-click drag to move
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.no-drag')) return;
      if (e.button !== 0) return; // left click only for drag
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

  // Right-click hold + drag to start connecting
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isConnecting && connectingFromId && connectingFromId !== entity.id) {
        // Complete connection via right-click on target
        addRelationship({
          fromEntityId: connectingFromId,
          toEntityId: entity.id,
          label: '',
          description: '',
          color: '#3B82F6',
          arrowStyle: 'normal',
          createdBy: 'local',
        });
        setConnectingFrom(null);
      } else {
        // Start connecting from this entity
        setConnectingFrom(entity.id);
        setSelectedEntity(entity.id);
      }
    },
    [isConnecting, connectingFromId, entity.id, addRelationship, setConnectingFrom, setSelectedEntity]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) return;
      e.stopPropagation();

      if (isConnecting && connectingFromId && connectingFromId !== entity.id) {
        addRelationship({
          fromEntityId: connectingFromId,
          toEntityId: entity.id,
          label: '',
          description: '',
          color: '#3B82F6',
          arrowStyle: 'normal',
          createdBy: 'local',
        });
        setConnectingFrom(null);
        return;
      }
      setSelectedEntity(entity.id);
    },
    [isConnecting, connectingFromId, entity.id, addRelationship, setConnectingFrom, setSelectedEntity]
  );

  const hasExpandable =
    entity.description ||
    entity.subItems?.length > 0 ||
    entity.statistics?.length > 0;

  return (
    <div
      ref={cardRef}
      className={`entity-card ${isConnectingFrom ? 'pulse-connect' : ''}`}
      style={{
        position: 'absolute',
        left: entity.position.x - 60,
        top: entity.position.y - 56,
        pointerEvents: 'all',
        zIndex: isSelected ? 200 : 50,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Main entity node — thicker */}
      <div
        className={`relative flex flex-col items-center transition-all duration-150 ${isSelected ? 'glow-cyan' : ''}`}
        style={{
          background: isSelected
            ? `linear-gradient(135deg, ${entity.color}44, ${entity.color}66)`
            : `linear-gradient(135deg, ${entity.color}28, ${entity.color}40)`,
          border: `2px solid ${isSelected ? entity.color : entity.color + 'aa'}`,
          borderRadius: 14,
          minWidth: 120,
          maxWidth: 180,
          padding: '12px 14px',
          backdropFilter: 'blur(10px)',
          cursor: isLocked ? 'default' : isConnecting ? 'crosshair' : 'grab',
        }}
      >
        {/* Lock indicator */}
        {isLocked && (
          <div style={{ position: 'absolute', top: 6, right: 6, color: entity.color, opacity: 0.6 }}>
            <Lock size={9} />
          </div>
        )}

        {/* Icon */}
        <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 6 }}>{entity.icon}</div>

        {/* Name */}
        <div style={{ color: entity.color, fontWeight: 700, fontSize: 13, textAlign: 'center', lineHeight: 1.3, maxWidth: 160 }}>
          {entity.name}
        </div>

        {/* Subtitle */}
        {entity.subtitle && (
          <div style={{ color: 'rgba(148,163,184,0.9)', fontSize: 11, textAlign: 'center', marginTop: 3 }}>
            {entity.subtitle}
          </div>
        )}

        {/* Country badge */}
        {entity.country && (
          <div style={{
            marginTop: 6, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(15,23,42,0.75)', color: 'rgba(147,197,253,0.85)',
            fontSize: 10, border: '1px solid rgba(59,130,246,0.25)',
          }}>
            {entity.country}
          </div>
        )}

        {/* Key statistics preview (top 2) */}
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

        {/* Expand toggle */}
        {hasExpandable && (
          <button
            className="no-drag"
            style={{ color: 'rgba(148,163,184,0.5)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}

        {/* Expanded panel */}
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

            {/* Sub-items */}
            {entity.subItems?.map((sub) => (
              <div key={sub.id} style={{ marginBottom: 6 }}>
                <div style={{ color: '#93c5fd', fontWeight: 600, fontSize: 11 }}>{sub.title}</div>
                <div style={{ color: 'rgba(148,163,184,0.8)', fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>
                  {sub.description}
                </div>
              </div>
            ))}

            {/* All statistics */}
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

      {/* Action toolbar — visible when selected */}
      {isSelected && (
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
          <ActionBtn icon={<Link2 size={13} />} title="Right-click to connect" onClick={(e) => { e.stopPropagation(); setConnectingFrom(entity.id); }} color="#06b6d4" />
          <ActionBtn
            icon={entity.locked ? <Unlock size={13} /> : <Lock size={13} />}
            title={entity.locked ? 'Unlock' : 'Lock position'}
            onClick={(e) => { e.stopPropagation(); toggleEntityLock(entity.id); }}
            color="#f59e0b"
          />
          <ActionBtn icon={<Trash2 size={13} />} title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(entity.id); }} color="#ef4444" />
        </div>
      )}

      {/* Connecting-from indicator */}
      {isConnectingFrom && (
        <div style={{
          position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, color: '#06b6d4', whiteSpace: 'nowrap',
          background: 'rgba(26,39,68,0.95)', border: '1px solid #06b6d4',
          borderRadius: 5, padding: '2px 8px',
        }}>
          Right-click target to connect
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
