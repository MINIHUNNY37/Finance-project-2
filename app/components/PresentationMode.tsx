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
  const phase2TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    if (phase2TimerRef.current) clearTimeout(phase2TimerRef.current);

    setEmphasisState({
      activeEntityIds: step.targetEntityIds,
      sourceEntityId: step.sourceEntityId,
      destinationEntityId: step.destinationEntityId,
      effect: step.emphasisEffect,
    });

    // For relation steps: two-phase camera — follow the stream source → destination
    if (step.sourceEntityId && step.destinationEntityId) {
      const src = currentMap.entities.find((e) => e.id === step.sourceEntityId);
      const dest = currentMap.entities.find((e) => e.id === step.destinationEntityId);
      if (src && dest) {
        const phase1Dur = Math.round(step.cameraMoveDuration * 0.38);
        const phase2Dur = step.cameraMoveDuration - phase1Dur;
        // Phase 1: pan to source entity
        onAnimateCamera({ x: src.position.x, y: src.position.y, zoom: step.zoomLevel, duration: phase1Dur });
        // Phase 2: after phase1, animate to destination
        phase2TimerRef.current = setTimeout(() => {
          onAnimateCamera({ x: dest.position.x, y: dest.position.y, zoom: step.zoomLevel, duration: phase2Dur });
        }, phase1Dur);
        // Note appears during phase 2
        onNoteVisible(false);
        if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
        noteTimerRef.current = setTimeout(
          () => onNoteVisible(true),
          Math.max(200, phase1Dur + phase2Dur * 0.7)
        );
        return;
      }
    }

    // Single or multi-entity step: animate directly to center
    let cx: number, cy: number;
    if (targetEntities.length === 1) {
      cx = targetEntities[0]!.position.x;
      cy = targetEntities[0]!.position.y;
    } else {
      cx = targetEntities.reduce((s, e) => s + e!.position.x, 0) / targetEntities.length;
      cy = targetEntities.reduce((s, e) => s + e!.position.y, 0) / targetEntities.length;
    }

    onAnimateCamera({ x: cx, y: cy, zoom: step.zoomLevel, duration: step.cameraMoveDuration });

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
          pause();
          onNoteVisible(true); // keep note visible at end
        }
      }, total);
    }

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
      if (phase2TimerRef.current) clearTimeout(phase2TimerRef.current);
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
