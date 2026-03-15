'use client';

import React, { useState } from 'react';
import {
  Layers, FolderOpen, Info, ChevronLeft, ChevronRight, Trash2,
  GitMerge, Link2, Zap, Minus, X, Eye, EyeOff, ArrowRight,
} from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import { isVisibleAtDate } from '../utils/dateFilter';
import FolderPanel from './FolderPanel';
import type { ArrowStyle } from '../types';
import { RELATIONSHIP_COLORS } from '../types';

type Tab = 'entities' | 'connections' | 'folders' | 'info';

interface RelSettings {
  label: string;
  description: string;
  color: string;
  arrowStyle: ArrowStyle;
}

interface SidebarProps {
  onFocusEntity: (pos: { x: number; y: number }) => void;
  onConnectWithSettings: (fromId: string, settings: RelSettings) => void;
  isConnecting: boolean;
  connectingFromId: string | null;
  pendingRelSettings: RelSettings | null;
  onConnectTo: (targetId: string) => void;
  onCancelConnect: () => void;
  entitySizeMult: number;
  onEntitySizeChange: (v: number) => void;
  arrowSizeMult: number;
  onArrowSizeChange: (v: number) => void;
}

export default function Sidebar({
  onFocusEntity,
  onConnectWithSettings,
  isConnecting,
  connectingFromId,
  pendingRelSettings,
  onConnectTo,
  onCancelConnect,
  entitySizeMult,
  onEntitySizeChange,
  arrowSizeMult,
  onArrowSizeChange,
}: SidebarProps) {
  const {
    currentMap, selectedEntityId, setSelectedEntity, setConnectingFrom,
    deleteEntity, deleteRelationship, setSelectedRelationship, selectedRelationshipId,
    toggleEntityHidden, globalViewDate,
  } = useMapStore();

  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('entities');

  // Inline "connect with settings" panel state
  const [showRelPanel, setShowRelPanel] = useState(false);
  const [relLabel, setRelLabel] = useState('');
  const [relDesc, setRelDesc] = useState('');
  const [relColor, setRelColor] = useState(RELATIONSHIP_COLORS[0]);
  const [relArrowStyle, setRelArrowStyle] = useState<ArrowStyle>('normal');

  const selectedEntity = selectedEntityId
    ? currentMap.entities.find((e) => e.id === selectedEntityId)
    : null;

  const connectingFromEntity = connectingFromId
    ? currentMap.entities.find((e) => e.id === connectingFromId)
    : null;

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'entities', icon: <Layers size={13} />, label: 'Entities' },
    { id: 'connections', icon: <ArrowRight size={13} />, label: 'Connections' },
    { id: 'folders', icon: <FolderOpen size={13} />, label: 'Folders' },
    { id: 'info', icon: <Info size={13} />, label: 'Selected' },
  ];

  const handleOpenRelPanel = () => {
    setRelLabel('');
    setRelDesc('');
    setRelColor(RELATIONSHIP_COLORS[0]);
    setRelArrowStyle('normal');
    setShowRelPanel(true);
  };

  const handleRelPanelSave = () => {
    if (!selectedEntity) return;
    setShowRelPanel(false);
    onConnectWithSettings(selectedEntity.id, {
      label: relLabel.trim(),
      description: relDesc.trim(),
      color: relColor,
      arrowStyle: relArrowStyle,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 56,
        bottom: 0,
        width: collapsed ? 44 : 260,
        background: 'rgba(15,23,42,0.96)',
        borderRight: '1px solid rgba(59,130,246,0.15)',
        backdropFilter: 'blur(12px)',
        transition: 'width 0.2s ease',
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute', right: -14, top: 16,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(15,23,42,0.96)',
          border: '1px solid rgba(59,130,246,0.3)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#64748b', zIndex: 1, transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {collapsed ? (
        <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setCollapsed(false); setActiveTab(tab.id); }}
              title={tab.label}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: 'none', cursor: 'pointer',
                color: activeTab === tab.id ? '#3b82f6' : '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* ── Connect mode entity picker overlay ── */}
          {isConnecting && connectingFromId && (
            <div className="fade-in" style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'rgba(10,17,34,0.98)',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Header */}
              <div style={{
                padding: '14px 14px 10px',
                borderBottom: '1px solid rgba(59,130,246,0.15)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                      {pendingRelSettings ? 'Connect with Settings' : 'Connect To'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      From:{' '}
                      <span style={{ color: connectingFromEntity?.color || '#e2e8f0', fontWeight: 600 }}>
                        {connectingFromEntity?.icon} {connectingFromEntity?.name}
                      </span>
                    </div>
                    {pendingRelSettings?.label && (
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                        Label: <span style={{ color: pendingRelSettings.color }}>{pendingRelSettings.label}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onCancelConnect}
                    title="Cancel connect"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Entity list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, paddingLeft: 2 }}>
                  Pick a target entity
                </div>
                {currentMap.entities
                  .filter((e) => e.id !== connectingFromId && !e.hidden)
                  .map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => onConnectTo(entity.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                        marginBottom: 3, textAlign: 'left',
                        background: 'rgba(59,130,246,0.04)',
                        border: `1px solid rgba(59,130,246,0.12)`,
                        transition: 'all 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = `${entity.color}18`;
                        (e.currentTarget as HTMLElement).style.borderColor = `${entity.color}55`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.04)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.12)';
                      }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: entity.color + '22', border: `1px solid ${entity.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                      }}>
                        {entity.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: entity.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entity.name}
                        </div>
                        {entity.subtitle && (
                          <div style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entity.subtitle}
                          </div>
                        )}
                      </div>
                      <ArrowRight size={12} style={{ color: '#475569', flexShrink: 0 }} />
                    </button>
                  ))}
                {currentMap.entities.filter((e) => e.id !== connectingFromId && !e.hidden).length === 0 && (
                  <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '20px 8px' }}>
                    No other entities available
                  </div>
                )}
              </div>

              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(59,130,246,0.1)', flexShrink: 0 }}>
                <button
                  onClick={onCancelConnect}
                  style={{
                    width: '100%', padding: '7px 0', borderRadius: 8,
                    background: 'transparent', border: '1px solid rgba(59,130,246,0.2)',
                    color: '#64748b', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(59,130,246,0.12)', paddingTop: 10, overflowX: 'hidden' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowRelPanel(false); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 3, padding: '6px 2px', background: 'none', border: 'none',
                  borderBottom: `2px solid ${activeTab === tab.id ? '#3b82f6' : 'transparent'}`,
                  color: activeTab === tab.id ? '#3b82f6' : '#475569',
                  cursor: 'pointer', fontSize: 10, fontWeight: 500, transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>

            {/* ── ENTITIES TAB ── */}
            {activeTab === 'entities' && (
              <div>
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 4 }}>
                  All Entities ({currentMap.entities.length})
                </div>
                {currentMap.entities.length === 0 ? (
                  <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
                    Click &quot;Add Entity&quot; to place a company on the map
                  </div>
                ) : (
                  currentMap.entities.map((entity) => (
                    <div
                      key={entity.id}
                      onClick={() => {
                        setSelectedEntity(entity.id);
                        onFocusEntity(entity.position);
                        setActiveTab('info');
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 8px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                        background: selectedEntityId === entity.id ? `${entity.color}18` : 'transparent',
                        border: `1px solid ${selectedEntityId === entity.id ? entity.color + '44' : 'transparent'}`,
                        opacity: entity.hidden ? 0.4 : 1,
                        transition: 'all 0.1s ease',
                      }}
                      onMouseEnter={(e) => { if (selectedEntityId !== entity.id) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)'; }}
                      onMouseLeave={(e) => { if (selectedEntityId !== entity.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: entity.color + '22', border: `1px solid ${entity.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0,
                      }}>
                        {entity.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entity.name}
                        </div>
                        {entity.country && (
                          <div style={{ fontSize: 10, color: '#475569' }}>{entity.country}</div>
                        )}
                      </div>
                      {/* Hide/show toggle */}
                      <button
                        title={entity.hidden ? 'Show entity' : 'Hide entity'}
                        onClick={(e) => { e.stopPropagation(); toggleEntityHidden(entity.id); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: entity.hidden ? '#64748b' : '#475569',
                          padding: '2px 4px', borderRadius: 4,
                          display: 'flex', alignItems: 'center', flexShrink: 0,
                          opacity: entity.hidden ? 1 : 0.5, transition: 'opacity 0.1s',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = entity.hidden ? '1' : '0.5')}
                      >
                        {entity.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      {/* Delete / color dot */}
                      {selectedEntityId === entity.id ? (
                        <button
                          title="Delete entity"
                          onClick={(e) => { e.stopPropagation(); deleteEntity(entity.id); setSelectedEntity(null); }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#ef4444', padding: '2px 4px', borderRadius: 4,
                            display: 'flex', alignItems: 'center', flexShrink: 0,
                            opacity: 0.7, transition: 'opacity 0.1s',
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: entity.color, flexShrink: 0 }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── CONNECTIONS TAB ── */}
            {activeTab === 'connections' && (
              <div>
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 4 }}>
                  All Connections ({currentMap.relationships.length})
                </div>
                {currentMap.relationships.length === 0 ? (
                  <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
                    Select two entities and use Connect to create a connection
                  </div>
                ) : (
                  currentMap.relationships.map((rel) => {
                    const from = currentMap.entities.find((e) => e.id === rel.fromEntityId);
                    const to = currentMap.entities.find((e) => e.id === rel.toEntityId);
                    if (!from || !to) return null;
                    const isSelected = selectedRelationshipId === rel.id;
                    return (
                      <div
                        key={rel.id}
                        onClick={() => setSelectedRelationship(rel.id)}
                        style={{
                          padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                          background: isSelected ? `${rel.color}12` : 'rgba(15,23,42,0.5)',
                          border: `1px solid ${isSelected ? rel.color + '55' : 'rgba(59,130,246,0.1)'}`,
                          transition: 'all 0.1s ease',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)'; }}
                        onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.5)'; }}
                      >
                        {/* From → To row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{from.icon}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: from.color,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
                          }}>
                            {from.name}
                          </span>
                          <span style={{ flexShrink: 0, color: rel.color, fontSize: 13 }}>→</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: to.color,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textAlign: 'right',
                          }}>
                            {to.name}
                          </span>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{to.icon}</span>
                        </div>
                        {/* Meta row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: rel.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: '#64748b' }}>
                              {rel.label || <span style={{ opacity: 0.5 }}>no label</span>}
                            </span>
                            {rel.arrowStyle === 'animated' && (
                              <Zap size={10} style={{ color: rel.color, opacity: 0.7, flexShrink: 0 }} />
                            )}
                          </div>
                          <button
                            title="Delete connection"
                            onClick={(e) => { e.stopPropagation(); deleteRelationship(rel.id); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#ef4444', padding: '1px 3px', borderRadius: 4,
                              display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.1s',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.6')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        {rel.description && (
                          <div style={{
                            marginTop: 4, fontSize: 10, color: '#64748b', lineHeight: 1.3,
                            borderLeft: `2px solid ${rel.color}44`, paddingLeft: 6,
                          }}>
                            {rel.description}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── FOLDERS TAB ── */}
            {activeTab === 'folders' && <FolderPanel />}

            {/* ── SELECTED TAB ── */}
            {activeTab === 'info' && (
              <div>
                {selectedEntity ? (
                  <div className="fade-in">
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: selectedEntity.color + '22',
                        border: `2px solid ${selectedEntity.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, flexShrink: 0,
                      }}>
                        {selectedEntity.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedEntity.name}
                        </div>
                        {selectedEntity.subtitle && (
                          <div style={{ fontSize: 11, color: selectedEntity.color }}>{selectedEntity.subtitle}</div>
                        )}
                      </div>
                      <button
                        title="Delete entity"
                        onClick={() => { deleteEntity(selectedEntity.id); setSelectedEntity(null); }}
                        style={{
                          background: 'none', border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: 6, cursor: 'pointer', color: '#ef4444',
                          padding: '4px 6px', display: 'flex', alignItems: 'center',
                          flexShrink: 0, opacity: 0.75, transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; el.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.75'; el.style.background = 'none'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Action buttons */}
                    {!showRelPanel && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                        <button
                          onClick={() => setConnectingFrom(selectedEntity.id)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11,
                            background: 'transparent', border: '1px solid rgba(6,182,212,0.35)',
                            color: '#06b6d4', transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(6,182,212,0.1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <Link2 size={12} /> Connect
                        </button>
                        <button
                          onClick={handleOpenRelPanel}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11,
                            background: 'transparent', border: '1px solid rgba(167,139,250,0.35)',
                            color: '#a78bfa', transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <GitMerge size={12} /> With Settings
                        </button>
                      </div>
                    )}

                    {/* Inline rel settings panel */}
                    {showRelPanel && (
                      <div className="fade-in" style={{
                        marginBottom: 14, padding: 12, borderRadius: 10,
                        background: 'rgba(167,139,250,0.06)',
                        border: '1px solid rgba(167,139,250,0.3)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            Connection Settings
                          </span>
                          <button onClick={() => setShowRelPanel(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}>
                            <X size={13} />
                          </button>
                        </div>
                        <input
                          className="input-field"
                          value={relLabel}
                          onChange={(e) => setRelLabel(e.target.value)}
                          placeholder="Label (e.g. Supplies to)"
                          style={{ width: '100%', fontSize: 11, padding: '5px 8px', marginBottom: 8, boxSizing: 'border-box' }}
                        />
                        <textarea
                          className="input-field"
                          value={relDesc}
                          onChange={(e) => setRelDesc(e.target.value)}
                          placeholder="Note (shown on arrow)"
                          rows={2}
                          style={{ width: '100%', fontSize: 11, padding: '5px 8px', marginBottom: 8, resize: 'none', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          {(['normal', 'animated'] as ArrowStyle[]).map((style) => (
                            <button key={style} onClick={() => setRelArrowStyle(style)} style={{
                              flex: 1, padding: '4px 0', borderRadius: 7, cursor: 'pointer', fontSize: 10,
                              border: `1px solid ${relArrowStyle === style ? relColor : 'rgba(59,130,246,0.2)'}`,
                              background: relArrowStyle === style ? `${relColor}20` : 'transparent',
                              color: relArrowStyle === style ? relColor : '#64748b',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            }}>
                              {style === 'normal' ? <Minus size={10} /> : <Zap size={10} />}
                              {style === 'normal' ? 'Normal' : 'Animated'}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                          {RELATIONSHIP_COLORS.map((c) => (
                            <button key={c} onClick={() => setRelColor(c)} style={{
                              width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                              border: relColor === c ? '2px solid white' : '2px solid transparent',
                              boxShadow: relColor === c ? `0 0 6px ${c}` : 'none', padding: 0,
                            }} />
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setShowRelPanel(false)} style={{
                            flex: 1, padding: '5px 0', borderRadius: 7, cursor: 'pointer', fontSize: 11,
                            background: 'transparent', border: '1px solid rgba(59,130,246,0.2)', color: '#64748b',
                          }}>
                            Cancel
                          </button>
                          <button onClick={handleRelPanelSave} style={{
                            flex: 2, padding: '5px 0', borderRadius: 7, cursor: 'pointer', fontSize: 11,
                            background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.5)',
                            color: '#a78bfa', fontWeight: 600,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          }}>
                            <GitMerge size={11} /> Save &amp; Connect
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedEntity.country && <InfoRow label="Location" value={selectedEntity.country} />}

                    {selectedEntity.description && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Description</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{selectedEntity.description}</div>
                      </div>
                    )}

                    {selectedEntity.statistics?.length > 0 && (() => {
                      const visStats = selectedEntity.statistics.filter((s) => isVisibleAtDate(s.asOf, globalViewDate));
                      return visStats.length > 0 ? (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                            Statistics{globalViewDate ? ' (filtered)' : ''}
                          </div>
                          {visStats.map((stat) => (
                            <div key={stat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 5, fontSize: 12 }}>
                              <span style={{ color: '#94a3b8' }}>{stat.name}</span>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ color: selectedEntity.color, fontWeight: 600 }}>{stat.value || '—'}</span>
                                {stat.asOf && (
                                  <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
                                    as of {new Date(stat.asOf + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {selectedEntity.subItems?.filter((s) => isVisibleAtDate(s.date, globalViewDate)).map((sub) => (
                      <div key={sub.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${selectedEntity.color}44` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>{sub.title}</div>
                          {sub.date && (
                            <div style={{ fontSize: 9, color: '#475569', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 4, padding: '1px 5px' }}>
                              {new Date(sub.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{sub.description}</div>
                      </div>
                    ))}

                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Connections</div>
                      {currentMap.relationships
                        .filter((r) => r.fromEntityId === selectedEntity.id || r.toEntityId === selectedEntity.id)
                        .map((rel) => {
                          const other = currentMap.entities.find((e) =>
                            e.id === (rel.fromEntityId === selectedEntity.id ? rel.toEntityId : rel.fromEntityId)
                          );
                          const isFrom = rel.fromEntityId === selectedEntity.id;
                          if (!other) return null;
                          return (
                            <div key={rel.id} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '5px 8px', borderRadius: 6,
                              background: 'rgba(15,23,42,0.5)',
                              border: '1px solid rgba(59,130,246,0.1)',
                              marginBottom: 4, fontSize: 11, color: '#94a3b8',
                            }}>
                              <span style={{ fontSize: 12 }}>{other.icon}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{other.name}</span>
                              <span style={{ fontSize: 9, color: rel.color, flexShrink: 0 }}>
                                {isFrom ? '→' : '←'} {rel.label || 'connected'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
                    Select an entity on the map or click one in the Entities tab
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Bottom size controls ── */}
          <div style={{
            borderTop: '1px solid rgba(59,130,246,0.12)',
            padding: '12px 14px', background: 'rgba(10,17,34,0.6)', flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Display Size
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Entities</span>
                <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>{Math.round(entitySizeMult * 100)}%</span>
              </div>
              <input type="range" min={0.4} max={2.5} step={0.05} value={entitySizeMult}
                onChange={(e) => onEntitySizeChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Arrows</span>
                <span style={{ fontSize: 11, color: '#06b6d4', fontWeight: 600 }}>{Math.round(arrowSizeMult * 100)}%</span>
              </div>
              <input type="range" min={0.4} max={3} step={0.05} value={arrowSizeMult}
                onChange={(e) => onArrowSizeChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#06b6d4', cursor: 'pointer' }} />
            </div>
            {(entitySizeMult !== 1 || arrowSizeMult !== 1) && (
              <button
                onClick={() => { onEntitySizeChange(1); onArrowSizeChange(1); }}
                style={{
                  marginTop: 8, width: '100%', padding: '4px 0', borderRadius: 6,
                  background: 'transparent', border: '1px solid rgba(59,130,246,0.2)',
                  color: '#475569', fontSize: 10, cursor: 'pointer', transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#475569')}
              >
                Reset sizes
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#94a3b8', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
