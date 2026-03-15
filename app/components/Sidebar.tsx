'use client';

import React, { useState } from 'react';
import { Layers, FolderOpen, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import FolderPanel from './FolderPanel';

type Tab = 'entities' | 'folders' | 'info';

interface SidebarProps {
  onFocusEntity: (pos: { x: number; y: number }) => void;
}

export default function Sidebar({ onFocusEntity }: SidebarProps) {
  const { currentMap, selectedEntityId, setSelectedEntity } = useMapStore();
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('entities');

  const selectedEntity = selectedEntityId
    ? currentMap.entities.find((e) => e.id === selectedEntityId)
    : null;

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'entities', icon: <Layers size={14} />, label: 'Entities' },
    { id: 'folders', icon: <FolderOpen size={14} />, label: 'Folders' },
    { id: 'info', icon: <Info size={14} />, label: 'Selected' },
  ];

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
          position: 'absolute',
          right: -14,
          top: 16,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'rgba(15,23,42,0.96)',
          border: '1px solid rgba(59,130,246,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          zIndex: 1,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {collapsed ? (
        /* Collapsed icons */
        <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setCollapsed(false); setActiveTab(tab.id); }}
              title={tab.label}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === tab.id ? '#3b82f6' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(59,130,246,0.12)', padding: '0 8px', paddingTop: 10 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '7px 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === tab.id ? '#3b82f6' : 'transparent'}`,
                  color: activeTab === tab.id ? '#3b82f6' : '#475569',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
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
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 8px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        marginBottom: 2,
                        background: selectedEntityId === entity.id ? `${entity.color}18` : 'transparent',
                        border: `1px solid ${selectedEntityId === entity.id ? entity.color + '44' : 'transparent'}`,
                        transition: 'all 0.1s ease',
                      }}
                      onMouseEnter={(e) => { if (selectedEntityId !== entity.id) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)'; }}
                      onMouseLeave={(e) => { if (selectedEntityId !== entity.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: entity.color + '22',
                        border: `1px solid ${entity.color}44`,
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
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: entity.color, flexShrink: 0 }} />
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'folders' && <FolderPanel />}

            {activeTab === 'info' && (
              <div>
                {selectedEntity ? (
                  <div className="fade-in">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: selectedEntity.color + '22',
                        border: `2px solid ${selectedEntity.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                      }}>
                        {selectedEntity.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>{selectedEntity.name}</div>
                        {selectedEntity.subtitle && (
                          <div style={{ fontSize: 11, color: selectedEntity.color }}>{selectedEntity.subtitle}</div>
                        )}
                      </div>
                    </div>

                    {selectedEntity.country && (
                      <InfoRow label="Location" value={selectedEntity.country} />
                    )}

                    {selectedEntity.description && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Description</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{selectedEntity.description}</div>
                      </div>
                    )}

                    {selectedEntity.subItems?.map((sub) => (
                      <div key={sub.id} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${selectedEntity.color}44` }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd', marginBottom: 2 }}>{sub.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{sub.description}</div>
                      </div>
                    ))}

                    {/* Connections */}
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
                    Select an entity on the map to view details
                  </div>
                )}
              </div>
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
