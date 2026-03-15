'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, Relationship, Folder, ScenarioMap } from '../types';

interface MapState {
  currentMap: ScenarioMap;
  savedMaps: ScenarioMap[];
  selectedEntityId: string | null;
  selectedRelationshipId: string | null;
  connectingFromId: string | null; // entity id we're drawing connection from
  hoveredEntityId: string | null;

  // Entity actions
  addEntity: (entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  deleteEntity: (id: string) => void;
  moveEntity: (id: string, position: { x: number; y: number }) => void;

  // Relationship actions
  addRelationship: (rel: Omit<Relationship, 'id' | 'createdAt'>) => void;
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  deleteRelationship: (id: string) => void;

  // Folder actions
  addFolder: (folder: Omit<Folder, 'id' | 'createdAt'>) => string;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  addEntityToFolder: (entityId: string, folderId: string) => void;
  removeEntityFromFolder: (entityId: string, folderId: string) => void;

  // Map actions
  saveCurrentMap: () => void;
  loadMap: (id: string) => void;
  createNewMap: (name: string, description: string) => void;
  deleteMap: (id: string) => void;
  generateShareToken: () => string;

  // UI state
  setSelectedEntity: (id: string | null) => void;
  setSelectedRelationship: (id: string | null) => void;
  setConnectingFrom: (id: string | null) => void;
  setHoveredEntity: (id: string | null) => void;
}

const createDefaultMap = (): ScenarioMap => ({
  id: uuidv4(),
  name: 'My Stock Scenario Map',
  description: 'A visual map of company operations and investment scenarios',
  entities: [],
  relationships: [],
  folders: [],
  ownerId: 'local',
  sharedWith: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      currentMap: createDefaultMap(),
      savedMaps: [],
      selectedEntityId: null,
      selectedRelationshipId: null,
      connectingFromId: null,
      hoveredEntityId: null,

      addEntity: (entityData) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        const entity: Entity = {
          ...entityData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: [...state.currentMap.entities, entity],
            updatedAt: now,
          },
        }));
        return id;
      },

      updateEntity: (id, updates) => {
        const now = new Date().toISOString();
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: state.currentMap.entities.map((e) =>
              e.id === id ? { ...e, ...updates, updatedAt: now } : e
            ),
            updatedAt: now,
          },
        }));
      },

      deleteEntity: (id) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: state.currentMap.entities.filter((e) => e.id !== id),
            relationships: state.currentMap.relationships.filter(
              (r) => r.fromEntityId !== id && r.toEntityId !== id
            ),
            folders: state.currentMap.folders.map((f) => ({
              ...f,
              entityIds: f.entityIds.filter((eid) => eid !== id),
            })),
          },
          selectedEntityId: state.selectedEntityId === id ? null : state.selectedEntityId,
        }));
      },

      moveEntity: (id, position) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: state.currentMap.entities.map((e) =>
              e.id === id ? { ...e, position, updatedAt: new Date().toISOString() } : e
            ),
          },
        }));
      },

      addRelationship: (relData) => {
        const now = new Date().toISOString();
        const relationship: Relationship = {
          ...relData,
          id: uuidv4(),
          createdAt: now,
        };
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            relationships: [...state.currentMap.relationships, relationship],
            updatedAt: now,
          },
        }));
      },

      updateRelationship: (id, updates) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            relationships: state.currentMap.relationships.map((r) =>
              r.id === id ? { ...r, ...updates } : r
            ),
          },
        }));
      },

      deleteRelationship: (id) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            relationships: state.currentMap.relationships.filter((r) => r.id !== id),
          },
          selectedRelationshipId:
            state.selectedRelationshipId === id ? null : state.selectedRelationshipId,
        }));
      },

      addFolder: (folderData) => {
        const id = uuidv4();
        const folder: Folder = {
          ...folderData,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            folders: [...state.currentMap.folders, folder],
          },
        }));
        return id;
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            folders: state.currentMap.folders.map((f) =>
              f.id === id ? { ...f, ...updates } : f
            ),
          },
        }));
      },

      deleteFolder: (id) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            folders: state.currentMap.folders.filter((f) => f.id !== id),
            entities: state.currentMap.entities.map((e) =>
              e.folderId === id ? { ...e, folderId: undefined } : e
            ),
          },
        }));
      },

      addEntityToFolder: (entityId, folderId) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: state.currentMap.entities.map((e) =>
              e.id === entityId ? { ...e, folderId } : e
            ),
            folders: state.currentMap.folders.map((f) =>
              f.id === folderId
                ? { ...f, entityIds: [...new Set([...f.entityIds, entityId])] }
                : f
            ),
          },
        }));
      },

      removeEntityFromFolder: (entityId, folderId) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: state.currentMap.entities.map((e) =>
              e.id === entityId ? { ...e, folderId: undefined } : e
            ),
            folders: state.currentMap.folders.map((f) =>
              f.id === folderId
                ? { ...f, entityIds: f.entityIds.filter((id) => id !== entityId) }
                : f
            ),
          },
        }));
      },

      saveCurrentMap: () => {
        const { currentMap, savedMaps } = get();
        const now = new Date().toISOString();
        const updated = { ...currentMap, updatedAt: now };
        const exists = savedMaps.find((m) => m.id === currentMap.id);
        set({
          currentMap: updated,
          savedMaps: exists
            ? savedMaps.map((m) => (m.id === currentMap.id ? updated : m))
            : [...savedMaps, updated],
        });
      },

      loadMap: (id) => {
        const { savedMaps } = get();
        const map = savedMaps.find((m) => m.id === id);
        if (map) set({ currentMap: map, selectedEntityId: null, selectedRelationshipId: null });
      },

      createNewMap: (name, description) => {
        const { saveCurrentMap } = get();
        saveCurrentMap();
        set({
          currentMap: { ...createDefaultMap(), name, description },
          selectedEntityId: null,
          selectedRelationshipId: null,
        });
      },

      deleteMap: (id) => {
        set((state) => ({
          savedMaps: state.savedMaps.filter((m) => m.id !== id),
        }));
      },

      generateShareToken: () => {
        const token = uuidv4();
        set((state) => ({
          currentMap: { ...state.currentMap, shareToken: token },
        }));
        return token;
      },

      setSelectedEntity: (id) =>
        set({ selectedEntityId: id, selectedRelationshipId: null }),
      setSelectedRelationship: (id) =>
        set({ selectedRelationshipId: id, selectedEntityId: null }),
      setConnectingFrom: (id) => set({ connectingFromId: id }),
      setHoveredEntity: (id) => set({ hoveredEntityId: id }),
    }),
    {
      name: 'stock-scenario-mapper',
    }
  )
);
