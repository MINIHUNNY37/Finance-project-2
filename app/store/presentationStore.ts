'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Presentation,
  PresentationStep,
  PresentationAspectRatio,
  PresentationBackground,
  PresentationTransition,
  EmphasisEffect,
} from '../types';

export type PresentationSubMode = 'edit' | 'play' | null;

interface PresentationState {
  // All saved presentations (keyed by map id)
  presentations: Presentation[];

  // Active presentation
  activePresentation: Presentation | null;
  subMode: PresentationSubMode;

  // Play state
  currentStepIndex: number;
  isPlaying: boolean;
  isAutoPlay: boolean;

  // Camera animation target (consumed by MapCanvas)
  cameraTarget: {
    x: number;
    y: number;
    zoom: number;
    duration: number;
    transition: PresentationTransition;
  } | null;

  // Emphasis state (consumed by RelationshipLayer)
  emphasisState: {
    activeEntityIds: string[];
    sourceEntityId?: string;
    destinationEntityId?: string;
    effect: EmphasisEffect;
  } | null;

  // Actions — presentation CRUD
  createPresentation: (mapId: string, title: string, background: PresentationBackground, aspectRatio: PresentationAspectRatio) => string;
  updatePresentation: (id: string, updates: Partial<Pick<Presentation, 'title' | 'background' | 'aspectRatio'>>) => void;
  deletePresentation: (id: string) => void;
  loadPresentation: (id: string) => void;
  getPresentationsForMap: (mapId: string) => Presentation[];

  // Actions — steps
  addStep: (step: Omit<PresentationStep, 'id' | 'order'>) => void;
  updateStep: (stepId: string, updates: Partial<PresentationStep>) => void;
  deleteStep: (stepId: string) => void;
  reorderStep: (stepId: string, newOrder: number) => void;

  // Actions — mode
  enterEditMode: (presentationId?: string) => void;
  enterPlayMode: () => void;
  exitPresentationMode: () => void;

  // Actions — playback
  play: () => void;
  pause: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  restart: () => void;
  toggleAutoPlay: () => void;

  // Actions — camera / emphasis (called internally during playback)
  setCameraTarget: (target: PresentationState['cameraTarget']) => void;
  setEmphasisState: (state: PresentationState['emphasisState']) => void;
  clearCameraTarget: () => void;
}

const createDefaultStep = (order: number, targetEntityIds: string[]): PresentationStep => ({
  id: uuidv4(),
  order,
  targetEntityIds,
  zoomLevel: 2.0,
  cameraMoveDuration: 1200,
  holdDuration: 3000,
  transitionType: 'smooth',
  emphasisEffect: 'pulse',
  heading: '',
  subheading: '',
  bodyNote: '',
});

