'use client';

import React from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Play, Eye, X,
  ArrowRight, Presentation,
} from 'lucide-react';
import { usePresentationStore } from '../store/presentationStore';
import { useMapStore } from '../store/mapStore';
import type { PresentationAspectRatio, PresentationBackground } from '../types';

interface Props {
  /** Called when user clicks "play" */
  onPlay: () => void;
  /** Animate camera to this entity for preview */
  onPreviewStep: (stepId: string) => void;
  /** Width of this panel (passed back so MapCanvas can offset canvas) */
  width: number;
}

export default function PresentationSidebar({ onPlay, onPreviewStep, width }: Props) {
  const {
    activePresentation, subMode,
    updatePresentation, deleteStep, reorderStep, addStep,
    selectStep, selectedStepId,
    exitPresentationMode,
  } = usePresentationStore();
  const { currentMap } = useMapStore();

  if (!activePresentation || subMode !== 'edit') return null;

  const steps = [...activePresentation.steps].sort((a, b) => a.order - b.order);

  const entityLabel = (id: string) => {
    const e = currentMap.entities.find((e) => e.id === id);
    return e ? `${e.icon} ${e.name}` : '—';
  };

  const relationLabel = (fromId: string, toId: string) => {
    return currentMap.relationships.find(
      (r) => r.fromEntityId === fromId && r.toEntityId === toId
    );
  };

  // Quick-add entity as new step
  const handleAddEntityStep = (entityId: string) => {
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
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 7,
    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
    color: '#e2e8f0', fontSize: 13, outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', top: 68, left: 0, bottom: 0, width,
      background: 'rgba(10,17,34,0.97)',
      borderRight: '1px solid rgba(59,130,246,0.2)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      backdropFilter: 'blur(12px)',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 14px 10px',
        borderBottom: '1px solid rgba(59,130,246,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Presentation size={14} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activePresentation.title}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {steps.length} step{steps.length !== 1 ? 's' : ''} · {activePresentation.aspectRatio === '16:9' ? 'PPT' : 'Short Form'}
            </div>
          </div>
          <button onClick={exitPresentationMode} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, flexShrink: 0 }} title="Exit Presentation Mode">
            <X size={14} />
          </button>
        </div>

        {/* Settings — always shown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(59,130,246,0.1)' }}>
          <input
            value={activePresentation.title}
            onChange={(e) => updatePresentation(activePresentation.id, { title: e.target.value })}
            placeholder="Presentation title"
            style={input}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Aspect ratio toggle */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Format</div>
              <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(59,130,246,0.2)' }}>
                {([['16:9', 'PPT (16:9)'], ['9:16', 'Short (9:16)']] as [PresentationAspectRatio, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => updatePresentation(activePresentation.id, { aspectRatio: val })}
                    style={{
                      flex: 1, padding: '5px 4px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: activePresentation.aspectRatio === val ? 'rgba(59,130,246,0.25)' : 'transparent',
                      color: activePresentation.aspectRatio === val ? '#93c5fd' : '#64748b',
                      transition: 'all 0.15s',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Background toggle */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Background</div>
              <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(59,130,246,0.2)' }}>
                {([['world', 'World'], ['plain', 'Plain']] as [PresentationBackground, string][]).map(([val, label]) => (
                  <button key={val} onClick={() => updatePresentation(activePresentation.id, { background: val })}
                    style={{
                      flex: 1, padding: '5px 4px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: activePresentation.background === val ? 'rgba(59,130,246,0.25)' : 'transparent',
                      color: activePresentation.background === val ? '#93c5fd' : '#64748b',
                      transition: 'all 0.15s',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Step list ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {steps.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: '#475569', fontSize: 13, lineHeight: 1.7 }}>
            No steps yet.<br />
            Click any entity below or use&nbsp;<strong style={{ color: '#93c5fd' }}>+ Add Step</strong>.
          </div>
        ) : steps.map((step, idx) => {
          const isSelected = selectedStepId === step.id;
          const hasRelation = step.sourceEntityId && step.destinationEntityId;
          const rel = hasRelation ? relationLabel(step.sourceEntityId!, step.destinationEntityId!) : null;

          return (
            <div
              key={step.id}
              onClick={() => selectStep(isSelected ? null : step.id)}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid rgba(30,41,59,0.7)',
                display: 'flex', alignItems: 'flex-start', gap: 8,
                cursor: 'pointer',
                background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                borderLeft: `3px solid ${isSelected ? '#3b82f6' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.05)'; }}
              onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {/* Step number badge */}
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: isSelected ? 'rgba(59,130,246,0.3)' : 'rgba(30,41,59,0.8)',
                border: `1px solid ${isSelected ? 'rgba(59,130,246,0.6)' : 'rgba(51,65,85,0.5)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: isSelected ? '#93c5fd' : '#64748b',
                flexShrink: 0, marginTop: 1,
              }}>
                {idx + 1}
              </div>

              {/* Step content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Entity labels */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
                  {step.targetEntityIds.slice(0, 2).map((id) => (
                    <span key={id} style={{
                      fontSize: 13, fontWeight: 600,
                      color: isSelected ? '#e2e8f0' : '#cbd5e1',
                      whiteSpace: 'nowrap',
                    }}>
                      {entityLabel(id)}
                    </span>
                  ))}
                  {step.targetEntityIds.length > 2 && (
                    <span style={{ fontSize: 12, color: '#64748b' }}>+{step.targetEntityIds.length - 2}</span>
                  )}
                </div>

                {/* Relation info */}
                {hasRelation && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                      {entityLabel(step.sourceEntityId!)}
                    </span>
                    <ArrowRight size={10} style={{ color: rel?.color || '#3b82f6', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                      {entityLabel(step.destinationEntityId!)}
                    </span>
                    {rel?.label && (
                      <span style={{
                        fontSize: 11, padding: '1px 5px', borderRadius: 4,
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                        color: '#60a5fa', whiteSpace: 'nowrap',
                      }}>{rel.label}</span>
                    )}
                  </div>
                )}

                {/* Heading */}
                {step.heading && (
                  <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    "{step.heading}"
                  </div>
                )}

                {/* Duration chips */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                    color: '#6ee7b7',
                  }}>
                    {step.zoomLevel.toFixed(1)}x
                  </span>
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                    color: '#a5b4fc',
                  }}>
                    {(step.cameraMoveDuration / 1000).toFixed(1)}s move
                  </span>
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                    color: '#fcd34d',
                  }}>
                    {(step.holdDuration / 1000).toFixed(1)}s hold
                  </span>
                  {step.emphasisEffect !== 'none' && (
                    <span style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 4,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#fca5a5',
                    }}>
                      {step.emphasisEffect}
                    </span>
                  )}
                </div>
              </div>

              {/* Step actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button onClick={(e) => { e.stopPropagation(); onPreviewStep(step.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px 3px' }} title="Preview">
                  <Eye size={12} />
                </button>
                {idx > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); reorderStep(step.id, idx - 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px 3px' }}>
                    <ChevronUp size={12} />
                  </button>
                )}
                {idx < steps.length - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); reorderStep(step.id, idx + 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px 3px' }}>
                    <ChevronDown size={12} />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); deleteStep(step.id); if (selectedStepId === step.id) selectStep(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px 3px' }} title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {/* ── Entity quick-add section ── */}
        {currentMap.entities.filter((e) => !e.hidden).length > 0 && (
          <div style={{ padding: '12px 12px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Quick-add entity as step
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {currentMap.entities.filter((e) => !e.hidden).map((e) => (
                <button key={e.id} onClick={() => handleAddEntityStep(e.id)} style={{
                  padding: '3px 8px', borderRadius: 5, fontSize: 13,
                  background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(51,65,85,0.5)',
                  color: '#94a3b8', cursor: 'pointer', transition: 'all 0.15s',
                }}
                  onMouseEnter={(el) => { (el.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.4)'; (el.currentTarget as HTMLElement).style.color = '#93c5fd'; }}
                  onMouseLeave={(el) => { (el.currentTarget as HTMLElement).style.borderColor = 'rgba(51,65,85,0.5)'; (el.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                  title={`Add "${e.name}" as step`}
                >
                  {e.icon} {e.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(59,130,246,0.15)', display: 'flex', gap: 8 }}>
        <button onClick={() => {
          // Add blank step
          addStep({
            targetEntityIds: [],
            zoomLevel: 2.0,
            cameraMoveDuration: 1200,
            holdDuration: 3000,
            transitionType: 'smooth',
            emphasisEffect: 'pulse',
            heading: '',
            subheading: '',
            bodyNote: '',
          });
        }} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '8px 0', borderRadius: 7,
          background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
          color: '#93c5fd', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          <Plus size={13} /> Add Step
        </button>
        {steps.length > 0 && (
          <button onClick={onPlay} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '8px 0', borderRadius: 7,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#6ee7b7', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <Play size={13} /> Play
          </button>
        )}
      </div>
    </div>
  );
}
