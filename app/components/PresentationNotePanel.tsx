'use client';

import React, { useEffect, useState } from 'react';
import type { PresentationStep } from '../types';

interface Props {
  step: PresentationStep | null;
  visible: boolean;
  /** Viewport-space frame rect — used to anchor + size the panel relative to the AR frame */
  frameRect?: { left: number; width: number; bottomFromViewport: number };
}

export default function PresentationNotePanel({ step, visible, frameRect }: Props) {
  const [opacity, setOpacity] = useState(0);
  const [currentStep, setCurrentStep] = useState<PresentationStep | null>(null);

  useEffect(() => {
    if (visible && step) {
      setCurrentStep(step);
      const t = setTimeout(() => setOpacity(1), 60);
      return () => clearTimeout(t);
    } else {
      setOpacity(0);
      const t = setTimeout(() => setCurrentStep(null), 400);
      return () => clearTimeout(t);
    }
  }, [visible, step?.id]);

  if (!currentStep) return null;

  const hasMetrics = currentStep.keyMetrics && currentStep.keyMetrics.length > 0;
  const hasWhy = !!currentStep.whyItMatters;

  // Size and position relative to the AR frame when available, otherwise fall back to vw-based defaults
  const panelWidth = frameRect ? Math.min(frameRect.width * 0.88, 520) : undefined;
  const panelLeft  = frameRect ? frameRect.left + (frameRect.width - (panelWidth ?? 0)) / 2 : undefined;
  const panelBottom = frameRect ? frameRect.bottomFromViewport + 28 : 32;
  // Scale text down for narrow frames (9:16 portrait) so it fits comfortably
  const narrow = frameRect && frameRect.width < 420;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: panelBottom,
        ...(panelLeft !== undefined
          ? { left: panelLeft }
          : { left: '50%', transform: 'translateX(-50%)' }),
        width: panelWidth ?? 'min(88vw, 520px)',
        maxWidth: panelWidth ?? 520,
        background: 'linear-gradient(180deg, rgba(10,17,34,0.92) 0%, rgba(10,17,34,0.98) 100%)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: narrow ? 10 : 14,
        padding: narrow ? '12px 14px' : '18px 20px',
        zIndex: 200,
        opacity,
        transition: 'opacity 0.4s ease',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {currentStep.heading && (
        <div style={{
          fontSize: narrow ? 13 : 16, fontWeight: 700, color: '#e2e8f0',
          marginBottom: currentStep.subheading ? 2 : 8,
          lineHeight: 1.3,
        }}>
          {currentStep.heading}
        </div>
      )}
      {currentStep.subheading && (
        <div style={{
          fontSize: narrow ? 11 : 12, fontWeight: 500, color: '#60a5fa',
          marginBottom: 8, letterSpacing: 0.3,
        }}>
          {currentStep.subheading}
        </div>
      )}
      {currentStep.bodyNote && (
        <div style={{
          fontSize: narrow ? 11 : 12, color: '#94a3b8', lineHeight: 1.6,
          marginBottom: hasMetrics || hasWhy ? 10 : 0,
        }}>
          {currentStep.bodyNote}
        </div>
      )}
      {hasMetrics && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          marginBottom: hasWhy ? 10 : 0,
        }}>
          {currentStep.keyMetrics!.map((m, i) => (
            <div key={i} style={{
              padding: '3px 10px', borderRadius: 6,
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.2)',
              fontSize: 11, color: '#93c5fd', fontWeight: 500,
            }}>
              {m}
            </div>
          ))}
        </div>
      )}
      {hasWhy && (
        <div style={{
          fontSize: 11, color: '#f59e0b', fontStyle: 'italic',
          borderTop: '1px solid rgba(59,130,246,0.12)',
          paddingTop: 8, lineHeight: 1.5,
        }}>
          💡 {currentStep.whyItMatters}
        </div>
      )}
    </div>
  );
}
