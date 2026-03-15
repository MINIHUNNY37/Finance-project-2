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

export default function MapCanvas({ session, onSignIn, onSignOut }: MapCanvasProps) {
  const {
    currentMap,
    addEntity,
    updateEntity,
    deleteEntity,
    updateRelationship,
    setSelectedEntity,
    setConnectingFrom,
    connectingFromId,
  } = useMapStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1200, height: 800 });

  // Entity dialog state
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | undefined>();
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | undefined>();
  const [pendingCountry, setPendingCountry] = useState<string | undefined>();

  // Relationship dialog state
  const [relDialogOpen, setRelDialogOpen] = useState(false);
  const [editingRel, setEditingRel] = useState<Relationship | undefined>();

  // Mouse position for drawing preview line
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

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedEntity(null);
    if (connectingFromId) {
      setConnectingFrom(null);
    }
  }, [setSelectedEntity, connectingFromId, setConnectingFrom]);

  // Open dialog for new entity at clicked country location
  const handleCountryClick = useCallback((country: string, x: number, y: number) => {
    if (isConnecting) return;
    setPendingPosition({ x, y });
    setPendingCountry(country);
    setEditingEntity(undefined);
    setEntityDialogOpen(true);
  }, [isConnecting]);

  const handleEntitySave = useCallback((data: Partial<Entity>) => {
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
        country: data.country || '',
        position: data.position || pendingPosition || { x: 400, y: 300 },
        folderId: undefined,
        createdBy: session?.user?.email || 'local',
      });
    }
    setEditingEntity(undefined);
    setPendingPosition(undefined);
    setPendingCountry(undefined);
  }, [editingEntity, updateEntity, addEntity, pendingPosition, session]);

  const handleEditEntity = useCallback((entity: Entity) => {
    setEditingEntity(entity);
    setEntityDialogOpen(true);
  }, []);

  const handleEditRelationship = useCallback((rel: Relationship) => {
    setEditingRel(rel);
    setRelDialogOpen(true);
  }, []);

  const handleRelSave = useCallback((data: Partial<Relationship>) => {
    if (editingRel?.id) {
      updateRelationship(editingRel.id, data);
    }
    setEditingRel(undefined);
  }, [editingRel, updateRelationship]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        onAddEntity={() => {
          setEditingEntity(undefined);
          setPendingPosition({ x: Math.floor(dims.width / 2), y: Math.floor(dims.height / 2) });
          setPendingCountry(undefined);
          setEntityDialogOpen(true);
        }}
        isConnecting={isConnecting}
        onToggleConnect={() => setConnectingFrom(isConnecting ? null : null)}
        session={session}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
      />

      <Sidebar />

      {/* Main canvas */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          cursor: isConnecting ? 'crosshair' : 'default',
        }}
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick}
      >
        <WorldMap
          onCountryClick={handleCountryClick}
          width={dims.width}
          height={dims.height}
        >
          {/* Relationship arrows (SVG layer) */}
          <RelationshipLayer
            entities={currentMap.entities}
            relationships={currentMap.relationships}
            width={dims.width}
            height={dims.height}
            connectingFromId={connectingFromId}
            mousePos={mousePos}
            onEditRelationship={handleEditRelationship}
          />

          {/* Entity cards */}
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
            />
          ))}
        </WorldMap>

        {/* Empty state hint */}
        {currentMap.entities.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗺️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(147,197,253,0.8)', marginBottom: 8 }}>
              Start Building Your Scenario Map
            </div>
            <div style={{ fontSize: 13, color: 'rgba(100,116,139,0.8)', lineHeight: 1.6 }}>
              Click on any country to place an entity<br />
              or use the &quot;Add Entity&quot; button above
            </div>
          </div>
        )}

        {/* Connecting mode hint */}
        {isConnecting && (
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(6,182,212,0.15)',
              border: '1px solid rgba(6,182,212,0.5)',
              borderRadius: 10,
              padding: '8px 16px',
              color: '#06b6d4',
              fontSize: 13,
              fontWeight: 500,
              pointerEvents: 'none',
              backdropFilter: 'blur(8px)',
              zIndex: 10,
            }}
          >
            🔗 Click another entity to create a connection · Press Escape to cancel
          </div>
        )}
      </div>

      {/* Dialogs */}
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
