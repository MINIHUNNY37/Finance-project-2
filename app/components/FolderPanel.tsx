'use client';

import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import { ENTITY_COLORS } from '../types';

export default function FolderPanel() {
  const {
    currentMap,
    addFolder,
    deleteFolder,
    updateFolder,
    removeEntityFromFolder,
    setSelectedEntity,
  } = useMapStore();

  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(ENTITY_COLORS[0]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const entityMap = new Map(currentMap.entities.map((e) => [e.id, e]));
  const unorganized = currentMap.entities.filter((e) => !e.folderId);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    addFolder({
      name: newFolderName.trim(),
      color: newFolderColor,
      entityIds: [],
      createdBy: 'local',
    });
    setNewFolderName('');
    setCreating(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Folders
        </span>
        <button
          onClick={() => setCreating(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}
          title="New Folder"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Create folder form */}
      {creating && (
        <div
          className="fade-in"
          style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 8,
            padding: 10,
          }}
        >
          <input
            className="input-field"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreating(false); }}
            style={{ marginBottom: 8, fontSize: 12 }}
          />
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {ENTITY_COLORS.slice(0, 5).map((c) => (
              <button
                key={c}
                onClick={() => setNewFolderColor(c)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: c,
                  border: newFolderColor === c ? '2px solid white' : 'none',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" style={{ flex: 1, padding: '5px 8px', fontSize: 11 }} onClick={handleCreateFolder}>
              Create
            </button>
            <button className="btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Folder list */}
      {currentMap.folders.map((folder) => {
        const isExpanded = expandedFolders.has(folder.id);
        const folderEntities = folder.entityIds.map((id) => entityMap.get(id)).filter(Boolean);

        return (
          <div key={folder.id}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                borderRadius: 8,
                cursor: 'pointer',
                background: isExpanded ? 'rgba(59,130,246,0.08)' : 'transparent',
                border: `1px solid ${isExpanded ? 'rgba(59,130,246,0.2)' : 'transparent'}`,
                transition: 'all 0.15s ease',
              }}
              onClick={() => toggleFolder(folder.id)}
            >
              {isExpanded
                ? <FolderOpen size={14} style={{ color: folder.color, flexShrink: 0 }} />
                : <Folder size={14} style={{ color: folder.color, flexShrink: 0 }} />
              }
              <span style={{ flex: 1, fontSize: 12, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {folder.name}
              </span>
              <span style={{ fontSize: 10, color: '#64748b' }}>{folderEntities.length}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0 }}
              >
                <Trash2 size={11} />
              </button>
              {isExpanded ? <ChevronDown size={11} style={{ color: '#475569' }} /> : <ChevronRight size={11} style={{ color: '#475569' }} />}
            </div>

            {/* Folder entities */}
            {isExpanded && (
              <div style={{ marginLeft: 16, marginTop: 2 }}>
                {folderEntities.length === 0 && (
                  <div style={{ fontSize: 10, color: '#475569', padding: '4px 8px', fontStyle: 'italic' }}>
                    No entities yet
                  </div>
                )}
                {folderEntities.map((entity) => entity && (
                  <div
                    key={entity.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onClick={() => setSelectedEntity(entity.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 12 }}>{entity.icon}</span>
                    <span style={{ flex: 1, fontSize: 11, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entity.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeEntityFromFolder(entity.id, folder.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0 }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Unorganized entities */}
      {unorganized.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, paddingLeft: 4 }}>
            Unorganized
          </div>
          {unorganized.map((entity) => (
            <div
              key={entity.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onClick={() => setSelectedEntity(entity.id)}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 12 }}>{entity.icon}</span>
              <span style={{ flex: 1, fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entity.name}
              </span>
              {/* Assign to folder dropdown */}
              {currentMap.folders.length > 0 && (
                <select
                  style={{
                    background: 'rgba(15,23,42,0.8)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 4,
                    color: '#64748b',
                    fontSize: 10,
                    padding: '1px 4px',
                    cursor: 'pointer',
                  }}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      useMapStore.getState().addEntityToFolder(entity.id, e.target.value);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">+ folder</option>
                  {currentMap.folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
