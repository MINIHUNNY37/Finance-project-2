'use client';

import React, { useState } from 'react';
import {
  Plus, Trash2, Edit3, ChevronUp, ChevronDown, Play, Eye, X,
  GripVertical, Settings,
} from 'lucide-react';
import { usePresentationStore } from '../store/presentationStore';
import { useMapStore } from '../store/mapStore';
import type { PresentationStep, PresentationAspectRatio, PresentationBackground } from '../types';

interface Props {
  onEditStep: (step: PresentationStep) => void;
  onAddStep: () => void;
  onPreviewStep: (step: PresentationStep) => void;
  onPlay: () => void;
  onExit: () => void;
  onAddEntityAsStep: (entityId: string) => void;
}

export default function PresentationEditPanel({
  onEditStep, onAddStep, onPreviewStep, onPlay, onExit, onAddEntityAsStep,
}: Props) {
  const { activePresentation, updatePresentation, deleteStep, reorderStep } = usePresentationStore();
  const { currentMap } = useMapStore();
  const [showSettings, setShowSettings] = useState(false);

  if (!activePresentation) return null;

  const steps = [...activePresentation.steps].sort((a, b) => a.order - b.order);

  const entityName = (ids: string[]) => {
    return ids
      .map((id) => currentMap.entities.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => `${e!.icon} ${e!.name}`)
      .join(', ') || 'No target';
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 340,
      background: 'rgba(10,17,34,0.96)', borderLeft: '1px solid rgba(59,130,246,0.2)',
      display: 'flex', flexDirection: 'column', zIndex: 110,
      backdropFilter: 'blur(12px)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px', borderBottom: '1px solid rgba(59,130,246,0.15)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
            {activePresentation.title}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {steps.length} step{steps.length !== 1 ? 's' : ''} · {activePresentation.aspectRatio}
          </div>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: showSettings ? '#3b82f6' : '#64748b', padding: 4,
        }}>
          <Settings size={16} />
        </button>
        <button onClick={onExit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Settings section */}
      {showSettings && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid rgba(59,130,246,0.15)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Title
            </label>
            <input
              value={activePresentation.title}
              onChange={(e) => updatePresentation(activePresentation.id, { title: e.target.value })}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
                color: '#e2e8f0', fontSize: 13, outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Aspect Ratio
              </label>
              <select
                value={activePresentation.aspectRatio}
                onChange={(e) => updatePresentation(activePresentation.id, { aspectRatio: e.target.value as PresentationAspectRatio })}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6,
                  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none',
                }}
              >
                <option value="19.5:9">19.5:9</option>
                <option value="20:9">20:9</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Background
              </label>
              <select
                value={activePresentation.background}
                onChange={(e) => updatePresentation(activePresentation.id, { background: e.target.value as PresentationBackground })}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6,
                  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none',
                }}
              >
                <option value="world">2D World Map</option>
                <option value="plain">Plain</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Steps timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {steps.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
            No steps yet.<br />
            Click an entity in the sidebar to add it as a step, or use the button below.
          </div>
        )}
        {steps.map((step, idx) => (
          <div key={step.id} style={{
            padding: '10px 16px', borderBottom: '1px solid rgba(30,41,59,0.6)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
            transition: 'background 0.15s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{ color: '#475569', marginTop: 2, cursor: 'grab' }}>
              <GripVertical size={14} />
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#3b82f6', flexShrink: 0,
            }}>
              {idx + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#e2e8f0',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {step.heading || entityName(step.targetEntityIds)}
              </div>
              {step.subheading && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {step.subheading}
                </div>
              )}
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                {step.transitionType} · {step.zoomLevel}x · {(step.cameraMoveDuration / 1000).toFixed(1)}s → hold {(step.holdDuration / 1000).toFixed(1)}s
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
              {idx > 0 && (
                <button onClick={() => reorderStep(step.id, idx - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}>
                  <ChevronUp size={13} />
                </button>
              )}
              {idx < steps.length - 1 && (
                <button onClick={() => reorderStep(step.id, idx + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}>
                  <ChevronDown size={13} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <button onClick={() => onPreviewStep(step)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
                title="Preview step">
                <Eye size={13} />
              </button>
              <button onClick={() => onEditStep(step)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
                title="Edit step">
                <Edit3 size={13} />
              </button>
              <button onClick={() => deleteStep(step.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
                title="Delete step">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom actions */}
      <div style={{
        padding: 12, borderTop: '1px solid rgba(59,130,246,0.15)',
        display: 'flex', gap: 8,
      }}>
        <button onClick={onAddStep} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 0', borderRadius: 8,
          background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
          color: '#93c5fd', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>
          <Plus size={14} /> Add Step
        </button>
        {steps.length > 0 && (
          <button onClick={onPlay} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 0', borderRadius: 8,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#6ee7b7', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            <Play size={14} /> Play
          </button>
        )}
      </div>
    </div>
  );
}
