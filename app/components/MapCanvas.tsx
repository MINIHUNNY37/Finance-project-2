'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useMapStore } from '../store/mapStore';
import WorldMap from './WorldMap';
import EntityCard from './EntityCard';
import RelationshipLayer from './RelationshipLayer';
import EntityDialog from './EntityDialog';
import RelationshipDialog from './RelationshipDialog';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import type { Entity, Relationship } from '../types';

interface MapCanvasProps {
  session: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;

export default function MapCanvas({ session, onSignIn, onSignOut }: MapCanvasProps) {
  const {
    currentMap, addEntity, updateEntity, deleteEntity,
    updateRelationship, setSelectedEntity, setConnectingFrom, connectingFromId,
  } = useMapStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1200, height: 800 });
  const [zoom, setZoom] = useState(1);

  // Entity dialog
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | undefined>();
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | undefined>();
  const [pendingCountry, setPendingCountry] = useState<string | undefined>();

  // Relationship dialog
  const [relDialogOpen, setRelDialogOpen] = useState(false);
  const [editingRel, setEditingRel] = useState<Relationship | undefined>();

  // Mouse position in map (content) coordinates
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const isConnecting = !!connectingFromId;

  // Track container size
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setSelectedEntity(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP)); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP)); }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setConnectingFrom, setSelectedEntity]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Convert screen coords → map (content) coords accounting for zoom centered on container
  const screenToMap = useCallback(
    (screenX: number, screenY: number) => ({
      x: (screenX - dims.width / 2) / zoom + dims.width / 2,
      y: (screenY - dims.height / 2) / zoom + dims.height / 2,
    }),
    [zoom, dims]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setMousePos(screenToMap(sx, sy));
    },
    [screenToMap]
  );

  const handleCanvasClick = useCallback(() => {
    setSelectedEntity(null);
    if (connectingFromId) setConnectingFrom(null);
  }, [setSelectedEntity, connectingFromId, setConnectingFrom]);

  const handleCountryClick = useCallback(
    (country: string, screenX: number, screenY: number) => {
      if (isConnecting) return;
      const pos = screenToMap(screenX, screenY);
      setPendingPosition(pos);
      setPendingCountry(country);
      setEditingEntity(undefined);
      setEntityDialogOpen(true);
    },
    [isConnecting, screenToMap]
  );

  const handleEntitySave = useCallback(
    (data: Partial<Entity>) => {
      if (editingEntity?.id) {
        updateEntity(editingEntity.id, data);
      } else {
        addEntity({
          name: data.name || 'New Entity',
          icon: data.icon || '🏢',
          subtitle: data.subtitle || '',
          description: data.description || '',
          color: data.color || '#3B82F6',
          subItems: data.subItems || [],
          statistics: data.statistics || [],
          country: data.country || '',
          position: data.position || pendingPosition || { x: dims.width / 2, y: dims.height / 2 },
          locked: false,
          folderId: undefined,
          createdBy: session?.user?.email || 'local',
        });
      }
      setEditingEntity(undefined);
      setPendingPosition(undefined);
      setPendingCountry(undefined);
    },
    [editingEntity, updateEntity, addEntity, pendingPosition, dims, session]
  );

  const handleEditEntity = useCallback((entity: Entity) => {
    setEditingEntity(entity);
    setPendingPosition(entity.position);
    setEntityDialogOpen(true);
  }, []);

  const handleEditRelationship = useCallback((rel: Relationship) => {
    setEditingRel(rel);
    setRelDialogOpen(true);
  }, []);

  const handleRelSave = useCallback(
    (data: Partial<Relationship>) => {
      if (editingRel?.id) updateRelationship(editingRel.id, data);
      setEditingRel(undefined);
    },
    [editingRel, updateRelationship]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Toolbar
        onAddEntity={() => {
          setEditingEntity(undefined);
          const pos = screenToMap(dims.width / 2, dims.height / 2);
          setPendingPosition(pos);
          setPendingCountry(undefined);
          setEntityDialogOpen(true);
        }}
        isConnecting={isConnecting}
        onToggleConnect={() => setConnectingFrom(null)}
        session={session}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
        onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
        onZoomReset={() => setZoom(1)}
      />

      <Sidebar />

      {/* Outer clip container */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed', top: 56, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          cursor: isConnecting ? 'crosshair' : 'default',
        }}
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Scaled content layer */}
        <div
          style={{
            width: dims.width,
            height: dims.height,
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          <WorldMap onCountryClick={handleCountryClick} width={dims.width} height={dims.height}>
            <RelationshipLayer
              entities={currentMap.entities}
              relationships={currentMap.relationships}
              width={dims.width}
              height={dims.height}
              connectingFromId={connectingFromId}
              mousePos={mousePos}
              onEditRelationship={handleEditRelationship}
            />
            {currentMap.entities.map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                onEdit={handleEditEntity}
                onDelete={deleteEntity}
                isConnecting={isConnecting}
                isConnectingFrom={connectingFromId === entity.id}
                mapWidth={dims.width}
                mapHeight={dims.height}
                zoom={zoom}
              />
            ))}
          </WorldMap>
        </div>

        {/* Empty state */}
        {currentMap.entities.length === 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none', zIndex: 10,
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🗺️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(147,197,253,0.8)', marginBottom: 8 }}>
              Start Building Your Scenario Map
            </div>
            <div style={{ fontSize: 13, color: 'rgba(100,116,139,0.8)', lineHeight: 1.7 }}>
              Click any country to place an entity<br />
              or use &quot;Add Entity&quot; above<br />
              <span style={{ fontSize: 11, color: 'rgba(71,85,105,0.8)' }}>
                Scroll to zoom · Right-click entity to connect
              </span>
            </div>
          </div>
        )}

        {/* Zoom indicator */}
        {zoom !== 1 && (
          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 8, padding: '4px 10px',
            fontSize: 12, color: '#64748b', pointerEvents: 'none',
          }}>
            {Math.round(zoom * 100)}%
          </div>
        )}

        {/* Connecting hint */}
        {isConnecting && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.5)',
            borderRadius: 10, padding: '8px 16px', color: '#06b6d4',
            fontSize: 13, fontWeight: 500, pointerEvents: 'none',
            backdropFilter: 'blur(8px)', zIndex: 10,
          }}>
            🔗 Right-click another entity to connect · Esc to cancel
          </div>
        )}
      </div>

      <EntityDialog
        isOpen={entityDialogOpen}
        onClose={() => { setEntityDialogOpen(false); setEditingEntity(undefined); setPendingPosition(undefined); }}
        onSave={handleEntitySave}
        initialData={editingEntity}
        defaultPosition={pendingPosition}
        defaultCountry={pendingCountry}
      />
      <RelationshipDialog
        isOpen={relDialogOpen}
        onClose={() => { setRelDialogOpen(false); setEditingRel(undefined); }}
        onSave={handleRelSave}
        initialData={editingRel}
      />
    </div>
  );
}
