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
import InvestmentPanel from './InvestmentPanel';
import MapsDialog from './MapsDialog';
import type { Entity, Relationship, ArrowStyle } from '../types';

interface MapCanvasProps {
  session: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const MAX_ZOOM = 7.5;
const ZOOM_STEP = 0.15;
// Min zoom is dynamic: 1.0 for world map (can't zoom out past 100%), 0.3 for plain
const MIN_ZOOM_WORLD = 1.0;
const MIN_ZOOM_PLAIN = 0.3;

export default function MapCanvas({ session, onSignIn, onSignOut }: MapCanvasProps) {
  const {
    currentMap, addEntity, updateEntity, deleteEntity,
    addRelationship, updateRelationship, setSelectedEntity, setConnectingFrom, connectingFromId,
    mergeCloudMaps, setCurrentMapType,
  } = useMapStore();

  // Derive showWorldMap from the current map's type (default to world for legacy maps)
  const showWorldMap = currentMap.mapType !== 'plain';
  const MIN_ZOOM = showWorldMap ? MIN_ZOOM_WORLD : MIN_ZOOM_PLAIN;

  // Keep minZoom in a ref so wheel/keyboard handlers always have the latest value
  const minZoomRef = useRef(MIN_ZOOM);
  useEffect(() => { minZoomRef.current = MIN_ZOOM; }, [MIN_ZOOM]);

  const [showMapPicker, setShowMapPicker] = useState(true);
  const [cloudMapsLoading, setCloudMapsLoading] = useState(!!session?.user?.email);

  // Warning dialog for switching world → plain (irreversible)
  const [showPlainWarning, setShowPlainWarning] = useState(false);

  useEffect(() => {
    if (!session?.user?.email) {
      setCloudMapsLoading(false);
      return;
    }
    setCloudMapsLoading(true);
    fetch('/api/maps')
      .then((r) => r.json())
      .then(({ maps }) => {
        if (!Array.isArray(maps)) return;
        const parsed = maps.map((m: { data: string }) => JSON.parse(m.data));
        mergeCloudMaps(parsed);
      })
      .catch(() => {})
      .finally(() => setCloudMapsLoading(false));
  }, [session?.user?.email]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1200, height: 800 });
  const dimsRef = useRef({ width: 1200, height: 800 });
  const [zoom, setZoom] = useState(1);
  const [fixedEntitySize, setFixedEntitySize] = useState(false);
  const [entitySizeMult, setEntitySizeMult] = useState(1);
  const [arrowSizeMult, setArrowSizeMult] = useState(1);

  // Pan state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const wasPanning = useRef(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null);

  // Refs that always hold the latest zoom/pan — used inside wheel handler
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

  // Draw-connection drag state
  const [drawingFromId, setDrawingFromId] = useState<string | null>(null);
  const drawingHandledRef = useRef(false);

  // Freehand path accumulated while drawing
  const [drawPath, setDrawPath] = useState<{ x: number; y: number }[]>([]);
  const drawPathRef = useRef<{ x: number; y: number }[]>([]);

  // Draw mode (freehand right-click-drag connections)
  const [isDrawMode, setIsDrawMode] = useState(false);

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