export const usePresentationStore = create<PresentationState>()(
  persist(
    (set, get) => ({
      presentations: [],
      activePresentation: null,
      subMode: null,
      currentStepIndex: 0,
      isPlaying: false,
      isAutoPlay: true,
      cameraTarget: null,
      emphasisState: null,

      createPresentation: (mapId, title, background, aspectRatio) => {
        const id = uuidv4();
        const now = new Date().toISOString();
        const presentation: Presentation = {
          id,
          title,
          mapId,
          background,
          aspectRatio,
          steps: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ presentations: [...s.presentations, presentation] }));
        return id;
      },

      updatePresentation: (id, updates) => {
        const now = new Date().toISOString();
        set((s) => ({
          presentations: s.presentations.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: now } : p
          ),
          activePresentation:
            s.activePresentation?.id === id
              ? { ...s.activePresentation, ...updates, updatedAt: now }
              : s.activePresentation,
        }));
      },

      deletePresentation: (id) => {
        set((s) => ({
          presentations: s.presentations.filter((p) => p.id !== id),
          activePresentation: s.activePresentation?.id === id ? null : s.activePresentation,
          subMode: s.activePresentation?.id === id ? null : s.subMode,
        }));
      },

      loadPresentation: (id) => {
        const p = get().presentations.find((p) => p.id === id);
        if (p) set({ activePresentation: { ...p }, currentStepIndex: 0 });
      },

      getPresentationsForMap: (mapId) => {
        return get().presentations.filter((p) => p.mapId === mapId);
      },

      // Steps
      addStep: (stepData) => {
        const { activePresentation } = get();
        if (!activePresentation) return;
        const order = activePresentation.steps.length;
        const step: PresentationStep = { ...stepData, id: uuidv4(), order };
        const now = new Date().toISOString();
        const updated = {
          ...activePresentation,
          steps: [...activePresentation.steps, step],
          updatedAt: now,
        };
        set((s) => ({
          activePresentation: updated,
          presentations: s.presentations.map((p) => (p.id === updated.id ? updated : p)),
        }));
      },

      updateStep: (stepId, updates) => {
        const { activePresentation } = get();
        if (!activePresentation) return;
        const now = new Date().toISOString();
        const updated = {
          ...activePresentation,
          steps: activePresentation.steps.map((s) =>
            s.id === stepId ? { ...s, ...updates } : s
          ),
          updatedAt: now,
        };
        set((s) => ({
          activePresentation: updated,
          presentations: s.presentations.map((p) => (p.id === updated.id ? updated : p)),
        }));
      },

      deleteStep: (stepId) => {
        const { activePresentation } = get();
        if (!activePresentation) return;
        const now = new Date().toISOString();
        const filtered = activePresentation.steps
          .filter((s) => s.id !== stepId)
          .map((s, i) => ({ ...s, order: i }));
        const updated = { ...activePresentation, steps: filtered, updatedAt: now };
        set((s) => ({
          activePresentation: updated,
          presentations: s.presentations.map((p) => (p.id === updated.id ? updated : p)),
        }));
      },

      reorderStep: (stepId, newOrder) => {
        const { activePresentation } = get();
        if (!activePresentation) return;
        const steps = [...activePresentation.steps].sort((a, b) => a.order - b.order);
        const idx = steps.findIndex((s) => s.id === stepId);
        if (idx < 0) return;
        const [moved] = steps.splice(idx, 1);
        steps.splice(newOrder, 0, moved);
        const reordered = steps.map((s, i) => ({ ...s, order: i }));
        const now = new Date().toISOString();
        const updated = { ...activePresentation, steps: reordered, updatedAt: now };
        set((s) => ({
          activePresentation: updated,
          presentations: s.presentations.map((p) => (p.id === updated.id ? updated : p)),
        }));
      },

      // Mode
      enterEditMode: (presentationId) => {
        if (presentationId) get().loadPresentation(presentationId);
        set({ subMode: 'edit', isPlaying: false, currentStepIndex: 0, cameraTarget: null, emphasisState: null });
      },

      enterPlayMode: () => {
        set({ subMode: 'play', currentStepIndex: 0, isPlaying: false });
      },

      exitPresentationMode: () => {
        set({
          subMode: null,
          isPlaying: false,
          currentStepIndex: 0,
          cameraTarget: null,
          emphasisState: null,
        });
      },

      // Playback
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),

      nextStep: () => {
        const { activePresentation, currentStepIndex } = get();
        if (!activePresentation) return;
        const max = activePresentation.steps.length - 1;
        if (currentStepIndex < max) set({ currentStepIndex: currentStepIndex + 1 });
      },

      prevStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) set({ currentStepIndex: currentStepIndex - 1 });
      },

      goToStep: (index) => {
        const { activePresentation } = get();
        if (!activePresentation) return;
        if (index >= 0 && index < activePresentation.steps.length) {
          set({ currentStepIndex: index });
        }
      },

      restart: () => set({ currentStepIndex: 0, isPlaying: false }),

      toggleAutoPlay: () => set((s) => ({ isAutoPlay: !s.isAutoPlay })),

      setCameraTarget: (target) => set({ cameraTarget: target }),
      setEmphasisState: (state) => set({ emphasisState: state }),
      clearCameraTarget: () => set({ cameraTarget: null }),
    }),
    { name: 'presentation-store' }
  )
);
