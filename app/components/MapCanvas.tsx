'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import WorldMap, { type HighlightedCountry } from './WorldMap';
import EntityCard from './EntityCard';
import RelationshipLayer from './RelationshipLayer';
import EntityDialog from './EntityDialog';
import StockFlashcard from './StockFlashcard';
import RelationshipDialog from './RelationshipDialog';
import GeoEventNode from './GeoEventNode';
import GeoEventDialog from './GeoEventDialog';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import InvestmentPanel from './InvestmentPanel';
import MapsDialog from './MapsDialog';
import PresentationMode from './PresentationMode';
import PresentationSidebar from './PresentationSidebar';
import PresentationStepEditor from './PresentationStepEditor';
import PresentationPlayControls from './PresentationPlayControls';
import PresentationNotePanel from './PresentationNotePanel';
import { usePresentationStore } from '../store/presentationStore';
import type { Entity, Relationship, ArrowStyle, GeoEvent } from '../types';

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
    mergeCloudMaps, setCurrentMapType, addGeoEvent, updateGeoEvent,
  } = useMapStore();

  // Derive showWorldMap from the current map's type (default to world for legacy maps)
  const showWorldMap = currentMap.mapType !== 'plain';
  const MIN_ZOOM = showWorldMap ? MIN_ZOOM_WORLD : MIN_ZOOM_PLAIN;

  // Keep minZoom in a ref so wheel/keyboard handlers always have the latest value
  const minZoomRef = useRef(MIN_ZOOM);
  useEffect(() => { minZoomRef.current = MIN_ZOOM; }, [MIN_ZOOM]);

  const [showMapPicker, setShowMapPicker] = useState(true);
  const [cloudMapsLoading, setCloudMapsLoading] = useState(!!session?.user?.email);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [investmentPanelWidth, setInvestmentPanelWidth] = useState(44);

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

  // Stock flashcard (opens instead of EntityDialog for stock entities)
  const [flashcardEntity, setFlashcardEntity] = useState<Entity | null>(null);

  // Relationship dialog
  const [relDialogOpen, setRelDialogOpen] = useState(false);
  const [editingRel, setEditingRel] = useState<Relationship | undefined>();

  // Geo event dialog + selection
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [editingGeoEvent, setEditingGeoEvent] = useState<GeoEvent | undefined>();
  const [pendingGeoPosition, setPendingGeoPosition] = useState<{ x: number; y: number } | undefined>();
  const [selectedGeoEventId, setSelectedGeoEventId] = useState<string | null>(null);

  const handleGeoEventSelect = useCallback((id: string | null) => {
    setSelectedGeoEventId(id);
    if (id) {
      useMapStore.getState().setSelectedEntity(null);
      useMapStore.getState().setSelectedRelationship(null);
    }
  }, []);

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

  // Presentation store
  const presentationSubMode = usePresentationStore((s) => s.subMode);
  const emphasisState = usePresentationStore((s) => s.emphasisState);
  const activePresentation = usePresentationStore((s) => s.activePresentation);
  const presentationStore = usePresentationStore();
  const [presentationNoteVisible, setPresentationNoteVisible] = useState(false);
  const [presentationControlsVisible, setPresentationControlsVisible] = useState(true);
  const [presLeftOpen, setPresLeftOpen] = useState(true);
  const [presRightOpen, setPresRightOpen] = useState(true);
  // Visible container dimensions (used only for the aspect-ratio frame overlay)
  const [containerVisualDims, setContainerVisualDims] = useState({ width: 1200, height: 800 });
  const presentationSubModeRef = useRef(presentationSubMode);
  useEffect(() => { presentationSubModeRef.current = presentationSubMode; }, [presentationSubMode]);
  // Show controls when entering play mode
  useEffect(() => {
    if (presentationSubMode === 'play') setPresentationControlsVisible(true);
  }, [presentationSubMode]);
  // Exit presentation if active presentation belongs to a different map
  useEffect(() => {
    if (activePresentation && activePresentation.mapId !== currentMap.id) {
      presentationStore.exitPresentationMode();
    }
  }, [currentMap.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sidebar width: during presentation edit mode, the left panel is 320px
  const PRESENTATION_SIDEBAR_W = 320;
  const PRESENTATION_PROPS_W = 300;

  // Track container's visual size (separate from dims/coordinate-space) for the AR frame
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setContainerVisualDims({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Keep refs in sync with state
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = panOffset; }, [panOffset]);

  // Smooth camera animation (used by PresentationMode)
  const animationRef = useRef<number | null>(null);
  const handleAnimateCamera = useCallback(
    (target: { x: number; y: number; zoom: number; duration: number }) => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      const startPan = { ...panRef.current };
      const startZoom = zoomRef.current;
      const startTime = performance.now();

      const targetPan = {
        x: target.zoom * (dimsRef.current.width / 2 - target.x),
        y: target.zoom * (dimsRef.current.height / 2 - target.y),
      };

      const easeInOutCubic = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / target.duration);
        const eased = easeInOutCubic(progress);

        const newZoom = startZoom + (target.zoom - startZoom) * eased;
        const newPan = {
          x: startPan.x + (targetPan.x - startPan.x) * eased,
          y: startPan.y + (targetPan.y - startPan.y) * eased,
        };

        zoomRef.current = newZoom;
        panRef.current = newPan;
        setZoom(newZoom);
        setPanOffset(newPan);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    },
    []
  );

  // Clean up animation on unmount
  useEffect(() => {
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

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
      // Presentation arrow-key navigation (play mode)
      if (presentationSubModeRef.current === 'play') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const s = usePresentationStore.getState();
          const total = s.activePresentation?.steps.length ?? 0;
          if (total === 0) return;
          if (s.currentStepIndex < total - 1) s.nextStep();
          else s.goToStep(0);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const s = usePresentationStore.getState();
          const total = s.activePresentation?.steps.length ?? 0;
          if (total === 0) return;
          if (s.currentStepIndex > 0) s.prevStep();
          else s.goToStep(total - 1);
          return;
        }
      }
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
    if (presentationSubModeRef.current === 'play') {
      setPresentationControlsVisible((v) => !v);
      return;
    }
    setSelectedEntity(null);
    setSelectedGeoEventId(null);
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
    // Stock entities (imported from library) open the educational flashcard
    if (entity.entityKind === 'stock' && entity.ticker) {
      setFlashcardEntity(entity);
      return;
    }
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

  const renderGeoEvents = () => (
    <>
      {(currentMap.geoEvents ?? []).map((ev) => (
        <GeoEventNode
          key={ev.id}
          event={ev}
          onEdit={(e) => { setEditingGeoEvent(e); setGeoDialogOpen(true); }}
          mapWidth={dims.width}
          mapHeight={dims.height}
          zoom={zoom}
          selected={selectedGeoEventId === ev.id}
          onSelect={handleGeoEventSelect}
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
      emphasisState={emphasisState}
    />
  );

  const visibleRelationships = currentMap.relationships.filter((r) => {
    if (r.hidden) return false;
    const from = currentMap.entities.find((e) => e.id === r.fromEntityId);
    const to = currentMap.entities.find((e) => e.id === r.toEntityId);
    return !from?.hidden && !to?.hidden;
  });

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Toolbar
        isConnecting={isConnecting}
        onToggleConnect={() => {
          setConnectingFrom(null);
          pendingRelSettingsRef.current = null;
          setPendingRelSettings(null);
        }}
        session={session}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        showWorldMap={showWorldMap}
        onToggleWorldMap={handleToggleWorldMap}
      />

      {/* Right panel: Investment OR Presentation Step Editor */}
      {presentationSubMode === 'edit' ? (
        <>
          {presRightOpen && <PresentationStepEditor />}
          {/* Right sidebar collapse/expand toggle */}
          <button
            onClick={() => setPresRightOpen((v) => !v)}
            title={presRightOpen ? 'Collapse step editor' : 'Expand step editor'}
            style={{
              position: 'fixed', top: '50%', right: presRightOpen ? PRESENTATION_PROPS_W : 0,
              transform: 'translateY(-50%)',
              zIndex: 55, background: 'rgba(10,17,34,0.9)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRight: presRightOpen ? '1px solid rgba(59,130,246,0.25)' : 'none',
              borderRadius: presRightOpen ? '6px 0 0 6px' : '0 6px 6px 0',
              color: '#64748b', cursor: 'pointer',
              padding: '8px 4px', display: 'flex', alignItems: 'center',
              transition: 'right 0.2s ease',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#93c5fd')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
          >
            {presRightOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </>
      ) : presentationSubMode !== 'play' ? (
        <InvestmentPanel onWidthChange={setInvestmentPanelWidth} />
      ) : null}

      {/* Left panel: normal Sidebar OR Presentation Sidebar */}
      {presentationSubMode === 'edit' ? (
        <>
          {presLeftOpen && (
            <PresentationSidebar
              width={PRESENTATION_SIDEBAR_W}
              onPlay={() => {
                presentationStore.enterPlayMode();
                if (presentationStore.activePresentation?.steps.length) {
                  presentationStore.goToStep(0);
                  presentationStore.play();
                }
              }}
              onPreviewStep={(stepId) => {
                const step = presentationStore.activePresentation?.steps.find((s) => s.id === stepId);
                if (!step?.targetEntityIds.length) return;
                const ents = step.targetEntityIds.map((id) => currentMap.entities.find((e) => e.id === id)).filter(Boolean);
                if (!ents.length) return;
                const cx = ents.reduce((s, e) => s + e!.position.x, 0) / ents.length;
                const cy = ents.reduce((s, e) => s + e!.position.y, 0) / ents.length;
                handleAnimateCamera({ x: cx, y: cy, zoom: step.zoomLevel, duration: step.cameraMoveDuration });
              }}
            />
          )}
          {/* Left sidebar collapse/expand toggle */}
          <button
            onClick={() => setPresLeftOpen((v) => !v)}
            title={presLeftOpen ? 'Collapse presentation sidebar' : 'Expand presentation sidebar'}
            style={{
              position: 'fixed', top: '50%', left: presLeftOpen ? PRESENTATION_SIDEBAR_W : 0,
              transform: 'translateY(-50%)',
              zIndex: 55, background: 'rgba(10,17,34,0.9)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderLeft: presLeftOpen ? '1px solid rgba(59,130,246,0.25)' : 'none',
              borderRadius: presLeftOpen ? '0 6px 6px 0' : '6px 0 0 6px',
              color: '#64748b', cursor: 'pointer',
              padding: '8px 4px', display: 'flex', alignItems: 'center',
              transition: 'left 0.2s ease',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#93c5fd')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
          >
            {presLeftOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </>
      ) : presentationSubMode !== 'play' ? (
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
          onWidthChange={setSidebarWidth}
        />
      ) : null}

      {/* Outer clip container */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed', top: 68,
          left: presentationSubMode === 'edit' ? (presLeftOpen ? PRESENTATION_SIDEBAR_W : 0) : 0,
          right: presentationSubMode === 'edit' ? (presRightOpen ? PRESENTATION_PROPS_W : 0) : 0,
          bottom: 0,
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
            <WorldMap
              onCountryClick={handleCountryClick}
              width={dims.width}
              height={dims.height}
              highlightedCountries={(currentMap.geoEvents ?? []).flatMap((ev): HighlightedCountry[] => {
                const c = ev.highlightColor ?? 'yellow';
                const COLORS: Record<string, [string, string]> = {
                  yellow: ['rgba(251,191,36,0.45)',  'rgba(251,191,36,0.85)'],
                  purple: ['rgba(168,85,247,0.45)',  'rgba(168,85,247,0.85)'],
                  red:    ['rgba(239,68,68,0.45)',   'rgba(239,68,68,0.85)'],
                  blue:   ['rgba(59,130,246,0.45)',  'rgba(59,130,246,0.85)'],
                };
                const [fill, stroke] = COLORS[c] ?? COLORS.yellow;
                return (ev.countries ?? []).map((name) => ({ name, fillColor: fill, strokeColor: stroke }));
              })}
            >
              {/* Left ghost copy */}
              {renderRelationships(-dims.width)}
              {renderEntities('L', -dims.width)}
              {/* Center (original) */}
              {renderRelationships(0)}
              {renderEntities('C', 0)}
              {/* Right ghost copy */}
              {renderRelationships(dims.width)}
              {renderEntities('R', dims.width)}
              {renderGeoEvents()}
            </WorldMap>
          ) : (
            /* ── Plain background ── */
            (() => {
              const themeMap = {
                forest: { bg: 'radial-gradient(ellipse at 50% 40%, #0a1e0f 0%, #051209 60%, #020b05 100%)', grid: 'rgba(34,197,94,0.05)' },
                aurora: { bg: 'radial-gradient(ellipse at 50% 40%, #1a0a2e 0%, #0d0520 60%, #040110 100%)', grid: 'rgba(168,85,247,0.05)' },
                slate:  { bg: 'radial-gradient(ellipse at 50% 40%, #111827 0%, #0b1120 60%, #060d18 100%)', grid: 'rgba(148,163,184,0.04)' },
                dark:   { bg: 'radial-gradient(ellipse at 50% 40%, #0c1f3d 0%, #071224 60%, #050d1a 100%)', grid: 'rgba(59,130,246,0.04)' },
              };
              const t = themeMap[(currentMap.theme ?? 'dark') as keyof typeof themeMap] ?? themeMap.dark;
              return (
            <div style={{
              position: 'relative', width: dims.width, height: dims.height,
              background: t.bg,
            }}>
              {/* Subtle grid */}
              <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width={dims.width} height={dims.height}>
                {Array.from({ length: 24 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={dims.height * (i / 24)} x2={dims.width} y2={dims.height * (i / 24)} stroke={t.grid} strokeWidth={1} />
                ))}
                {Array.from({ length: 40 }, (_, i) => (
                  <line key={`v${i}`} x1={dims.width * (i / 40)} y1={0} x2={dims.width * (i / 40)} y2={dims.height} stroke={t.grid} strokeWidth={1} />
                ))}
              </svg>
              {renderRelationships(0)}
              {renderEntities('P', 0)}
              {renderGeoEvents()}
            </div>
              );
            })()
          )}
        </div>

        {/* ── Aspect-ratio frame overlay (edit + play) ── */}
        {presentationSubMode && activePresentation && (() => {
          const [arW, arH] = activePresentation.aspectRatio === '9:16' ? [9, 16] : [16, 9];
          const cW = containerVisualDims.width;
          const cH = containerVisualDims.height;
          const byH = cH * arW / arH;
          const frameW = byH <= cW ? byH : cW;
          const frameH = byH <= cW ? cH : cW * arH / arW;
          const frameLeft = (cW - frameW) / 2;
          const frameTop = (cH - frameH) / 2;
          const isPlay = presentationSubMode === 'play';
          return (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 180 }}>
              {isPlay && frameTop > 0 && <>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: frameTop, background: 'rgba(0,0,0,0.72)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: frameTop, background: 'rgba(0,0,0,0.72)' }} />
              </>}
              {isPlay && frameLeft > 0 && <>
                <div style={{ position: 'absolute', top: frameTop, bottom: frameTop, left: 0, width: frameLeft, background: 'rgba(0,0,0,0.72)' }} />
                <div style={{ position: 'absolute', top: frameTop, bottom: frameTop, right: 0, width: frameLeft, background: 'rgba(0,0,0,0.72)' }} />
              </>}
              <div style={{
                position: 'absolute',
                left: frameLeft, top: frameTop, width: frameW, height: frameH,
                border: isPlay
                  ? '2px solid rgba(59,130,246,0.6)'
                  : '1.5px dashed rgba(59,130,246,0.45)',
                borderRadius: 2,
                boxShadow: isPlay ? '0 0 0 1px rgba(59,130,246,0.15)' : 'none',
                pointerEvents: 'none',
              }} />
            </div>
          );
        })()}

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

        {/* Bottom-left: Add Entity + Geo Event — hidden during presentation mode */}
        <div style={{
          position: 'absolute', bottom: 24,
          left: presentationSubMode ? 16 : sidebarWidth + 16,
          display: presentationSubMode ? 'none' : 'flex',
          flexDirection: 'column', gap: 8,
          zIndex: 20, pointerEvents: 'all',
          transition: 'left 0.2s ease',
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingEntity(undefined);
              const pos = screenToMap(dims.width / 2, dims.height / 2);
              setPendingPosition(pos);
              setPendingCountry(undefined);
              setEntityDialogOpen(true);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
              borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(59,130,246,0.85)', border: '1px solid rgba(59,130,246,0.6)',
              color: 'white', boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
              backdropFilter: 'blur(8px)', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.85)'; }}
          >
            <Plus size={15} /> Add Entity
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingGeoEvent(undefined);
              const pos = screenToMap(dims.width / 2, dims.height / 2);
              setPendingGeoPosition(pos);
              setGeoDialogOpen(true);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
              borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(239,68,68,0.75)', border: '1px solid rgba(239,68,68,0.5)',
              color: 'white', boxShadow: '0 4px 16px rgba(239,68,68,0.25)',
              backdropFilter: 'blur(8px)', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.95)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.75)'; }}
          >
            🌍 Geo Event
          </button>
        </div>

        {/* Bottom-right: Zoom controls */}
        <div style={{
          position: 'absolute', bottom: 24, right: investmentPanelWidth + 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          background: 'rgba(10,17,34,0.88)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 10, padding: '4px', zIndex: 20, pointerEvents: 'all',
          backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'right 0.2s ease',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP)); }}
            title="Zoom in (Ctrl +)"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
              padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center',
              transition: 'color 0.12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setZoom(MIN_ZOOM); setPanOffset({ x: 0, y: 0 }); }}
            title="Reset zoom (Ctrl 0)"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: zoom !== MIN_ZOOM ? '#3b82f6' : '#64748b',
              fontSize: 12, fontWeight: 600, padding: '3px 8px',
              borderRadius: 6, minWidth: 44, textAlign: 'center',
              borderTop: '1px solid rgba(59,130,246,0.12)',
              borderBottom: '1px solid rgba(59,130,246,0.12)',
              transition: 'color 0.12s',
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP)); }}
            title="Zoom out (Ctrl –)"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
              padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center',
              transition: 'color 0.12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
          >
            <ZoomOut size={16} />
          </button>
        </div>

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
      {flashcardEntity && flashcardEntity.ticker && (
        <StockFlashcard
          ticker={flashcardEntity.ticker}
          entityName={flashcardEntity.name}
          entitySector={flashcardEntity.sector ?? null}
          onClose={() => setFlashcardEntity(null)}
        />
      )}
      <RelationshipDialog
        isOpen={relDialogOpen}
        onClose={() => { setRelDialogOpen(false); setEditingRel(undefined); }}
        onSave={handleRelSave}
        initialData={editingRel}
      />
      <GeoEventDialog
        isOpen={geoDialogOpen}
        onClose={() => { setGeoDialogOpen(false); setEditingGeoEvent(undefined); setPendingGeoPosition(undefined); }}
        onSave={(data) => {
          if (editingGeoEvent?.id) {
            updateGeoEvent(editingGeoEvent.id, data);
          } else {
            addGeoEvent(data);
          }
        }}
        initialData={editingGeoEvent}
        defaultPosition={pendingGeoPosition}
      />
      {/* Presentation Mode — logic only (no overlay) */}
      <PresentationMode
        onAnimateCamera={handleAnimateCamera}
        onNoteVisible={setPresentationNoteVisible}
      />

      {/* Presentation play controls — shown during play mode, toggled by map click */}
      {presentationSubMode === 'play' && (
        <div style={{ position: 'fixed', top: 68, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 200, pointerEvents: 'none' }}>
          <div style={{
            pointerEvents: presentationControlsVisible ? 'auto' : 'none',
            opacity: presentationControlsVisible ? 1 : 0,
            transform: presentationControlsVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}>
            <PresentationPlayControls
              currentStep={presentationStore.currentStepIndex}
              totalSteps={presentationStore.activePresentation ? [...presentationStore.activePresentation.steps].length : 0}
              isPlaying={presentationStore.isPlaying}
              isAutoPlay={presentationStore.isAutoPlay}
              onPlay={presentationStore.play}
              onPause={presentationStore.pause}
              onNext={presentationStore.nextStep}
              onPrev={presentationStore.prevStep}
              onRestart={presentationStore.restart}
              onToggleAutoPlay={presentationStore.toggleAutoPlay}
              onExit={() => { presentationStore.exitPresentationMode(); setPresentationNoteVisible(false); }}
              onEdit={() => { presentationStore.enterEditMode(); setPresentationNoteVisible(false); }}
            />
          </div>
        </div>
      )}
      {/* Hint when controls are hidden */}
      {presentationSubMode === 'play' && !presentationControlsVisible && (
        <div style={{
          position: 'fixed', top: 78, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(148,163,184,0.3)', fontSize: 11, pointerEvents: 'none', zIndex: 199,
          letterSpacing: '0.05em',
        }}>
          click map to show controls
        </div>
      )}

      {/* Note panel — shown during play mode, sized to the AR frame */}
      {presentationSubMode === 'play' && presentationStore.activePresentation && (() => {
        const steps = [...presentationStore.activePresentation.steps].sort((a, b) => a.order - b.order);
        const step = steps[presentationStore.currentStepIndex] ?? null;
        // Compute frame rect in viewport space (play mode: container starts at top:68, left:0)
        const ar = presentationStore.activePresentation.aspectRatio;
        const [arW, arH] = ar === '9:16' ? [9, 16] : [16, 9];
        const cW = containerVisualDims.width;
        const cH = containerVisualDims.height;
        const byH = cH * arW / arH;
        const frameW = byH <= cW ? byH : cW;
        const frameH = byH <= cW ? cH : cW * arH / arW;
        const frameLeft = (cW - frameW) / 2;           // from left edge of container
        const frameTop  = (cH - frameH) / 2;           // from top edge of container
        // "bottomFromViewport" = distance from the bottom of the viewport to the bottom of the frame
        const frameBottomFromViewport = window.innerHeight - (68 + frameTop + frameH);
        const frameRect = { left: frameLeft, width: frameW, bottomFromViewport: Math.max(0, frameBottomFromViewport) };
        return <PresentationNotePanel step={step} visible={presentationNoteVisible} frameRect={frameRect} />;
      })()}

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
