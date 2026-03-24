'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePresentationStore } from '../store/presentationStore';
import { useMapStore } from '../store/mapStore';
import PresentationEditPanel from './PresentationEditPanel';
import PresentationPlayControls from './PresentationPlayControls';
import PresentationNotePanel from './PresentationNotePanel';
import PresentationStepDialog from './PresentationStepDialog';
import type { PresentationStep } from '../types';

interface Props {
  /** Current zoom/pan state from MapCanvas */
  zoom: number;
  panOffset: { x: number; y: number };
  dims: { width: number; height: number };
  /** Callbacks to control the camera from outside */
  onAnimateCamera: (target: { x: number; y: number; zoom: number; duration: number }) => void;
  onFocusEntity: (pos: { x: number; y: number }) => void;
}

export default function PresentationMode({ zoom, panOffset, dims, onAnimateCamera, onFocusEntity }: Props) {
  const {
    activePresentation, subMode, currentStepIndex,
    isPlaying, isAutoPlay,
    addStep, updateStep, enterPlayMode, exitPresentationMode,
    play, pause, nextStep, prevStep, restart, toggleAutoPlay, goToStep,
    setCameraTarget, setEmphasisState,
  } = usePresentationStore();

  const { currentMap } = useMapStore();

  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<PresentationStep | undefined>();
  const [noteVisible, setNoteVisible] = useState(false);

  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entities = currentMap.entities.filter((e) => !e.hidden).map((e) => ({
    id: e.id, name: e.name, icon: e.icon, position: e.position,
  }));

  // Get sorted steps
  const steps = activePresentation
    ? [...activePresentation.steps].sort((a, b) => a.order - b.order)
    : [];
  const currentStep = steps[currentStepIndex] ?? null;

  // Calculate viewport dimensions for the portrait phone frame
  const getViewportDims = useCallback(() => {
    if (!activePresentation) return { vpWidth: 0, vpHeight: 0 };
    const ratio = activePresentation.aspectRatio === '20:9' ? 20 / 9 : 19.5 / 9;
    // Viewport is portrait — height is the long side
    const maxHeight = dims.height - 40;
    const vpHeight = maxHeight;
    const vpWidth = vpHeight / ratio;
    return { vpWidth, vpHeight };
  }, [activePresentation, dims.height]);

  // Animate camera to a step's target
  const animateToStep = useCallback((step: PresentationStep) => {
    if (!step.targetEntityIds.length) return;

    // Calculate center of target entities
    const targetEntities = step.targetEntityIds
      .map((id) => currentMap.entities.find((e) => e.id === id))
      .filter(Boolean);

    if (targetEntities.length === 0) return;

    let cx = 0, cy = 0;

    // If relation-based, animate from source to destination
    if (step.sourceEntityId && step.destinationEntityId) {
      const dest = currentMap.entities.find((e) => e.id === step.destinationEntityId);
      if (dest) {
        cx = dest.position.x;
        cy = dest.position.y;
      }
    } else {
      // Center of all target entities
      cx = targetEntities.reduce((sum, e) => sum + e!.position.x, 0) / targetEntities.length;
      cy = targetEntities.reduce((sum, e) => sum + e!.position.y, 0) / targetEntities.length;
    }

    onAnimateCamera({
      x: cx,
      y: cy,
      zoom: step.zoomLevel,
      duration: step.cameraMoveDuration,
    });

    // Set emphasis
    setEmphasisState({
      activeEntityIds: step.targetEntityIds,
      sourceEntityId: step.sourceEntityId,
      destinationEntityId: step.destinationEntityId,
      effect: step.emphasisEffect,
    });

    // Show note after camera arrives
    setNoteVisible(false);
    const noteTimer = setTimeout(() => setNoteVisible(true), step.cameraMoveDuration * 0.7);
    return () => clearTimeout(noteTimer);
  }, [currentMap.entities, onAnimateCamera, setEmphasisState]);

  // Execute current step on change
  useEffect(() => {
    if (subMode !== 'play' || !currentStep) return;
    const cleanup = animateToStep(currentStep);

    // Auto-advance
    if (isPlaying && isAutoPlay) {
      const totalTime = currentStep.cameraMoveDuration + currentStep.holdDuration;
      autoPlayTimerRef.current = setTimeout(() => {
        const state = usePresentationStore.getState();
        if (state.currentStepIndex < steps.length - 1) {
          nextStep();
        } else {
          pause();
        }
      }, totalTime);
    }

    return () => {
      if (cleanup) cleanup();
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [subMode, currentStepIndex, isPlaying, isAutoPlay]);

  // Handle adding entity from sidebar as step
  const handleAddEntityAsStep = useCallback((entityId: string) => {
    const entity = currentMap.entities.find((e) => e.id === entityId);
    if (!entity) return;
    addStep({
      targetEntityIds: [entityId],
      zoomLevel: 2.0,
      cameraMoveDuration: 1200,
      holdDuration: 3000,
      transitionType: 'smooth',
      emphasisEffect: 'pulse',
      heading: entity.name,
      subheading: entity.subtitle || '',
      bodyNote: '',
    });
  }, [currentMap.entities, addStep]);

  const handlePreviewStep = useCallback((step: PresentationStep) => {
    animateToStep(step);
    setNoteVisible(true);
  }, [animateToStep]);

  const handleStepSave = useCallback((data: Omit<PresentationStep, 'id' | 'order'>) => {
    if (editingStep) {
      updateStep(editingStep.id, data);
    } else {
      addStep(data);
    }
    setEditingStep(undefined);
  }, [editingStep, updateStep, addStep]);

  const handlePlay = useCallback(() => {
    enterPlayMode();
    if (steps.length > 0) {
      goToStep(0);
      play();
    }
  }, [enterPlayMode, steps.length, goToStep, play]);

  if (!activePresentation || !subMode) return null;

  const { vpWidth, vpHeight } = getViewportDims();

  return (
    <>
      {/* Phone-style viewport frame overlay */}
      {subMode === 'play' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* Dimmed surround */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            // Use CSS mask to cut out the viewport rectangle
            maskImage: `linear-gradient(#000, #000)`,
            WebkitMaskImage: `linear-gradient(#000, #000)`,
            pointerEvents: 'auto',
          }} />

          {/* Viewport cutout */}
          <div style={{
            position: 'relative',
            width: vpWidth,
            height: vpHeight,
            border: '2px solid rgba(59,130,246,0.4)',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 0 80px rgba(59,130,246,0.15), 0 0 0 9999px rgba(0,0,0,0.75)',
            pointerEvents: 'none',
          }}>
            {/* Note panel inside viewport */}
            <PresentationNotePanel step={currentStep} visible={noteVisible} />
          </div>

          {/* Play controls - above the viewport */}
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, pointerEvents: 'auto', zIndex: 100 }}>
            <PresentationPlayControls
              currentStep={currentStepIndex}
              totalSteps={steps.length}
              isPlaying={isPlaying}
              isAutoPlay={isAutoPlay}
              onPlay={play}
              onPause={pause}
              onNext={nextStep}
              onPrev={prevStep}
              onRestart={restart}
              onToggleAutoPlay={toggleAutoPlay}
              onExit={exitPresentationMode}
            />
          </div>
        </div>
      )}

      {/* Edit panel (right sidebar) */}
      {subMode === 'edit' && (
        <PresentationEditPanel
          onEditStep={(step) => { setEditingStep(step); setStepDialogOpen(true); }}
          onAddStep={() => { setEditingStep(undefined); setStepDialogOpen(true); }}
          onPreviewStep={handlePreviewStep}
          onPlay={handlePlay}
          onExit={exitPresentationMode}
          onAddEntityAsStep={handleAddEntityAsStep}
        />
      )}

      {/* Step dialog */}
      <PresentationStepDialog
        isOpen={stepDialogOpen}
        onClose={() => { setStepDialogOpen(false); setEditingStep(undefined); }}
        onSave={handleStepSave}
        initialData={editingStep}
        entities={entities}
      />
    </>
  );
}
