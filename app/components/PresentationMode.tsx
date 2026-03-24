'use client';

/**
 * PresentationMode orchestrator.
 * Does NOT render any UI itself — it just drives camera animation and
 * emphasis state based on the active step and play/pause state.
 *
 * The actual UI panels are:
 *   - PresentationSidebar  (left, shown by MapCanvas during edit mode)
 *   - PresentationStepEditor (right, shown by MapCanvas during edit mode)
 *   - PresentationPlayControls + PresentationNotePanel (shown during play mode)
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePresentationStore } from '../store/presentationStore';
import { useMapStore } from '../store/mapStore';
import type { PresentationStep } from '../types';

interface Props {
  onAnimateCamera: (target: { x: number; y: number; zoom: number; duration: number }) => void;
  onNoteVisible: (visible: boolean) => void;
}

export default function PresentationMode({ onAnimateCamera, onNoteVisible }: Props) {
  const {
    activePresentation, subMode, currentStepIndex,
    isPlaying, isAutoPlay,
    nextStep, pause,
    setEmphasisState,
  } = usePresentationStore();

  const { currentMap } = useMapStore();

  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = activePresentation
    ? [...activePresentation.steps].sort((a, b) => a.order - b.order)
    : [];
  const currentStep = steps[currentStepIndex] ?? null;

  const animateToStep = useCallback((step: PresentationStep) => {
    if (!step.targetEntityIds.length) return;

    const targetEntities = step.targetEntityIds
      .map((id) => currentMap.entities.find((e) => e.id === id))
      .filter(Boolean);
    if (!targetEntities.length) return;

    // Camera target: destination entity takes priority for relation steps
    let cx: number, cy: number;
    if (step.sourceEntityId && step.destinationEntityId) {
      const dest = currentMap.entities.find((e) => e.id === step.destinationEntityId);
      cx = dest?.position.x ?? targetEntities[0]!.position.x;
      cy = dest?.position.y ?? targetEntities[0]!.position.y;
    } else if (targetEntities.length === 1) {
      cx = targetEntities[0]!.position.x;
      cy = targetEntities[0]!.position.y;
    } else {
      cx = targetEntities.reduce((s, e) => s + e!.position.x, 0) / targetEntities.length;
      cy = targetEntities.reduce((s, e) => s + e!.position.y, 0) / targetEntities.length;
    }

    onAnimateCamera({ x: cx, y: cy, zoom: step.zoomLevel, duration: step.cameraMoveDuration });

    setEmphasisState({
      activeEntityIds: step.targetEntityIds,
      sourceEntityId: step.sourceEntityId,
      destinationEntityId: step.destinationEntityId,
      effect: step.emphasisEffect,
    });

    // Note appears after most of the camera move is done
    onNoteVisible(false);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(
      () => onNoteVisible(true),
      Math.max(200, step.cameraMoveDuration * 0.7)
    );
  }, [currentMap.entities, onAnimateCamera, setEmphasisState, onNoteVisible]);

  // Run step whenever step index changes, or play state changes
  useEffect(() => {
    if (subMode !== 'play' || !currentStep) return;

    animateToStep(currentStep);

    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);

    if (isPlaying && isAutoPlay) {
      const total = currentStep.cameraMoveDuration + currentStep.holdDuration;
      autoPlayTimerRef.current = setTimeout(() => {
        const s = usePresentationStore.getState();
        const sorted = s.activePresentation
          ? [...s.activePresentation.steps].sort((a, b) => a.order - b.order)
          : [];
        if (s.currentStepIndex < sorted.length - 1) {
          nextStep();
        } else {
          usePresentationStore.getState().enterEditMode();
          onNoteVisible(false);
        }
      }, total);
    }

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    };
  }, [subMode, currentStepIndex, isPlaying, isAutoPlay]);

  // Clear emphasis when leaving play mode
  useEffect(() => {
    if (subMode !== 'play') {
      setEmphasisState(null);
      onNoteVisible(false);
    }
  }, [subMode]);

  return null; // all UI is rendered by sibling components in MapCanvas
}
