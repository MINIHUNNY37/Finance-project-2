'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, Relationship, Folder, ScenarioMap, GeoEvent, GeoEventType } from '../types';

interface MapState {
  currentMap: ScenarioMap;
  savedMaps: ScenarioMap[];
  selectedEntityId: string | null;
  selectedRelationshipId: string | null;
  connectingFromId: string | null;
  hoveredEntityId: string | null;
  globalLocked: boolean;
  customStatPresets: string[];
  customDetailPresets: string[];
  worldClockTimezones: string[];
  globalViewDate: string | null; // ISO date string or null = "today"
  investmentPlan: {
    balance: number;
    allocations: { entityId: string; amount: number }[];
    notes: string;
  };

  // Custom preset actions
  addCustomStatPreset: (name: string) => void;
  removeCustomStatPreset: (name: string) => void;
  addCustomDetailPreset: (name: string) => void;
  removeCustomDetailPreset: (name: string) => void;
  setWorldClockTimezones: (zones: string[]) => void;
  setGlobalViewDate: (date: string | null) => void;
  updateInvestmentPlan: (updates: Partial<{ balance: number; allocations: { entityId: string; amount: number }[]; notes: string }>) => void;

  // Entity actions
  addEntity: (entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  deleteEntity: (id: string) => void;
  moveEntity: (id: string, position: { x: number; y: number }) => void;
  toggleEntityLock: (id: string) => void;
  toggleEntityFixedSize: (id: string) => void;
  toggleEntityHidden: (id: string) => void;
  toggleGlobalLock: () => void;

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

  // GeoEvent actions
  addGeoEvent: (event: Omit<GeoEvent, 'id' | 'createdAt'>) => string;
  updateGeoEvent: (id: string, updates: Partial<GeoEvent>) => void;
  deleteGeoEvent: (id: string) => void;
  moveGeoEvent: (id: string, position: { x: number; y: number }) => void;

  // Map actions
  saveCurrentMap: () => void;
  loadMap: (id: string) => void;
  createNewMap: (name: string, description: string, mapType?: 'world' | 'plain') => void;
  deleteMap: (id: string) => void;
  generateShareToken: () => string;
  mergeCloudMaps: (cloudMaps: ScenarioMap[]) => void;
  importMapFromCode: (code: string) => boolean;
  setCurrentMapType: (type: 'world' | 'plain') => void;

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
  geoEvents: [],
  ownerId: 'local',
  sharedWith: [],
  mapType: 'world',
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
      globalLocked: false,
      customStatPresets: [],
      customDetailPresets: [],
      worldClockTimezones: ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Hong_Kong'],
      globalViewDate: null,
      investmentPlan: { balance: 0, allocations: [], notes: '' },

      addCustomStatPreset: (name) => set((s) => ({
        customStatPresets: [...new Set([...s.customStatPresets, name.trim()])].filter(Boolean),
      })),
      removeCustomStatPreset: (name) => set((s) => ({
        customStatPresets: s.customStatPresets.filter((p) => p !== name),
      })),
      addCustomDetailPreset: (name) => set((s) => ({
        customDetailPresets: [...new Set([...s.customDetailPresets, name.trim()])].filter(Boolean),
      })),
      removeCustomDetailPreset: (name) => set((s) => ({
        customDetailPresets: s.customDetailPresets.filter((p) => p !== name),
      })),
      setWorldClockTimezones: (zones) => set({ worldClockTimezones: zones }),
      setGlobalViewDate: (date) => set({ globalViewDate: date }),
      updateInvestmentPlan: (updates) => set((s) => ({ investmentPlan: { ...s.investmentPlan, ...updates } })),

      addEntity: (entityData) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        // Default fixedSize to true so new entities always appear at constant screen size
        const entity: Entity = { fixedSize: true, ...entityData, id, createdAt: now, updatedAt: now };
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

      toggleEntityLock: (id) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: state.currentMap.entities.map((e) =>
              e.id === id ? { ...e, locked: !e.locked } : e
            ),
          },
        }));
      },

      toggleEntityFixedSize: (id) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: state.currentMap.entities.map((e) =>
              e.id === id ? { ...e, fixedSize: !e.fixedSize } : e
            ),
          },
        }));
      },

      toggleEntityHidden: (id) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            entities: state.currentMap.entities.map((e) =>
              e.id === id ? { ...e, hidden: !e.hidden } : e
            ),
          },
        }));
      },

      toggleGlobalLock: () => {
        set((state) => ({ globalLocked: !state.globalLocked }));
      },

      addRelationship: (relData) => {
        const now = new Date().toISOString();
        const relationship: Relationship = { ...relData, id: uuidv4(), createdAt: now };
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
        const folder: Folder = { ...folderData, id, createdAt: new Date().toISOString() };
        set((state) => ({
          currentMap: { ...state.currentMap, folders: [...state.currentMap.folders, folder] },
        }));
        return id;
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            folders: state.currentMap.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
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

      addGeoEvent: (eventData) => {
        const id = uuidv4();
        const event: GeoEvent = { ...eventData, id, createdAt: new Date().toISOString() };
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            geoEvents: [...(state.currentMap.geoEvents ?? []), event],
          },
        }));
        return id;
      },
      updateGeoEvent: (id, updates) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            geoEvents: (state.currentMap.geoEvents ?? []).map((e) =>
              e.id === id ? { ...e, ...updates } : e
            ),
          },
        }));
      },
      deleteGeoEvent: (id) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            geoEvents: (state.currentMap.geoEvents ?? []).filter((e) => e.id !== id),
          },
        }));
      },
      moveGeoEvent: (id, position) => {
        set((state) => ({
          currentMap: {
            ...state.currentMap,
            geoEvents: (state.currentMap.geoEvents ?? []).map((e) =>
              e.id === id ? { ...e, position } : e
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

      createNewMap: (name, description, mapType = 'world') => {
        const { saveCurrentMap } = get();
        saveCurrentMap();
        set({
          currentMap: { ...createDefaultMap(), name, description, mapType },
          selectedEntityId: null,
          selectedRelationshipId: null,
        });
      },

      deleteMap: (id) => {
        set((state) => ({ savedMaps: state.savedMaps.filter((m) => m.id !== id) }));
      },

      generateShareToken: () => {
        const token = uuidv4();
        set((state) => ({ currentMap: { ...state.currentMap, shareToken: token } }));
        return token;
      },

      mergeCloudMaps: (cloudMaps) => {
        set((state) => {
          const merged = [...state.savedMaps];
          for (const cloud of cloudMaps) {
            const idx = merged.findIndex((m) => m.id === cloud.id);
            if (idx >= 0) {
              merged[idx] = cloud;
            } else {
              merged.push(cloud);
            }
          }
          return { savedMaps: merged };
        });
      },

      setCurrentMapType: (type) => {
        const now = new Date().toISOString();
        set((state) => ({
          currentMap: { ...state.currentMap, mapType: type, updatedAt: now },
        }));
      },

      importMapFromCode: (code) => {
        try {
          const json = decodeURIComponent(atob(code.trim()));
          const map = JSON.parse(json) as ScenarioMap;
          if (!map.id || !Array.isArray(map.entities) || !Array.isArray(map.relationships)) return false;
          const { saveCurrentMap } = get();
          saveCurrentMap();
          const newMap: ScenarioMap = {
            ...map,
            id: uuidv4(),
            name: `${map.name} (imported)`,
            shareToken: undefined,
            ownerId: 'local',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set({ currentMap: newMap, selectedEntityId: null, selectedRelationshipId: null });
          return true;
        } catch {
          return false;
        }
      },

      setSelectedEntity: (id) => set({ selectedEntityId: id, selectedRelationshipId: null }),
      setSelectedRelationship: (id) => set({ selectedRelationshipId: id, selectedEntityId: null }),
      setConnectingFrom: (id) => set({ connectingFromId: id }),
      setHoveredEntity: (id) => set({ hoveredEntityId: id }),
    }),
    { name: 'stock-scenario-mapper' }
  )
);