  // Keep refs in sync with state
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = panOffset; }, [panOffset]);

  // When switching to world map mode, enforce min zoom
  useEffect(() => {
    if (showWorldMap && zoom < MIN_ZOOM_WORLD) {
      setZoom(MIN_ZOOM_WORLD);
      zoomRef.current = MIN_ZOOM_WORLD;
    }
  }, [showWorldMap, zoom]);

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
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        dimsRef.current = { width: w, height: h };
        setDims({ width: w, height: h });
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
        setIsDrawMode(false);
        setDrawingFromId(null);
        pendingRelSettingsRef.current = null;
        setPendingRelSettings(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP)); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(minZoomRef.current, z - ZOOM_STEP)); }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(minZoomRef.current); setPanOffset({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setConnectingFrom, setSelectedEntity]);

  // Helper: normalize panOffset.x for world map wrapping
  // The "world wrap amount" in pan units = dims.width * zoom (one full world width in screen space)
  const normalizePanForWrap = useCallback((panX: number, z: number): number => {
    const worldWrap = dims.width * z;
    if (worldWrap === 0) return panX;
    let nx = panX % worldWrap;
    if (nx === 0 && panX !== 0) nx = 0; // avoid -0
    return nx;
  }, [dims.width]);

  // Clamp vertical pan: ±50% of screen at zoom=1, scales linearly with zoom
  const clampPanY = useCallback((y: number, z?: number): number => {
    const limit = (dims.height / 2) * (z ?? zoomRef.current);
    return Math.min(limit, Math.max(-limit, y));
  }, [dims.height]);

  // Mouse wheel zoom toward cursor
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

      const newZoom = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, prevZoom * delta));
      const ratio = newZoom / prevZoom;
      const rawPanY = (cy - hh) * (1 - ratio) + ratio * prevPan.y;
      const newPan = {
        x: (cx - hw) * (1 - ratio) + ratio * prevPan.x,
        y: Math.min((dimsRef.current.height / 2) * newZoom, Math.max(-(dimsRef.current.height / 2) * newZoom, rawPanY)),
      };

      // Normalize X for world map wrapping after zoom
      if (minZoomRef.current === MIN_ZOOM_WORLD) {
        newPan.x = newPan.x % (dims.width * newZoom) || 0;
      }

      zoomRef.current = newZoom;
      panRef.current = newPan;

      setZoom(newZoom);
      setPanOffset(newPan);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dims.width, normalizePanForWrap]);

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
      const pos = screenToMap(sx, sy);
      setMousePos(pos);
      if (drawingFromId) {
        setDrawPath((prev) => {
          const last = prev[prev.length - 1];
          if (last && Math.abs(pos.x - last.x) < 4 && Math.abs(pos.y - last.y) < 4) return prev;
          const next = [...prev, pos];
          drawPathRef.current = next;
          return next;
        });
      }
    },
    [screenToMap, drawingFromId]
  );

  // Pan on background drag
  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
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
          const rawY = panStartRef.current.panY + dy;
          setPanOffset({ x: panStartRef.current.panX + dx, y: clampPanY(rawY, zoomRef.current) });
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Normalize pan X for world map wrapping after drag ends (seamless, no visual jump)
        if (minZoomRef.current === MIN_ZOOM_WORLD) {
          const normalized = normalizePanForWrap(panRef.current.x, zoomRef.current);
          if (normalized !== panRef.current.x) {
            panRef.current = { ...panRef.current, x: normalized };
            setPanOffset(panRef.current);
          }
        }

        panStartRef.current = null;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [panOffset, normalizePanForWrap]
  );

  const handleCanvasClick = useCallback(() => {
    if (wasPanning.current) return;
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
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const raw = screenToMap(clientX - rect.left, clientY - rect.top);
      // Normalize x so clicks on left/right wrap-copies map back into [0, dims.width)
      const normalizedX = ((raw.x % dims.width) + dims.width) % dims.width;
      setPendingPosition({ x: normalizedX, y: raw.y });
      setPendingCountry(country);
      setEditingEntity(undefined);
      setEntityDialogOpen(true);
    },
    [isConnecting, screenToMap, dims.width]
  );

  const handleEntitySave = useCallback(
    (data: Partial<Entity>) => {
      if (editingEntity?.id) {
        const { position: _pos, ...updateData } = data;
        updateEntity(editingEntity.id, updateData);
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

  const handleConnectTo = useCallback(
    (targetId: string) => {
      if (!connectingFromId) return;
      const settings = pendingRelSettingsRef.current;
      addRelationship({
        fromEntityId: connectingFromId,
        toEntityId: targetId,
        label: settings?.label || '',
        description: settings?.description || '',
        color: settings?.color || '#10B981',
        arrowStyle: settings?.arrowStyle || 'normal',
        createdBy: 'local',
      });
      setConnectingFrom(null);
    },
    [connectingFromId, addRelationship, setConnectingFrom]
  );

  const handleCancelConnect = useCallback(() => {
    setConnectingFrom(null);
    pendingRelSettingsRef.current = null;
    setPendingRelSettings(null);
  }, [setConnectingFrom]);

  const handleStartDrawConnection = useCallback((fromId: string) => {
    const entity = currentMap.entities.find((e) => e.id === fromId);
    const start = entity?.position ?? { x: 0, y: 0 };
    const initial = [start];
    drawPathRef.current = initial;
    setDrawPath(initial);
    setDrawingFromId(fromId);
    drawingHandledRef.current = false;
  }, [currentMap.entities]);

  const handleDropConnection = useCallback((targetId: string) => {
    if (!drawingFromId || drawingFromId === targetId) return;
    drawingHandledRef.current = true;
    const path = drawPathRef.current;
    addRelationship({
      fromEntityId: drawingFromId,
      toEntityId: targetId,
      label: '',
      description: '',
      color: '#10B981',
      arrowStyle: 'normal',
      createdBy: 'local',
      drawnPath: path.length > 1 ? path : undefined,
    });
    setDrawingFromId(null);
    setDrawPath([]);
    drawPathRef.current = [];
  }, [drawingFromId, addRelationship]);

  useEffect(() => {
    const onMouseUp = () => {
      if (drawingFromId && !drawingHandledRef.current) {
        setDrawingFromId(null);
        setDrawPath([]);
        drawPathRef.current = [];
      }
      drawingHandledRef.current = false;
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [drawingFromId]);

  const handleRelSave = useCallback(
    (data: Partial<Relationship>) => {
      if (editingRel?.id) updateRelationship(editingRel.id, data);
      setEditingRel(undefined);
    },
    [editingRel, updateRelationship]
  );

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

  // Handle world map toggle — switching world→plain is irreversible (show warning)
  const handleToggleWorldMap = useCallback(() => {
    if (showWorldMap) {
      // Show confirmation before switching to plain
      setShowPlainWarning(true);
    }
    // plain→world is blocked (irreversible); toggle button is disabled in that state
  }, [showWorldMap]);

  const handleConfirmSwitchToPlain = useCallback(() => {
    setCurrentMapType('plain');
    setShowPlainWarning(false);
    // Allow zooming out below 1.0 now that we're in plain mode
    // (current zoom stays, MIN_ZOOM will update via the ref)
  }, [setCurrentMapType]);

  const renderEntities = (keyPrefix: string, offsetX: number) => (
    <>
      {currentMap.entities.filter((e) => !e.hidden).map((entity) => (
        <EntityCard
          key={`${keyPrefix}-${entity.id}`}
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
          onStartDrawConnection={handleStartDrawConnection}
          isDrawTarget={!!drawingFromId && drawingFromId !== entity.id}
          onDropConnection={handleDropConnection}
          isDrawMode={isDrawMode}
          offsetX={offsetX}
        />
      ))}
    </>
  );

  const renderRelationships = (offsetX: number) => (
    <RelationshipLayer
      entities={currentMap.entities}
      relationships={visibleRelationships}
      width={dims.width}
      height={dims.height}
      connectingFromId={connectingFromId}
      mousePos={mousePos}
      onEditRelationship={handleEditRelationship}
      zoom={zoom}
      arrowSizeMult={arrowSizeMult}
      drawingFromId={drawingFromId}
      drawPath={drawPath}
      offsetX={offsetX}
    />
  );

  const visibleRelationships = currentMap.relationships.filter((r) => {
    const from = currentMap.entities.find((e) => e.id === r.fromEntityId);
    const to = currentMap.entities.find((e) => e.id === r.toEntityId);
    return !from?.hidden && !to?.hidden;
  });

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
        onZoomReset={() => { setZoom(MIN_ZOOM); setPanOffset({ x: 0, y: 0 }); }}
        fixedEntitySize={fixedEntitySize}
        onToggleFixedEntitySize={() => setFixedEntitySize((v) => !v)}
        showWorldMap={showWorldMap}
        onToggleWorldMap={handleToggleWorldMap}
      />

      <InvestmentPanel />

      <Sidebar
        onFocusEntity={handleFocusEntity}
        onConnectWithSettings={handleConnectWithSettings}
        isConnecting={isConnecting}
        connectingFromId={connectingFromId}
        pendingRelSettings={pendingRelSettings}
        onConnectTo={handleConnectTo}
        onCancelConnect={handleCancelConnect}
        entitySizeMult={entitySizeMult}
        onEntitySizeChange={setEntitySizeMult}
        arrowSizeMult={arrowSizeMult}
        onArrowSizeChange={setArrowSizeMult}
        isDrawMode={isDrawMode}
        onToggleDrawMode={() => setIsDrawMode((v) => !v)}
      />

      {/* Outer clip container */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed', top: 56, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          cursor: isConnecting ? 'crosshair' : isDrawMode ? 'crosshair' : 'grab',
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
          {showWorldMap ? (
            <WorldMap onCountryClick={handleCountryClick} width={dims.width} height={dims.height}>
              {/* Left ghost copy */}
              {renderRelationships(-dims.width)}
              {renderEntities('L', -dims.width)}
              {/* Center (original) */}
              {renderRelationships(0)}
              {renderEntities('C', 0)}
              {/* Right ghost copy */}
              {renderRelationships(dims.width)}
              {renderEntities('R', dims.width)}
            </WorldMap>
          ) : (
            /* ── Plain background ── */
            <div style={{
              position: 'relative', width: dims.width, height: dims.height,
              background: 'radial-gradient(ellipse at 50% 40%, #0c1f3d 0%, #071224 60%, #050d1a 100%)',
            }}>
              {/* Subtle grid */}
              <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width={dims.width} height={dims.height}>
                {Array.from({ length: 24 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={dims.height * (i / 24)} x2={dims.width} y2={dims.height * (i / 24)} stroke="rgba(59,130,246,0.04)" strokeWidth={1} />
                ))}
                {Array.from({ length: 40 }, (_, i) => (
                  <line key={`v${i}`} x1={dims.width * (i / 40)} y1={0} x2={dims.width * (i / 40)} y2={dims.height} stroke="rgba(59,130,246,0.04)" strokeWidth={1} />
                ))}
              </svg>
              {renderRelationships(0)}
              {renderEntities('P', 0)}
            </div>
          )}
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
              {showWorldMap ? (
                <>Click any country to place an entity<br />or use &quot;Add Entity&quot; above</>
              ) : (
                <>Use &quot;Add Entity&quot; above to place entities</>
              )}
              <br />
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
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 11, padding: 0, pointerEvents: 'all' }}
                onClick={(e) => { e.stopPropagation(); setPanOffset({ x: 0, y: 0 }); setZoom(MIN_ZOOM); }}
              >
                Reset view
              </button>
            )}
          </div>
        )}

        {/* Draw mode hint */}
        {isDrawMode && !drawingFromId && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.5)',
            borderRadius: 10, padding: '8px 16px', color: '#c084fc',
            fontSize: 13, fontWeight: 500, pointerEvents: 'none',
            backdropFilter: 'blur(8px)', zIndex: 10,
          }}>
            ✏️ Right-click drag from an entity to draw a connection · Esc to exit
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
      <MapsDialog
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        required
        loading={cloudMapsLoading}
        session={session}
        onSignIn={onSignIn}
      />

      {/* World → Plain switch warning modal */}
      {showPlainWarning && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowPlainWarning(false)}
        >
          <div
            style={{
              background: 'rgba(15,23,42,0.98)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 16, padding: 28, maxWidth: 400, width: '90%',
              display: 'flex', flexDirection: 'column', gap: 16,
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                ⚠️
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fca5a5' }}>
                Switch to Plain Background?
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              This will switch your map to a plain canvas. <strong style={{ color: '#fca5a5' }}>This action is irreversible</strong> — you won&apos;t be able to switch back to the world map for this scenario.
              <br /><br />
              Your entities and connections will remain intact, just without the world map background.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleConfirmSwitchToPlain}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  color: '#fca5a5', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.25)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}
              >
                Yes, switch to Plain
              </button>
              <button
                onClick={() => setShowPlainWarning(false)}
                className="btn-ghost"
                style={{ flex: 1, fontSize: 13 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
