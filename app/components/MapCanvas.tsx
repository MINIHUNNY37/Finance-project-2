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
import type { Entity, Relationship, ArrowStyle } from '../types';

interface MapCanvasProps {
  session: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 7.5;
const ZOOM_STEP = 0.15;

export default function MapCanvas({ session, onSignIn, onSignOut }: MapCanvasProps) {
  const {
    currentMap, addEntity, updateEntity, deleteEntity,
    updateRelationship, setSelectedEntity, setConnectingFrom, connectingFromId,
  } = useMapStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1200, height: 800 });
  const [zoom, setZoom] = useState(1);
  const [fixedEntitySize, setFixedEntitySize] = useState(false);
  const [entitySizeMult, setEntitySizeMult] = useState(1);
  const [arrowSizeMult, setArrowSizeMult] = useState(1);

  // Pan state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const wasPanning = useRef(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null);

  // Refs that always hold the latest zoom/pan — used inside wheel handler
  // to avoid calling setState inside another setState's updater (React anti-pattern)
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Entity dialog
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | undefined>();
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | undefined>();
  const [pendingCountry, setPendingCountry] = useState<string | undefined>();

  // Relationship dialog
  const [relDialogOpen, setRelDialogOpen] = useState(false);
  const [editingRel, setEditingRel] = useState<Relationship | undefined>();

  // Pending settings for "connect with settings" flow
  const pendingRelSettingsRef = useRef<{
    label: string; description: string; color: string; arrowStyle: ArrowStyle;
  } | null>(null);
  const [pendingRelSettings, setPendingRelSettings] = useState<{
    label: string; description: string; color: string; arrowStyle: ArrowStyle;
  } | null>(null);

  // Mouse position in map (content) coordinates
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const isConnecting = !!connectingFromId;

  // Keep refs in sync with state for sources other than the wheel handler
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = panOffset; }, [panOffset]);

  // Clear pending rel settings whenever connect mode ends
  useEffect(() => {
    if (!connectingFromId) {
      pendingRelSettingsRef.current = null;
      setPendingRelSettings(null);
    }
  }, [connectingFromId]);

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
        pendingRelSettingsRef.current = null;
        setPendingRelSettings(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP)); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP)); }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(1); setPanOffset({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setConnectingFrom, setSelectedEntity]);

  // Mouse wheel zoom toward cursor
  // Uses refs so rapid scroll events always read the latest accumulated values
  // without the React anti-pattern of calling setState inside another setState updater.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const hw = rect.width / 2;
      const hh = rect.height / 2;

      const prevZoom = zoomRef.current;
      const prevPan = panRef.current;

      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom * delta));
      const ratio = newZoom / prevZoom;
      // With transformOrigin:center, keep map point under cursor fixed:
      // panX_new = (cx - hw)*(1 - ratio) + ratio*panX_old
      const newPan = {
        x: (cx - hw) * (1 - ratio) + ratio * prevPan.x,
        y: (cy - hh) * (1 - ratio) + ratio * prevPan.y,
      };

      // Update refs first so the next wheel event sees the new values
      zoomRef.current = newZoom;
      panRef.current = newPan;

      setZoom(newZoom);
      setPanOffset(newPan);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Convert screen coords → map coords accounting for pan + zoom
  const screenToMap = useCallback(
    (screenX: number, screenY: number) => ({
      x: (screenX - panOffset.x - dims.width / 2) / zoom + dims.width / 2,
      y: (screenY - panOffset.y - dims.height / 2) / zoom + dims.height / 2,
    }),
    [zoom, dims, panOffset]
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

  // Pan on background drag
  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Only pan if the direct target is the background (not an entity/button)
      const target = e.target as HTMLElement;
      if (target.closest('.entity-card') || target.closest('button') || target.closest('.no-drag')) return;

      wasPanning.current = false;
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: panOffset.x,
        panY: panOffset.y,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!panStartRef.current) return;
        const dx = ev.clientX - panStartRef.current.mouseX;
        const dy = ev.clientY - panStartRef.current.mouseY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasPanning.current = true;
        if (wasPanning.current) {
          setPanOffset({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        panStartRef.current = null;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [panOffset]
  );

  const handleCanvasClick = useCallback(() => {
    if (wasPanning.current) return; // Was a drag-to-pan, not a click
    setSelectedEntity(null);
    if (connectingFromId) {
      setConnectingFrom(null);
      pendingRelSettingsRef.current = null;
      setPendingRelSettings(null);
    }
  }, [setSelectedEntity, connectingFromId, setConnectingFrom]);

  const handleCountryClick = useCallback(
    (country: string, clientX: number, clientY: number) => {
      if (isConnecting) return;
      if (wasPanning.current) return;
      // Convert viewport coords → container-relative → map coords.
      // Must use containerRef rect (not the SVG rect) because the SVG rect
      // moves with zoom/pan, which would give wrong positions otherwise.
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = screenToMap(clientX - rect.left, clientY - rect.top);
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
        // Never overwrite position when editing — entity keeps wherever it currently is
        const { position: _pos, ...updateData } = data;
        updateEntity(editingEntity.id, updateData);
      } else {
        addEntity({
          name: data.name || 'New Entity',
          icon: data.icon || '🏢', // dialog guarantees icon is set; fallback just in case
          subtitle: data.subtitle || '',
          description: data.description || '',
          color: data.color || '#3B82F6',
          subItems: data.subItems || [],
          statistics: data.statistics || [],
          country: data.country || '',
          position: pendingPosition || { x: dims.width / 2, y: dims.height / 2 },
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

  const handleConnectWithSettings = useCallback(
    (fromId: string, settings: { label: string; description: string; color: string; arrowStyle: ArrowStyle }) => {
      pendingRelSettingsRef.current = settings;
      setPendingRelSettings(settings);
      setConnectingFrom(fromId);
      setSelectedEntity(fromId);
    },
    [setConnectingFrom, setSelectedEntity]
  );

  const handleRelSave = useCallback(
    (data: Partial<Relationship>) => {
      if (editingRel?.id) updateRelationship(editingRel.id, data);
      setEditingRel(undefined);
    },
    [editingRel, updateRelationship]
  );

  // Pan the view so the given map-coordinate position is centered on screen.
  // Formula with transformOrigin:center — to center point (px, py):
  //   screenX = zoom*(px - cw/2) + panX + cw/2 = cw/2
  //   => panX = zoom*(cw/2 - px)
  const handleFocusEntity = useCallback(
    (pos: { x: number; y: number }) => {
      const newPan = {
        x: zoom * (dims.width / 2 - pos.x),
        y: zoom * (dims.height / 2 - pos.y),
      };
      panRef.current = newPan;
      setPanOffset(newPan);
    },
    [zoom, dims]
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
        onToggleConnect={() => {
          setConnectingFrom(null);
          pendingRelSettingsRef.current = null;
          setPendingRelSettings(null);
        }}
        session={session}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
        onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
        onZoomReset={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
        fixedEntitySize={fixedEntitySize}
        onToggleFixedEntitySize={() => setFixedEntitySize((v) => !v)}
      />

      <Sidebar
        onFocusEntity={handleFocusEntity}
        onConnectWithSettings={handleConnectWithSettings}
        entitySizeMult={entitySizeMult}
        onEntitySizeChange={setEntitySizeMult}
        arrowSizeMult={arrowSizeMult}
        onArrowSizeChange={setArrowSizeMult}
      />

      {/* Outer clip container */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed', top: 56, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          cursor: isConnecting ? 'crosshair' : 'grab',
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleContainerMouseDown}
        onClick={handleCanvasClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Pan + Scale content layer */}
        <div
          style={{
            width: dims.width,
            height: dims.height,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
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
              zoom={zoom}
              arrowSizeMult={arrowSizeMult}
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
                fixedEntitySize={fixedEntitySize}
                entitySizeMult={entitySizeMult}
                onConnectWithSettings={handleConnectWithSettings}
                pendingRelSettings={pendingRelSettings}
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
                Drag to pan · Scroll to zoom · Right-click entity to connect
              </span>
            </div>
          </div>
        )}

        {/* Zoom / pan indicator */}
        {(zoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 8, padding: '4px 10px',
            fontSize: 12, color: '#64748b', pointerEvents: 'none',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span>{Math.round(zoom * 100)}%</span>
            {(panOffset.x !== 0 || panOffset.y !== 0) && (
              <button
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 11, padding: 0 }}
                onClick={(e) => { e.stopPropagation(); setPanOffset({ x: 0, y: 0 }); setZoom(1); }}
              >
                Reset view
              </button>
            )}
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
