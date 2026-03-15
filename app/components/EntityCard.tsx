'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Edit2, Trash2, Link2, FolderPlus, ChevronDown, ChevronUp } from 'lucide-react';
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
}

export default function EntityCard({
  entity,
  onEdit,
  onDelete,
  isConnecting,
  isConnectingFrom,
  mapWidth,
  mapHeight,
}: EntityCardProps) {
  const { moveEntity, setSelectedEntity, setConnectingFrom, addRelationship, connectingFromId, selectedEntityId } =
    useMapStore();

  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; entityX: number; entityY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedEntityId === entity.id;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.no-drag')) return;
      e.preventDefault();
      isDragging.current = false;
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        entityX: entity.position.x,
        entityY: entity.position.y,
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStart.current) return;
        const dx = moveEvent.clientX - dragStart.current.mouseX;
        const dy = moveEvent.clientY - dragStart.current.mouseY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          isDragging.current = true;
        }
        if (isDragging.current) {
          const newX = Math.max(40, Math.min(mapWidth - 80, dragStart.current.entityX + dx));
          const newY = Math.max(40, Math.min(mapHeight - 80, dragStart.current.entityY + dy));
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
    [entity.id, entity.position, mapWidth, mapHeight, moveEntity]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) return;
      e.stopPropagation();

      if (isConnecting && connectingFromId && connectingFromId !== entity.id) {
        // Complete the connection
        addRelationship({
          fromEntityId: connectingFromId,
          toEntityId: entity.id,
          label: '',
          description: '',
          color: '#3B82F6',
          createdBy: 'local',
        });
        setConnectingFrom(null);
        return;
      }

      setSelectedEntity(entity.id);
      setShowActions(true);
    },
    [isConnecting, connectingFromId, entity.id, addRelationship, setConnectingFrom, setSelectedEntity]
  );

  return (
    <div
      ref={cardRef}
      className={`entity-card ${isConnectingFrom ? 'pulse-connect' : ''}`}
      style={{
        position: 'absolute',
        left: entity.position.x - 48,
        top: entity.position.y - 48,
        pointerEvents: 'all',
        zIndex: isSelected ? 200 : 50,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseLeave={() => { if (!isSelected) setShowActions(false); }}
    >
      {/* Main entity node */}
      <div
        className={`relative flex flex-col items-center transition-all duration-150 ${
          isSelected ? 'glow-cyan' : ''
        } ${isConnecting && !isConnectingFrom ? 'cursor-crosshair' : ''}`}
        style={{
          background: isSelected
            ? `linear-gradient(135deg, ${entity.color}33, ${entity.color}55)`
            : `linear-gradient(135deg, ${entity.color}22, ${entity.color}33)`,
          border: `2px solid ${isSelected ? entity.color : entity.color + '88'}`,
          borderRadius: 12,
          minWidth: 96,
          maxWidth: 160,
          padding: '8px 10px',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Icon */}
        <div className="text-2xl leading-none mb-1">{entity.icon}</div>

        {/* Name */}
        <div
          className="text-xs font-semibold text-center leading-tight"
          style={{ color: entity.color, maxWidth: 140 }}
        >
          {entity.name}
        </div>

        {/* Subtitle */}
        {entity.subtitle && (
          <div className="text-xs text-center mt-0.5" style={{ color: 'rgba(148,163,184,0.9)', fontSize: 10 }}>
            {entity.subtitle}
          </div>
        )}

        {/* Country badge */}
        {entity.country && (
          <div
            className="text-xs mt-1 px-1.5 py-0.5 rounded-full"
            style={{
              background: 'rgba(15,23,42,0.7)',
              color: 'rgba(147,197,253,0.8)',
              fontSize: 9,
              border: '1px solid rgba(59,130,246,0.2)',
            }}
          >
            {entity.country}
          </div>
        )}

        {/* Expand toggle */}
        {(entity.description || entity.subItems?.length > 0) && (
          <button
            className="no-drag mt-1 text-xs"
            style={{ color: 'rgba(148,163,184,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}

        {/* Expanded content */}
        {expanded && (
          <div
            className="no-drag mt-2 text-xs rounded-lg fade-in"
            style={{
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(59,130,246,0.2)',
              padding: '8px',
              maxWidth: 200,
              minWidth: 140,
            }}
          >
            {entity.description && (
              <p style={{ color: 'rgba(148,163,184,0.9)', marginBottom: 6, fontSize: 11, lineHeight: 1.4 }}>
                {entity.description}
              </p>
            )}
            {entity.subItems?.map((sub) => (
              <div key={sub.id} className="mt-2">
                <div style={{ color: '#93c5fd', fontWeight: 600, fontSize: 11 }}>{sub.title}</div>
                <div style={{ color: 'rgba(148,163,184,0.8)', fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>
                  {sub.description}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons - shown when selected */}
      {isSelected && (
        <div
          className="no-drag fade-in"
          style={{
            position: 'absolute',
            top: -36,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 4,
            background: 'rgba(26,39,68,0.95)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 8,
            padding: '4px 6px',
            whiteSpace: 'nowrap',
          }}
        >
          <ActionBtn
            icon={<Edit2 size={12} />}
            title="Edit"
            onClick={(e) => { e.stopPropagation(); onEdit(entity); }}
            color="#3b82f6"
          />
          <ActionBtn
            icon={<Link2 size={12} />}
            title="Connect"
            onClick={(e) => { e.stopPropagation(); setConnectingFrom(entity.id); }}
            color="#06b6d4"
          />
          <ActionBtn
            icon={<Trash2 size={12} />}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(entity.id); }}
            color="#ef4444"
          />
        </div>
      )}

      {/* Connecting indicator */}
      {isConnectingFrom && (
        <div
          style={{
            position: 'absolute',
            top: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: '#06b6d4',
            whiteSpace: 'nowrap',
            background: 'rgba(26,39,68,0.9)',
            border: '1px solid #06b6d4',
            borderRadius: 4,
            padding: '2px 6px',
          }}
        >
          Click another entity to connect
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  icon,
  title,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  color: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color,
        cursor: 'pointer',
        padding: '2px 4px',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = `${color}22`)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'none')}
    >
      {icon}
    </button>
  );
}
