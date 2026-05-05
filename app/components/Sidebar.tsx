'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Layers, FolderOpen, Folder, Info, ChevronLeft, ChevronRight, Trash2,
  GitMerge, Link2, Zap, Minus, X, Eye, EyeOff, ArrowRight, Plus, ChevronDown,
  Globe, BookOpen, Search, PlusCircle, ChevronUp,
} from 'lucide-react';
import { useMapStore } from '../store/mapStore';
import { usePresentationStore } from '../store/presentationStore';
import { isVisibleAtDate, getLatestStatsByLabel } from '../utils/dateFilter';
import type { ArrowStyle } from '../types';
import { RELATIONSHIP_COLORS, ENTITY_COLORS, GEO_EVENT_TYPES } from '../types';

type Tab = 'entities' | 'connections' | 'geo' | 'info';

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
  isDrawMode: boolean;
  onToggleDrawMode: () => void;
  onWidthChange?: (width: number) => void;
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
  isDrawMode,
  onToggleDrawMode,
  onWidthChange,
}: SidebarProps) {
  const {
    currentMap, selectedEntityId, setSelectedEntity, setConnectingFrom,
    deleteEntity, deleteRelationship, setSelectedRelationship, selectedRelationshipId,
    toggleEntityHidden, globalViewDate,
    addFolder, deleteFolder, removeEntityFromFolder,
    toggleGeoEventHidden, deleteGeoEvent,
    addGeoEventFolder, deleteGeoEventFolder, addGeoEventToFolder, removeGeoEventFromFolder,
    toggleRelationshipHidden,
    addConnectionFolder, deleteConnectionFolder, addConnectionToFolder, removeConnectionFromFolder,
  } = useMapStore();

  const presSubMode = usePresentationStore((s) => s.subMode);
  const presAddStep = usePresentationStore((s) => s.addStep);

  // Entity folder state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(ENTITY_COLORS[0]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['__unorg__']));

  // Geo event folder state
  const [creatingGeoFolder, setCreatingGeoFolder] = useState(false);
  const [newGeoFolderName, setNewGeoFolderName] = useState('');
  const [newGeoFolderColor, setNewGeoFolderColor] = useState(ENTITY_COLORS[2]);
  const [expandedGeoFolders, setExpandedGeoFolders] = useState<Set<string>>(new Set(['__geounorg__']));
  const [dragGeoEventId, setDragGeoEventId] = useState<string | null>(null);
  const [dropGeoFolderId, setDropGeoFolderId] = useState<string | null>(null);

  // Connection folder state
  const [creatingConnFolder, setCreatingConnFolder] = useState(false);
  const [newConnFolderName, setNewConnFolderName] = useState('');
  const [newConnFolderColor, setNewConnFolderColor] = useState(ENTITY_COLORS[5]);
  const [expandedConnFolders, setExpandedConnFolders] = useState<Set<string>>(new Set(['__connunorg__']));
  const [dragRelId, setDragRelId] = useState<string | null>(null);
  const [dropConnFolderId, setDropConnFolderId] = useState<string | null>(null);

  // Drag-and-drop: entity → folder
  const [dragEntityId, setDragEntityId] = useState<string | null>(null);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);

  // ── Stock Library ──────────────────────────────────────────────────────────
  interface LibraryStock {
    ticker: string; name: string; sector: string | null; exchange: string;
    isNasdaq100: boolean; isSP500: boolean;
    stats: {
      // Price snapshot
      price: number | null; priceChange: number | null; priceChangePct: number | null;
      week52High: number | null; week52Low: number | null;
      // Valuation
      marketCap: string | null; peRatio: string | null; priceToBook: string | null;
      // Income statement
      revenue: string | null; netIncome: string | null;
      eps: string | null; epsEstimate: string | null; epsSurprisePct: string | null;
      // Balance sheet
      bookValue: string | null; debtToEquity: string | null; currentRatio: string | null;
      // Cash flow
      freeCashFlow: string | null; operatingCashFlow: string | null;
      // Returns / yield
      operatingMargin: string | null; dividendYield: string | null;
      // Period metadata
      periodEnd: string | null; reportType: string | null; fetchedAt: string;
    } | null;
  }
  const [libraryOpen, setLibraryOpen]       = useState(false);
  const [libSearch,   setLibSearch]         = useState('');
  const [libIndex,    setLibIndex]          = useState<'all' | 'nasdaq100' | 'sp500'>('all');
  const [libStocks,   setLibStocks]         = useState<LibraryStock[]>([]);
  const [libTotal,    setLibTotal]          = useState(0);
  const [libOffset,   setLibOffset]         = useState(0);
  const [libLoading,  setLibLoading]        = useState(false);
  const [libAdded,    setLibAdded]          = useState<Set<string>>(new Set());
  const libSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIB_LIMIT = 30;

  const fetchLibraryStocks = useCallback(async (search: string, index: string, offset: number) => {
    setLibLoading(true);
    try {
      const params = new URLSearchParams({ search, index, limit: String(LIB_LIMIT), offset: String(offset) });
      const res = await fetch(`/api/markets/stocks?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setLibStocks(offset === 0 ? data.stocks : (prev: LibraryStock[]) => [...prev, ...data.stocks]);
      setLibTotal(data.total);
    } catch { /* ignore */ } finally { setLibLoading(false); }
  }, []);

  useEffect(() => {
    if (!libraryOpen) return;
    if (libSearchTimer.current) clearTimeout(libSearchTimer.current);
    libSearchTimer.current = setTimeout(() => {
      setLibOffset(0);
      fetchLibraryStocks(libSearch, libIndex, 0);
    }, 250);
    return () => { if (libSearchTimer.current) clearTimeout(libSearchTimer.current); };
  }, [libraryOpen, libSearch, libIndex, fetchLibraryStocks]);

  // Re-fetch when offset changes (load more)
  useEffect(() => {
    if (!libraryOpen || libOffset === 0) return;
    fetchLibraryStocks(libSearch, libIndex, libOffset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libOffset]);

  const handleAddFromLibrary = (stock: LibraryStock) => {
    const { addEntity, addFolder: addFolderStore, addEntityToFolder, currentMap: map } = useMapStore.getState();
    const now = new Date().toISOString();

    // Find or create the index folder
    const folderName = stock.isNasdaq100 ? 'NASDAQ-100' : 'S&P 500';
    let folder = map.folders.find(f => f.name === folderName);
    let folderId: string | undefined;
    if (!folder) {
      folderId = addFolderStore({ name: folderName, color: stock.isNasdaq100 ? '#3B82F6' : '#10B981', entityIds: [], createdBy: 'system' });
    } else {
      folderId = folder.id;
    }

    // Spread entity across canvas — avoid stacking exactly
    const count = map.entities.length;
    const col = count % 8;
    const row = Math.floor(count / 8);

    const sectorIconMap: Record<string, string> = {
      'Technology': '💻', 'Communication Services': '📺', 'Consumer Discretionary': '🛒',
      'Consumer Staples': '🛒', 'Healthcare': '🏥', 'Financials': '💰',
      'Industrials': '🏭', 'Energy': '⚡', 'Materials': '⛏️', 'Real Estate': '🏗️', 'Utilities': '🔋',
    };
    const sectorColorMap: Record<string, string> = {
      'Technology': '#3B82F6', 'Communication Services': '#06B6D4', 'Consumer Discretionary': '#F59E0B',
      'Consumer Staples': '#10B981', 'Healthcare': '#EC4899', 'Financials': '#F97316',
      'Industrials': '#8B5CF6', 'Energy': '#EF4444', 'Materials': '#6366F1', 'Real Estate': '#14B8A6', 'Utilities': '#84CC16',
    };

    const s = stock.stats;
    // asOf date derived from the quarterly period (YYYY-MM-DD)
    const periodDate = s?.periodEnd ? s.periodEnd.toString().split('T')[0] : undefined;

    // Build all stats in priority order; filter out nulls so the entity stays clean
    const allStatCandidates: Array<{ name: string; value: string | null | undefined }> = [
      { name: 'Price',            value: s?.price != null ? `$${s.price.toFixed(2)}` : null },
      { name: 'Market Cap',       value: s?.marketCap },
      { name: 'P/E Ratio',        value: s?.peRatio },
      { name: 'EPS (TTM)',        value: s?.eps },
      { name: 'Revenue',          value: s?.revenue },
      { name: 'Net Income',       value: s?.netIncome },
      { name: 'Operating Margin', value: s?.operatingMargin },
      { name: 'Free Cash Flow',   value: s?.freeCashFlow },
      { name: 'Dividend Yield',   value: s?.dividendYield },
      { name: 'Debt/Equity',      value: s?.debtToEquity },
      { name: 'Current Ratio',    value: s?.currentRatio },
      { name: 'Book Value',       value: s?.bookValue },
      { name: 'P/B Ratio',        value: s?.priceToBook },
      { name: '52W High',         value: s?.week52High != null ? `$${s.week52High.toFixed(2)}` : null },
      { name: '52W Low',          value: s?.week52Low  != null ? `$${s.week52Low.toFixed(2)}`  : null },
      { name: 'EPS Estimate',     value: s?.epsEstimate },
      { name: 'EPS Surprise',     value: s?.epsSurprisePct },
      { name: 'Op. Cash Flow',    value: s?.operatingCashFlow },
    ];
    const statistics = allStatCandidates
      .filter(({ value }) => value != null && value !== '')
      .map(({ name, value }) => ({
        id: crypto.randomUUID(), name, value: value as string, asOf: periodDate,
      }));

    const entityId = addEntity({
      name:        stock.name,
      icon:        sectorIconMap[stock.sector ?? ''] ?? '🏢',
      subtitle:    `${stock.ticker} · ${stock.exchange}`,
      description: stock.sector ?? '',
      subItems:    [],
      statistics,
      color:       sectorColorMap[stock.sector ?? ''] ?? '#6B7280',
      country:     'US',
      position:    { x: 120 + col * 200, y: 100 + row * 180 },
      locked:      false, fixedSize: true, hidden: false,
      folderId,
      createdBy:   'user',
      ticker:      stock.ticker,
      livePrice:   s?.price      ?? undefined,
      marketCap:   s?.marketCap  ?? undefined,
      peRatio:     s?.peRatio    ?? undefined,
      week52Low:   s?.week52Low  ?? undefined,
      week52High:  s?.week52High ?? undefined,
      sector:      stock.sector  ?? undefined,
      entityKind:  'stock' as const,
      catalysts:   [],
      tags:        [],
      links:       [],
    });

    if (folderId) addEntityToFolder(entityId, folderId);
    setLibAdded(prev => new Set([...prev, stock.ticker]));
    setTimeout(() => setLibAdded(prev => { const n = new Set(prev); n.delete(stock.ticker); return n; }), 2000);
  };
  // ── End Stock Library ──────────────────────────────────────────────────────

  const toggleFolderExpand = (id: string) => {
    setExpandedFolders((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleEntityDrop = (targetFolderId: string | null) => {
    if (!dragEntityId) return;
    const entity = currentMap.entities.find((e) => e.id === dragEntityId);
    if (!entity) return;
    if (targetFolderId === null) {
      // Drop onto "Unorganized" → remove from current folder
      if (entity.folderId) {
        useMapStore.getState().removeEntityFromFolder(dragEntityId, entity.folderId);
      }
    } else {
      // Drop onto a folder
      if (entity.folderId && entity.folderId !== targetFolderId) {
        useMapStore.getState().removeEntityFromFolder(dragEntityId, entity.folderId);
      }
      useMapStore.getState().addEntityToFolder(dragEntityId, targetFolderId);
      setExpandedFolders((prev) => new Set([...prev, targetFolderId]));
    }
    setDragEntityId(null);
    setDropFolderId(null);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const id = addFolder({ name: newFolderName.trim(), color: newFolderColor, entityIds: [], createdBy: 'local' });
    setExpandedFolders((prev) => new Set([...prev, id]));
    setNewFolderName(''); setCreatingFolder(false);
  };

  // ── Geo event folder helpers ──
  const handleGeoEventDrop = (targetFolderId: string | null) => {
    if (!dragGeoEventId) return;
    const ev = (currentMap.geoEvents ?? []).find((e) => e.id === dragGeoEventId);
    if (!ev) return;
    if (targetFolderId === null) {
      if (ev.folderId) removeGeoEventFromFolder(dragGeoEventId, ev.folderId);
    } else {
      if (ev.folderId && ev.folderId !== targetFolderId) removeGeoEventFromFolder(dragGeoEventId, ev.folderId);
      addGeoEventToFolder(dragGeoEventId, targetFolderId);
      setExpandedGeoFolders((prev) => new Set([...prev, targetFolderId]));
    }
    setDragGeoEventId(null); setDropGeoFolderId(null);
  };
  const handleCreateGeoFolder = () => {
    if (!newGeoFolderName.trim()) return;
    const id = addGeoEventFolder({ name: newGeoFolderName.trim(), color: newGeoFolderColor, geoEventIds: [] });
    setExpandedGeoFolders((prev) => new Set([...prev, id]));
    setNewGeoFolderName(''); setCreatingGeoFolder(false);
  };

  // ── Connection folder helpers ──
  const handleConnDrop = (targetFolderId: string | null) => {
    if (!dragRelId) return;
    const rel = currentMap.relationships.find((r) => r.id === dragRelId);
    if (!rel) return;
    if (targetFolderId === null) {
      if (rel.folderId) removeConnectionFromFolder(dragRelId, rel.folderId);
    } else {
      if (rel.folderId && rel.folderId !== targetFolderId) removeConnectionFromFolder(dragRelId, rel.folderId);
      addConnectionToFolder(dragRelId, targetFolderId);
      setExpandedConnFolders((prev) => new Set([...prev, targetFolderId]));
    }
    setDragRelId(null); setDropConnFolderId(null);
  };
  const handleCreateConnFolder = () => {
    if (!newConnFolderName.trim()) return;
    const id = addConnectionFolder({ name: newConnFolderName.trim(), color: newConnFolderColor, relationshipIds: [] });
    setExpandedConnFolders((prev) => new Set([...prev, id]));
    setNewConnFolderName(''); setCreatingConnFolder(false);
  };

  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('entities');
  const [sidebarWidth, setSidebarWidth] = useState(380);

  useEffect(() => {
    onWidthChange?.(collapsed ? 44 : sidebarWidth);
  }, [collapsed, sidebarWidth]);

  const handleResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(220, Math.min(520, startWidth + ev.clientX - startX));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

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
    { id: 'entities', icon: <Layers size={14} />, label: 'Entities' },
    { id: 'connections', icon: <ArrowRight size={14} />, label: 'Connect' },
    { id: 'geo', icon: <Globe size={14} />, label: 'Events' },
    { id: 'info', icon: <Info size={14} />, label: 'Selected' },
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
        top: 68,
        bottom: 0,
        width: collapsed ? 44 : sidebarWidth,
        background: 'rgba(15,23,42,0.96)',
        borderRight: '1px solid rgba(59,130,246,0.15)',
        backdropFilter: 'blur(12px)',
        transition: collapsed ? 'width 0.2s ease' : 'none',
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Draggable resize handle */}
      {!collapsed && (
        <div
          onMouseDown={handleResizeSidebar}
          title="Drag to resize"
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: 5, cursor: 'col-resize', zIndex: 2,
            background: 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.35)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        />
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute', right: -14, top: 16,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(15,23,42,0.96)',
          border: '1px solid rgba(59,130,246,0.3)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#8899b0', zIndex: 3, transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#8899b0')}
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
                color: activeTab === tab.id ? '#3b82f6' : '#8899b0',
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
                    <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                      {pendingRelSettings ? 'Connect with Settings' : 'Connect To'}
                    </div>
                    <div style={{ fontSize: 13, color: '#8899b0' }}>
                      From:{' '}
                      <span style={{ color: connectingFromEntity?.color || '#e2e8f0', fontWeight: 600 }}>
                        {connectingFromEntity?.icon} {connectingFromEntity?.name}
                      </span>
                    </div>
                    {pendingRelSettings?.label && (
                      <div style={{ fontSize: 14, color: '#8899b0', marginTop: 2 }}>
                        Label: <span style={{ color: pendingRelSettings.color }}>{pendingRelSettings.label}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onCancelConnect}
                    title="Cancel connect"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Entity list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                <div style={{ fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, paddingLeft: 2 }}>
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
                        <div style={{ fontSize: 14, fontWeight: 600, color: entity.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entity.name}
                        </div>
                        {entity.subtitle && (
                          <div style={{ fontSize: 14, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entity.subtitle}
                          </div>
                        )}
                      </div>
                      <ArrowRight size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    </button>
                  ))}
                {currentMap.entities.filter((e) => e.id !== connectingFromId && !e.hidden).length === 0 && (
                  <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '20px 8px' }}>
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
                    color: '#8899b0', fontSize: 14, cursor: 'pointer',
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
                  color: activeTab === tab.id ? '#3b82f6' : '#94a3b8',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all 0.15s ease',
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
            {activeTab === 'entities' && (() => {
              const entityMap = new Map(currentMap.entities.map((e) => [e.id, e]));
              const unorganized = currentMap.entities.filter((e) => !e.folderId);
              const isUnorgExpanded = expandedFolders.has('__unorg__');
              const isDragOverUnorg = dropFolderId === '__unorganized__';

              // Shared entity row renderer
              const renderEntityRow = (entity: typeof currentMap.entities[0], inFolderId?: string) => (
                <div
                  key={entity.id}
                  draggable
                  onDragStart={() => setDragEntityId(entity.id)}
                  onDragEnd={() => { setDragEntityId(null); setDropFolderId(null); }}
                  onClick={() => { setSelectedEntity(entity.id); onFocusEntity(entity.position); setActiveTab('info'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 10px', borderRadius: 7, cursor: 'grab', marginBottom: 1,
                    background: selectedEntityId === entity.id ? `${entity.color}18` : 'transparent',
                    border: `1px solid ${selectedEntityId === entity.id ? entity.color + '44' : 'transparent'}`,
                    opacity: entity.hidden ? 0.4 : 1,
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={(e) => { if (selectedEntityId !== entity.id) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)'; }}
                  onMouseLeave={(e) => { if (selectedEntityId !== entity.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                    background: entity.color + '22', border: `1px solid ${entity.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  }}>
                    {entity.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entity.name}
                    </div>
                    {entity.country && (
                      <div style={{ fontSize: 14, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entity.country}
                      </div>
                    )}
                  </div>
                  {presSubMode === 'edit' && (
                    <button
                      title="Add to presentation"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFocusEntity(entity.position);
                        presAddStep({
                          targetEntityIds: [entity.id],
                          zoomLevel: 2.0,
                          cameraMoveDuration: 1200,
                          holdDuration: 3000,
                          transitionType: 'smooth',
                          emphasisEffect: 'pulse',
                          heading: entity.name,
                          subheading: entity.subtitle || '',
                          bodyNote: '',
                        });
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: '2px 3px', display: 'flex', flexShrink: 0, opacity: 0.7, transition: 'opacity 0.1s' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                    >
                      <PlusCircle size={14} />
                    </button>
                  )}
                  <button
                    title={entity.hidden ? 'Show' : 'Hide'}
                    onClick={(e) => { e.stopPropagation(); toggleEntityHidden(entity.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 3px', display: 'flex', flexShrink: 0, opacity: entity.hidden ? 1 : 0.4, transition: 'opacity 0.1s' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = entity.hidden ? '1' : '0.4')}
                  >
                    {entity.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {inFolderId ? (
                    <button
                      title="Remove from folder"
                      onClick={(e) => { e.stopPropagation(); removeEntityFromFolder(entity.id, inFolderId); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 3px', display: 'flex', flexShrink: 0, opacity: 0.4, transition: 'opacity 0.1s' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.4')}
                    >
                      <X size={13} />
                    </button>
                  ) : selectedEntityId === entity.id ? (
                    <button
                      title="Delete entity"
                      onClick={(e) => { e.stopPropagation(); deleteEntity(entity.id); setSelectedEntity(null); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 3px', display: 'flex', flexShrink: 0, opacity: 0.7, transition: 'opacity 0.1s' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: entity.color, flexShrink: 0 }} />
                  )}
                </div>
              );

              return (
                <div>
                  {/* Header row: count + New Folder button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 2 }}>
                    <span style={{ fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Entities ({currentMap.entities.length})
                    </span>
                    <button
                      onClick={() => setCreatingFolder(true)}
                      title="New Folder"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'none', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6,
                        cursor: 'pointer', color: '#3b82f6', padding: '2px 7px', fontSize: 14,
                      }}
                    >
                      <Plus size={12} /> Folder
                    </button>
                  </div>

                  {/* Create folder form */}
                  {creatingFolder && (
                    <div className="fade-in" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <input
                        className="input-field"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name..."
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(false); }}
                        style={{ marginBottom: 8, fontSize: 12 }}
                      />
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {ENTITY_COLORS.slice(0, 5).map((c) => (
                          <button key={c} onClick={() => setNewFolderColor(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newFolderColor === c ? '2px solid white' : 'none', cursor: 'pointer' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-primary" style={{ flex: 1, padding: '4px 6px', fontSize: 11 }} onClick={handleCreateFolder}>Create</button>
                        <button className="btn-ghost" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => setCreatingFolder(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {currentMap.entities.length === 0 && (
                    <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
                      Click &quot;Add Entity&quot; to place a company on the map
                    </div>
                  )}

                  {/* ── Stock Library ─────────────────────────────────── */}
                  <div style={{ marginTop: 10, marginBottom: 4 }}>
                    {/* Toggle button */}
                    <button
                      onClick={() => setLibraryOpen(v => !v)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.25)',
                        background: libraryOpen ? 'rgba(6,182,212,0.08)' : 'rgba(15,23,42,0.5)',
                        cursor: 'pointer', color: libraryOpen ? '#06b6d4' : '#8899b0',
                        fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BookOpen size={13} /> Stock Library
                        <span style={{ fontSize: 10, fontWeight: 400, color: '#64748b' }}>
                          NASDAQ-100 &amp; S&amp;P 500
                        </span>
                      </span>
                      {libraryOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {libraryOpen && (
                      <div className="fade-in" style={{ marginTop: 6, background: 'rgba(10,18,35,0.7)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: 10, padding: 10 }}>
                        {/* Search + index filter */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                            <input
                              className="input-field"
                              value={libSearch}
                              onChange={e => setLibSearch(e.target.value)}
                              placeholder="Search ticker or name…"
                              style={{ paddingLeft: 26, fontSize: 11, padding: '5px 8px 5px 26px' }}
                            />
                          </div>
                          <select
                            value={libIndex}
                            onChange={e => setLibIndex(e.target.value as 'all' | 'nasdaq100' | 'sp500')}
                            style={{ fontSize: 11, padding: '4px 6px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer' }}
                          >
                            <option value="all">All</option>
                            <option value="nasdaq100">NASDAQ-100</option>
                            <option value="sp500">S&amp;P 500</option>
                          </select>
                        </div>

                        {/* Stock list */}
                        <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
                          {libLoading && libStocks.length === 0 ? (
                            <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', padding: 16 }}>Loading…</div>
                          ) : libStocks.length === 0 ? (
                            <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', padding: 16 }}>
                              {libSearch ? 'No results' : 'No stocks in library yet — run the market seeder first.'}
                            </div>
                          ) : (
                            <>
                              {libStocks.map((stock) => {
                                const alreadyOnMap = currentMap.entities.some(e => e.ticker === stock.ticker);
                                const justAdded    = libAdded.has(stock.ticker);
                                const s            = stock.stats;
                                const priceUp      = (s?.priceChangePct ?? 0) >= 0;
                                // Gradient avatar from ticker initials
                                const initial      = stock.ticker.charAt(0);
                                const gradients: Record<string, string> = {
                                  A: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                                  B: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
                                  C: 'linear-gradient(135deg,#10b981,#3b82f6)',
                                  D: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                                  E: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
                                  F: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
                                  G: 'linear-gradient(135deg,#10b981,#6366f1)',
                                  H: 'linear-gradient(135deg,#f97316,#ef4444)',
                                  I: 'linear-gradient(135deg,#6366f1,#3b82f6)',
                                  J: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
                                  K: 'linear-gradient(135deg,#14b8a6,#06b6d4)',
                                  L: 'linear-gradient(135deg,#84cc16,#10b981)',
                                  M: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                                  N: 'linear-gradient(135deg,#10b981,#06b6d4)',
                                  O: 'linear-gradient(135deg,#f59e0b,#f97316)',
                                  P: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
                                  Q: 'linear-gradient(135deg,#06b6d4,#10b981)',
                                  R: 'linear-gradient(135deg,#ef4444,#f97316)',
                                  S: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                                  T: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
                                  U: 'linear-gradient(135deg,#10b981,#84cc16)',
                                  V: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
                                  W: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                                  X: 'linear-gradient(135deg,#06b6d4,#6366f1)',
                                  Y: 'linear-gradient(135deg,#ec4899,#f97316)',
                                  Z: 'linear-gradient(135deg,#14b8a6,#3b82f6)',
                                };
                                const grad = gradients[initial] ?? 'linear-gradient(135deg,#3b82f6,#6366f1)';

                                // Metric rows: [icon(material symbol), label, value]
                                const metrics: [string, string, string, string?][] = [
                                  ['paid',           'Market Cap',      s?.marketCap      ?? '—'],
                                  ['trending_up',    'P/E Ratio',       s?.peRatio ? `${s.peRatio}x` : '—'],
                                  ['bar_chart',      'Revenue',         s?.revenue        ?? '—', priceUp ? '#16a34a' : undefined],
                                  ['donut_small',    'Op. Margin',      s?.operatingMargin ?? '—'],
                                  ['shield',         'P/B Ratio',       s?.priceToBook ? `${s.priceToBook}x` : '—'],
                                  ['account_balance_wallet', 'FCF',     s?.freeCashFlow   ?? '—'],
                                  ['balance',        'Debt/Equity',     s?.debtToEquity ? `${s.debtToEquity}x` : '—'],
                                  ['calendar_month', '52W Range',
                                    (s?.week52Low != null && s?.week52High != null)
                                      ? `$${s.week52Low}–$${s.week52High}` : '—'],
                                ];

                                return (
                                  <div
                                    key={stock.ticker}
                                    style={{
                                      background: '#ffffff',
                                      borderRadius: 14,
                                      padding: '12px 12px 10px',
                                      marginBottom: 10,
                                      boxShadow: alreadyOnMap
                                        ? '0 0 0 2px #10b981, 0 4px 16px rgba(0,0,0,0.08)'
                                        : '0 2px 12px rgba(0,0,0,0.08)',
                                      transition: 'box-shadow 0.15s',
                                    }}
                                  >
                                    {/* ── Header row ── */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                      {/* Logo avatar */}
                                      <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: grad, flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontWeight: 800, fontSize: 15,
                                        fontFamily: 'Manrope, sans-serif',
                                      }}>{initial}</div>
                                      {/* Name + ticker badge */}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'Manrope, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {stock.name}
                                        </div>
                                        <span style={{
                                          display: 'inline-block', fontSize: 9, fontWeight: 600,
                                          background: '#eff6ff', color: '#3b82f6',
                                          borderRadius: 20, padding: '1px 7px', marginTop: 2,
                                          fontFamily: 'Inter, sans-serif',
                                        }}>{stock.ticker}</span>
                                      </div>
                                      {/* Status + add button */}
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                        <span style={{
                                          fontSize: 8, fontWeight: 600, borderRadius: 20,
                                          padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3,
                                          background: alreadyOnMap ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)',
                                          color: alreadyOnMap ? '#059669' : '#10b981',
                                          fontFamily: 'Inter, sans-serif',
                                        }}>
                                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                          {alreadyOnMap ? 'On Map' : 'Live'}
                                        </span>
                                        {alreadyOnMap ? null : (
                                          <button
                                            onClick={() => handleAddFromLibrary(stock)}
                                            title={`Add ${stock.ticker} to map`}
                                            style={{
                                              background: justAdded ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.1)',
                                              border: 'none', borderRadius: 6, cursor: 'pointer',
                                              color: justAdded ? '#10b981' : '#3b82f6',
                                              padding: '3px 5px', display: 'flex', alignItems: 'center',
                                            }}
                                          >
                                            <PlusCircle size={13} />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* ── Price row ── */}
                                    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                                      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontFamily: 'Manrope, sans-serif', lineHeight: 1 }}>
                                        {s?.price != null ? `$${s.price.toFixed(2)}` : '—'}
                                      </div>
                                      {s?.priceChangePct != null && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: priceUp ? '#16a34a' : '#dc2626', fontFamily: 'Inter, sans-serif' }}>
                                            {priceUp ? '↑' : '↓'} {priceUp ? '+' : ''}{s.priceChangePct.toFixed(2)}%
                                          </span>
                                          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>Today</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* ── 2-col metric grid ── */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 8px' }}>
                                      {metrics.map(([icon, label, value, color]) => (
                                        <div key={label} style={{
                                          display: 'flex', alignItems: 'center', gap: 7,
                                          background: '#f8fafc', borderRadius: 8, padding: '5px 7px',
                                        }}>
                                          <div style={{
                                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                            background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#3b82f6' }}>{icon}</span>
                                          </div>
                                          <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{label}</div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: color ?? '#0f172a', fontFamily: 'Manrope, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* ── Index badges footer ── */}
                                    {(stock.isNasdaq100 || stock.isSP500) && (
                                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                                        {stock.isNasdaq100 && (
                                          <span style={{ fontSize: 8, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 20, padding: '2px 7px', fontWeight: 600 }}>NASDAQ-100</span>
                                        )}
                                        {stock.isSP500 && (
                                          <span style={{ fontSize: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 20, padding: '2px 7px', fontWeight: 600 }}>S&P 500</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Load more */}
                              {libStocks.length < libTotal && (
                                <button
                                  onClick={() => setLibOffset(o => o + LIB_LIMIT)}
                                  disabled={libLoading}
                                  style={{ width: '100%', marginTop: 2, marginBottom: 4, padding: '7px', background: 'none', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#3b82f6', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                                >
                                  {libLoading ? 'Loading…' : `Load more (${libTotal - libStocks.length} remaining)`}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* ── End Stock Library ─────────────────────────────── */}

                  {/* ── Folder accordion sections ── */}
                  {currentMap.folders.map((folder) => {
                    const folderEntities = folder.entityIds.map((id) => entityMap.get(id)).filter(Boolean) as typeof currentMap.entities;
                    const isExpanded = expandedFolders.has(folder.id);
                    const isDragOver = dropFolderId === folder.id;
                    return (
                      <div key={folder.id} style={{ marginBottom: 2 }}>
                        {/* Folder header — click to toggle, drag target */}
                        <div
                          onClick={() => toggleFolderExpand(folder.id)}
                          onDragOver={(e) => { e.preventDefault(); setDropFolderId(folder.id); }}
                          onDragLeave={() => setDropFolderId(null)}
                          onDrop={() => handleEntityDrop(folder.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                            background: isDragOver ? `${folder.color}20` : isExpanded ? `${folder.color}10` : 'rgba(15,23,42,0.4)',
                            border: `1px solid ${isDragOver ? folder.color : isExpanded ? `${folder.color}40` : 'rgba(59,130,246,0.1)'}`,
                            outline: isDragOver ? `2px dashed ${folder.color}` : 'none',
                            outlineOffset: -2, transition: 'all 0.12s',
                          }}
                        >
                          {isExpanded
                            ? <FolderOpen size={13} style={{ color: folder.color, flexShrink: 0 }} />
                            : <Folder size={13} style={{ color: folder.color, flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isDragOver ? folder.color : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {folder.name}
                          </span>
                          {isDragOver
                            ? <span style={{ fontSize: 13, color: folder.color, flexShrink: 0 }}>Drop here</span>
                            : <span style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }}>{folderEntities.length}</span>}
                          <ChevronDown size={13} style={{ color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                            title="Delete folder"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 1px', display: 'flex', flexShrink: 0, opacity: 0.5 }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.5')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Folder body — entity rows */}
                        {isExpanded && (
                          <div className="fade-in" style={{ marginLeft: 8, paddingLeft: 8, paddingTop: 2, paddingBottom: 2, borderLeft: `2px solid ${folder.color}35` }}>
                            {folderEntities.length === 0 ? (
                              <div style={{ fontSize: 14, color: '#8899b0', padding: '5px 4px', fontStyle: 'italic' }}>
                                Empty — drag entities here
                              </div>
                            ) : folderEntities.map((entity) => renderEntityRow(entity, folder.id))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Uncategorized accordion section ── */}
                  {unorganized.length > 0 && (
                    <div style={{ marginTop: currentMap.folders.length > 0 ? 6 : 0 }}>
                      {/* Uncategorized header — also a drop target (remove from folder) */}
                      <div
                        onClick={() => setExpandedFolders((prev) => { const n = new Set(prev); n.has('__unorg__') ? n.delete('__unorg__') : n.add('__unorg__'); return n; })}
                        onDragOver={(e) => { e.preventDefault(); setDropFolderId('__unorganized__'); }}
                        onDragLeave={() => setDropFolderId(null)}
                        onDrop={() => handleEntityDrop(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                          background: isDragOverUnorg ? 'rgba(100,116,139,0.15)' : isUnorgExpanded ? 'rgba(59,130,246,0.06)' : 'rgba(15,23,42,0.4)',
                          border: `1px solid ${isDragOverUnorg ? 'rgba(100,116,139,0.5)' : isUnorgExpanded ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.1)'}`,
                          outline: isDragOverUnorg ? '2px dashed rgba(100,116,139,0.5)' : 'none',
                          outlineOffset: -2, transition: 'all 0.12s',
                          marginBottom: 2,
                        }}
                      >
                        <Layers size={13} style={{ color: '#8899b0', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isDragOverUnorg ? '#94a3b8' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentMap.folders.length > 0 ? 'Uncategorized' : 'All Entities'}
                        </span>
                        {isDragOverUnorg
                          ? <span style={{ fontSize: 13, color: '#94a3b8', flexShrink: 0 }}>Remove from folder</span>
                          : <span style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }}>{unorganized.length}</span>}
                        <ChevronDown size={13} style={{ color: '#94a3b8', transform: isUnorgExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                      </div>

                      {/* Uncategorized body */}
                      {isUnorgExpanded && (
                        <div className="fade-in" style={{ marginLeft: 8, paddingLeft: 8, paddingTop: 2, paddingBottom: 2, borderLeft: '2px solid rgba(59,130,246,0.15)' }}>
                          {unorganized.map((entity) => renderEntityRow(entity))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* When all entities are in folders, no uncategorized needed */}
                  {unorganized.length === 0 && currentMap.entities.length > 0 && currentMap.folders.length > 0 && (
                    <div style={{ fontSize: 14, color: '#8899b0', textAlign: 'center', padding: '6px 0', fontStyle: 'italic' }}>
                      All entities are organized in folders
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── CONNECTIONS TAB ── */}
            {activeTab === 'connections' && (() => {
              const connFolders = currentMap.connectionFolders ?? [];
              const relMap = new Map(currentMap.relationships.map((r) => [r.id, r]));
              const unorgRels = currentMap.relationships.filter((r) => !r.folderId);
              const isUnorgConnExpanded = expandedConnFolders.has('__connunorg__');
              const isDragOverUnorgConn = dropConnFolderId === '__connunorganized__';

              const renderRelRow = (rel: typeof currentMap.relationships[0], inFolderId?: string) => {
                const from = currentMap.entities.find((e) => e.id === rel.fromEntityId);
                const to = currentMap.entities.find((e) => e.id === rel.toEntityId);
                if (!from || !to) return null;
                const isSelected = selectedRelationshipId === rel.id;
                return (
                  <div
                    key={rel.id}
                    draggable
                    onDragStart={() => setDragRelId(rel.id)}
                    onDragEnd={() => { setDragRelId(null); setDropConnFolderId(null); }}
                    onClick={() => setSelectedRelationship(rel.id)}
                    style={{
                      padding: '9px 10px', borderRadius: 8, marginBottom: 3, cursor: 'grab',
                      background: isSelected ? `${rel.color}12` : 'rgba(15,23,42,0.5)',
                      border: `1px solid ${isSelected ? rel.color + '55' : 'rgba(59,130,246,0.1)'}`,
                      opacity: rel.hidden ? 0.4 : 1,
                      transition: 'all 0.1s ease',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)'; }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isSelected ? `${rel.color}12` : 'rgba(15,23,42,0.5)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{from.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: from.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{from.name}</span>
                      <span style={{ flexShrink: 0, color: rel.color, fontSize: 12 }}>→</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: to.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textAlign: 'right' }}>{to.name}</span>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{to.icon}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: rel.color }} />
                        <span style={{ fontSize: 13, color: '#8899b0' }}>{rel.label || <span style={{ opacity: 0.4 }}>no label</span>}</span>
                        {rel.arrowStyle === 'animated' && <Zap size={12} style={{ color: rel.color, opacity: 0.7 }} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <button title={rel.hidden ? 'Show' : 'Hide'} onClick={(e) => { e.stopPropagation(); toggleRelationshipHidden(rel.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '1px 2px', display: 'flex', opacity: rel.hidden ? 1 : 0.4, transition: 'opacity 0.1s' }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = rel.hidden ? '1' : '0.4')}>
                          {rel.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        {inFolderId ? (
                          <button title="Remove from folder" onClick={(e) => { e.stopPropagation(); removeConnectionFromFolder(rel.id, inFolderId); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '1px 2px', display: 'flex', opacity: 0.4, transition: 'opacity 0.1s' }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.4')}>
                            <X size={13} />
                          </button>
                        ) : (
                          <button title="Delete" onClick={(e) => { e.stopPropagation(); deleteRelationship(rel.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '1px 2px', display: 'flex', opacity: 0.55, transition: 'opacity 0.1s' }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.55')}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Connections ({currentMap.relationships.length})
                    </span>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={onToggleDrawMode}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
                          background: isDrawMode ? 'rgba(168,85,247,0.2)' : 'rgba(15,23,42,0.5)',
                          border: `1px solid ${isDrawMode ? 'rgba(168,85,247,0.6)' : 'rgba(59,130,246,0.2)'}`,
                          color: isDrawMode ? '#c084fc' : '#94a3b8' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Draw
                      </button>
                      <button onClick={() => setCreatingConnFolder(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, cursor: 'pointer', color: '#3b82f6', padding: '2px 7px', fontSize: 10 }}>
                        <Plus size={12} /> Folder
                      </button>
                    </div>
                  </div>

                  {isDrawMode && (
                    <div style={{ marginBottom: 8, padding: '5px 9px', borderRadius: 7, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', fontSize: 14, color: '#a78bfa', lineHeight: 1.5 }}>
                      Right-click drag from entity to entity
                    </div>
                  )}

                  {creatingConnFolder && (
                    <div className="fade-in" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <input className="input-field" value={newConnFolderName} onChange={(e) => setNewConnFolderName(e.target.value)}
                        placeholder="Folder name..." autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCreateConnFolder(); if (e.key === 'Escape') setCreatingConnFolder(false); }}
                        style={{ marginBottom: 8, fontSize: 12 }} />
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {ENTITY_COLORS.slice(0, 5).map((c) => (
                          <button key={c} onClick={() => setNewConnFolderColor(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newConnFolderColor === c ? '2px solid white' : 'none', cursor: 'pointer' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-primary" style={{ flex: 1, padding: '4px 6px', fontSize: 11 }} onClick={handleCreateConnFolder}>Create</button>
                        <button className="btn-ghost" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => setCreatingConnFolder(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Connection folder accordion */}
                  {connFolders.map((folder) => {
                    const folderRels = folder.relationshipIds.map((id) => relMap.get(id)).filter(Boolean) as typeof currentMap.relationships;
                    const isExpanded = expandedConnFolders.has(folder.id);
                    const isDragOver = dropConnFolderId === folder.id;
                    return (
                      <div key={folder.id} style={{ marginBottom: 2 }}>
                        <div onClick={() => setExpandedConnFolders((prev) => { const n = new Set(prev); n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id); return n; })}
                          onDragOver={(e) => { e.preventDefault(); setDropConnFolderId(folder.id); }}
                          onDragLeave={() => setDropConnFolderId(null)}
                          onDrop={() => handleConnDrop(folder.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                            background: isDragOver ? `${folder.color}20` : isExpanded ? `${folder.color}10` : 'rgba(15,23,42,0.4)',
                            border: `1px solid ${isDragOver ? folder.color : isExpanded ? `${folder.color}40` : 'rgba(59,130,246,0.1)'}`,
                            outline: isDragOver ? `2px dashed ${folder.color}` : 'none', outlineOffset: -2, transition: 'all 0.12s' }}>
                          {isExpanded ? <FolderOpen size={14} style={{ color: folder.color, flexShrink: 0 }} /> : <Folder size={14} style={{ color: folder.color, flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                          <span style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }}>{folderRels.length}</span>
                          <ChevronDown size={13} style={{ color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                          <button onClick={(e) => { e.stopPropagation(); deleteConnectionFolder(folder.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 1px', display: 'flex', flexShrink: 0, opacity: 0.5 }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.5')}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="fade-in" style={{ marginLeft: 8, paddingLeft: 8, paddingTop: 2, paddingBottom: 2, borderLeft: `2px solid ${folder.color}35` }}>
                            {folderRels.length === 0 ? <div style={{ fontSize: 14, color: '#8899b0', padding: '5px 4px', fontStyle: 'italic' }}>Empty — drag connections here</div>
                              : folderRels.map((r) => renderRelRow(r, folder.id))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Uncategorized connections */}
                  {unorgRels.length > 0 && (
                    <div style={{ marginTop: connFolders.length > 0 ? 6 : 0 }}>
                      <div onClick={() => setExpandedConnFolders((prev) => { const n = new Set(prev); n.has('__connunorg__') ? n.delete('__connunorg__') : n.add('__connunorg__'); return n; })}
                        onDragOver={(e) => { e.preventDefault(); setDropConnFolderId('__connunorganized__'); }}
                        onDragLeave={() => setDropConnFolderId(null)}
                        onDrop={() => handleConnDrop(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                          background: isDragOverUnorgConn ? 'rgba(100,116,139,0.15)' : isUnorgConnExpanded ? 'rgba(59,130,246,0.06)' : 'rgba(15,23,42,0.4)',
                          border: `1px solid ${isDragOverUnorgConn ? 'rgba(100,116,139,0.5)' : 'rgba(59,130,246,0.1)'}`,
                          outline: isDragOverUnorgConn ? '2px dashed rgba(100,116,139,0.5)' : 'none', outlineOffset: -2, transition: 'all 0.12s' }}>
                        <ArrowRight size={14} style={{ color: '#8899b0', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>{connFolders.length > 0 ? 'Uncategorized' : 'All Connections'}</span>
                        <span style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }}>{unorgRels.length}</span>
                        <ChevronDown size={13} style={{ color: '#94a3b8', transform: isUnorgConnExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                      </div>
                      {isUnorgConnExpanded && (
                        <div className="fade-in" style={{ marginLeft: 8, paddingLeft: 8, paddingTop: 2, paddingBottom: 2, borderLeft: '2px solid rgba(59,130,246,0.15)' }}>
                          {unorgRels.map((r) => renderRelRow(r))}
                        </div>
                      )}
                    </div>
                  )}

                  {currentMap.relationships.length === 0 && (
                    <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
                      Select two entities and use Connect to create a connection
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── GEO EVENTS TAB ── */}
            {activeTab === 'geo' && (() => {
              const geoFolders = currentMap.geoEventFolders ?? [];
              const geoEvents = currentMap.geoEvents ?? [];
              const geoMap = new Map(geoEvents.map((e) => [e.id, e]));
              const unorgGeo = geoEvents.filter((e) => !e.folderId);
              const isUnorgGeoExpanded = expandedGeoFolders.has('__geounorg__');
              const isDragOverUnorgGeo = dropGeoFolderId === '__geounorganized__';

              const renderGeoRow = (ev: typeof geoEvents[0], inFolderId?: string) => {
                const meta = GEO_EVENT_TYPES.find((t) => t.value === ev.type) ?? GEO_EVENT_TYPES[0];
                return (
                  <div key={ev.id}
                    draggable
                    onDragStart={() => setDragGeoEventId(ev.id)}
                    onDragEnd={() => { setDragGeoEventId(null); setDropGeoFolderId(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 7, cursor: 'grab', marginBottom: 1,
                      background: 'transparent', border: '1px solid transparent',
                      opacity: ev.hidden ? 0.4 : 1, transition: 'all 0.1s' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: meta.color + '22', border: `1px solid ${meta.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                      {meta.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                      <div style={{ fontSize: 14, color: meta.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.label}</div>
                    </div>
                    <button title={ev.hidden ? 'Show' : 'Hide'} onClick={(e) => { e.stopPropagation(); toggleGeoEventHidden(ev.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 3px', display: 'flex', flexShrink: 0, opacity: ev.hidden ? 1 : 0.4, transition: 'opacity 0.1s' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = ev.hidden ? '1' : '0.4')}>
                      {ev.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    {inFolderId ? (
                      <button title="Remove from folder" onClick={(e) => { e.stopPropagation(); removeGeoEventFromFolder(ev.id, inFolderId); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 3px', display: 'flex', flexShrink: 0, opacity: 0.4, transition: 'opacity 0.1s' }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.4')}>
                        <X size={13} />
                      </button>
                    ) : (
                      <button title="Delete" onClick={(e) => { e.stopPropagation(); deleteGeoEvent(ev.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 3px', display: 'flex', flexShrink: 0, opacity: 0.55, transition: 'opacity 0.1s' }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.55')}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              };

              return (
                <div>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Geo Events ({geoEvents.length})
                    </span>
                    <button onClick={() => setCreatingGeoFolder(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, cursor: 'pointer', color: '#3b82f6', padding: '2px 7px', fontSize: 10 }}>
                      <Plus size={12} /> Folder
                    </button>
                  </div>

                  {creatingGeoFolder && (
                    <div className="fade-in" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <input className="input-field" value={newGeoFolderName} onChange={(e) => setNewGeoFolderName(e.target.value)}
                        placeholder="Folder name..." autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGeoFolder(); if (e.key === 'Escape') setCreatingGeoFolder(false); }}
                        style={{ marginBottom: 8, fontSize: 12 }} />
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {ENTITY_COLORS.slice(0, 5).map((c) => (
                          <button key={c} onClick={() => setNewGeoFolderColor(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newGeoFolderColor === c ? '2px solid white' : 'none', cursor: 'pointer' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-primary" style={{ flex: 1, padding: '4px 6px', fontSize: 11 }} onClick={handleCreateGeoFolder}>Create</button>
                        <button className="btn-ghost" style={{ padding: '4px 6px', fontSize: 11 }} onClick={() => setCreatingGeoFolder(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {geoFolders.map((folder) => {
                    const folderEvs = folder.geoEventIds.map((id) => geoMap.get(id)).filter(Boolean) as typeof geoEvents;
                    const isExpanded = expandedGeoFolders.has(folder.id);
                    const isDragOver = dropGeoFolderId === folder.id;
                    return (
                      <div key={folder.id} style={{ marginBottom: 2 }}>
                        <div onClick={() => setExpandedGeoFolders((prev) => { const n = new Set(prev); n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id); return n; })}
                          onDragOver={(e) => { e.preventDefault(); setDropGeoFolderId(folder.id); }}
                          onDragLeave={() => setDropGeoFolderId(null)}
                          onDrop={() => handleGeoEventDrop(folder.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                            background: isDragOver ? `${folder.color}20` : isExpanded ? `${folder.color}10` : 'rgba(15,23,42,0.4)',
                            border: `1px solid ${isDragOver ? folder.color : isExpanded ? `${folder.color}40` : 'rgba(59,130,246,0.1)'}`,
                            outline: isDragOver ? `2px dashed ${folder.color}` : 'none', outlineOffset: -2, transition: 'all 0.12s' }}>
                          {isExpanded ? <FolderOpen size={14} style={{ color: folder.color, flexShrink: 0 }} /> : <Folder size={14} style={{ color: folder.color, flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                          <span style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }}>{folderEvs.length}</span>
                          <ChevronDown size={13} style={{ color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                          <button onClick={(e) => { e.stopPropagation(); deleteGeoEventFolder(folder.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 1px', display: 'flex', flexShrink: 0, opacity: 0.5 }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.5')}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="fade-in" style={{ marginLeft: 8, paddingLeft: 8, paddingTop: 2, paddingBottom: 2, borderLeft: `2px solid ${folder.color}35` }}>
                            {folderEvs.length === 0 ? <div style={{ fontSize: 14, color: '#8899b0', padding: '5px 4px', fontStyle: 'italic' }}>Empty — drag events here</div>
                              : folderEvs.map((ev) => renderGeoRow(ev, folder.id))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Uncategorized geo events */}
                  {unorgGeo.length > 0 && (
                    <div style={{ marginTop: geoFolders.length > 0 ? 6 : 0 }}>
                      <div onClick={() => setExpandedGeoFolders((prev) => { const n = new Set(prev); n.has('__geounorg__') ? n.delete('__geounorg__') : n.add('__geounorg__'); return n; })}
                        onDragOver={(e) => { e.preventDefault(); setDropGeoFolderId('__geounorganized__'); }}
                        onDragLeave={() => setDropGeoFolderId(null)}
                        onDrop={() => handleGeoEventDrop(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                          background: isDragOverUnorgGeo ? 'rgba(100,116,139,0.15)' : isUnorgGeoExpanded ? 'rgba(59,130,246,0.06)' : 'rgba(15,23,42,0.4)',
                          border: `1px solid ${isDragOverUnorgGeo ? 'rgba(100,116,139,0.5)' : 'rgba(59,130,246,0.1)'}`,
                          outline: isDragOverUnorgGeo ? '2px dashed rgba(100,116,139,0.5)' : 'none', outlineOffset: -2, transition: 'all 0.12s' }}>
                        <Globe size={14} style={{ color: '#8899b0', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>{geoFolders.length > 0 ? 'Uncategorized' : 'All Events'}</span>
                        <span style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }}>{unorgGeo.length}</span>
                        <ChevronDown size={13} style={{ color: '#94a3b8', transform: isUnorgGeoExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                      </div>
                      {isUnorgGeoExpanded && (
                        <div className="fade-in" style={{ marginLeft: 8, paddingLeft: 8, paddingTop: 2, paddingBottom: 2, borderLeft: '2px solid rgba(59,130,246,0.15)' }}>
                          {unorgGeo.map((ev) => renderGeoRow(ev))}
                        </div>
                      )}
                    </div>
                  )}

                  {geoEvents.length === 0 && (
                    <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
                      Click &quot;Add Geo Event&quot; in the toolbar to place an event on the map
                    </div>
                  )}
                </div>
              );
            })()}

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
                          <div style={{ fontSize: 13, color: selectedEntity.color }}>{selectedEntity.subtitle}</div>
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
                            padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
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
                            padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
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
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            Connection Settings
                          </span>
                          <button onClick={() => setShowRelPanel(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                            <X size={13} />
                          </button>
                        </div>
                        <input
                          className="input-field"
                          value={relLabel}
                          onChange={(e) => setRelLabel(e.target.value)}
                          placeholder="Label (e.g. Supplies to)"
                          style={{ width: '100%', fontSize: 13, padding: '5px 8px', marginBottom: 8, boxSizing: 'border-box' }}
                        />
                        <textarea
                          className="input-field"
                          value={relDesc}
                          onChange={(e) => setRelDesc(e.target.value)}
                          placeholder="Note (shown on arrow)"
                          rows={2}
                          style={{ width: '100%', fontSize: 13, padding: '5px 8px', marginBottom: 8, resize: 'none', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          {(['normal', 'animated'] as ArrowStyle[]).map((style) => (
                            <button key={style} onClick={() => setRelArrowStyle(style)} style={{
                              flex: 1, padding: '4px 0', borderRadius: 7, cursor: 'pointer', fontSize: 14,
                              border: `1px solid ${relArrowStyle === style ? relColor : 'rgba(59,130,246,0.2)'}`,
                              background: relArrowStyle === style ? `${relColor}20` : 'transparent',
                              color: relArrowStyle === style ? relColor : '#8899b0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            }}>
                              {style === 'normal' ? <Minus size={10} /> : <Zap size={12} />}
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
                            flex: 1, padding: '5px 0', borderRadius: 7, cursor: 'pointer', fontSize: 13,
                            background: 'transparent', border: '1px solid rgba(59,130,246,0.2)', color: '#8899b0',
                          }}>
                            Cancel
                          </button>
                          <button onClick={handleRelPanelSave} style={{
                            flex: 2, padding: '5px 0', borderRadius: 7, cursor: 'pointer', fontSize: 13,
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
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Description</div>
                        <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>{selectedEntity.description}</div>
                      </div>
                    )}

                    {selectedEntity.statistics?.length > 0 && (() => {
                      const visStats = getLatestStatsByLabel(selectedEntity.statistics, globalViewDate);
                      return visStats.length > 0 ? (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                            Statistics{globalViewDate ? ' (filtered)' : ''}
                          </div>
                          {visStats.map((stat) => (
                            <div key={stat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 5, fontSize: 12 }}>
                              <span style={{ color: '#94a3b8' }}>{stat.name}</span>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ color: selectedEntity.color, fontWeight: 600 }}>{stat.value || '—'}</span>
                                {stat.asOf && (
                                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 1 }}>
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
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#93c5fd' }}>{sub.title}</div>
                          {sub.date && (
                            <div style={{ fontSize: 13, color: '#94a3b8', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 4, padding: '1px 5px' }}>
                              {new Date(sub.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#8899b0', lineHeight: 1.4 }}>{sub.description}</div>
                      </div>
                    ))}

                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Connections</div>
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
                              marginBottom: 4, fontSize: 13, color: '#94a3b8',
                            }}>
                              <span style={{ fontSize: 12 }}>{other.icon}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{other.name}</span>
                              <span style={{ fontSize: 13, color: rel.color, flexShrink: 0 }}>
                                {isFrom ? '→' : '←'} {rel.label || 'connected'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
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
            <div style={{ fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Display Size
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Entities</span>
                <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>{Math.round(entitySizeMult * 100)}%</span>
              </div>
              <input type="range" min={0.4} max={2.5} step={0.05} value={entitySizeMult}
                onChange={(e) => onEntitySizeChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Arrows</span>
                <span style={{ fontSize: 13, color: '#06b6d4', fontWeight: 600 }}>{Math.round(arrowSizeMult * 100)}%</span>
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
                  color: '#94a3b8', fontSize: 14, cursor: 'pointer', transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#94a3b8')}
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
      <span style={{ fontSize: 14, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#94a3b8', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
