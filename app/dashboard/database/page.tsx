'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import {
  Shield, LogIn, Database, Plus, Trash2, RefreshCw,
  ChevronRight, Save, Zap, GripVertical, Key, Link2,
  AlertCircle, CheckCircle2, X, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['minjune043010@gmail.com'];

type DataType = 'TEXT' | 'NUMERIC' | 'INTEGER' | 'BOOLEAN' | 'TIMESTAMPTZ';
const DATA_TYPES: DataType[] = ['TEXT', 'NUMERIC', 'INTEGER', 'BOOLEAN', 'TIMESTAMPTZ'];
const TYPE_LABELS: Record<DataType, string> = {
  TEXT: 'Text', NUMERIC: 'Numeric', INTEGER: 'Integer', BOOLEAN: 'Boolean', TIMESTAMPTZ: 'Timestamp',
};
const TYPE_COLORS: Record<DataType, string> = {
  TEXT: '#06b6d4', NUMERIC: '#a78bfa', INTEGER: '#34d399', BOOLEAN: '#fbbf24', TIMESTAMPTZ: '#f87171',
};

interface ColumnDef {
  id:           string;
  tableId:      string;
  columnName:   string;
  displayName:  string;
  dataType:     DataType;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignTable: string | null;
  isNullable:   boolean;
  position:     number;
}

interface TableSchema {
  id:          string;
  tableName:   string;
  displayName: string;
  description: string | null;
  createdAt:   string;
  updatedAt:   string;
  columns:     ColumnDef[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSnakeCase(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function newColId() {
  return `col_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 7px',
      background: `${color}22`, color, border: `1px solid ${color}55`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {children}
    </span>
  );
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
      borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
      color: ok ? '#34d399' : '#f87171', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {msg}
    </div>
  );
}

// ─── Column row editor ────────────────────────────────────────────────────────

interface ColRowProps {
  col:        ColumnDef;
  tables:     TableSchema[];
  onChange:   (updated: ColumnDef) => void;
  onDelete:   () => void;
  dragHandle: React.HTMLAttributes<HTMLDivElement>;
}

function ColumnRow({ col, tables, onChange, onDelete, dragHandle }: ColRowProps) {
  const set = (patch: Partial<ColumnDef>) => onChange({ ...col, ...patch });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '20px 1fr 1fr 110px 80px 80px 80px 28px',
      gap: 8, alignItems: 'center',
      padding: '8px 10px', borderRadius: 8,
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid rgba(59,130,246,0.1)',
      marginBottom: 6,
    }}>
      {/* drag handle */}
      <div {...dragHandle} style={{ cursor: 'grab', color: '#334155' }}>
        <GripVertical size={14} />
      </div>

      {/* Display name */}
      <input
        value={col.displayName}
        onChange={e => {
          const displayName = e.target.value;
          set({ displayName, columnName: col.isPrimaryKey ? col.columnName : toSnakeCase(displayName) });
        }}
        placeholder="Display Name"
        style={inputSm}
      />

      {/* SQL column name */}
      <input
        value={col.columnName}
        onChange={e => set({ columnName: e.target.value })}
        placeholder="sql_name"
        style={{ ...inputSm, fontFamily: 'monospace', color: '#94a3b8' }}
      />

      {/* Data type */}
      <select
        value={col.dataType}
        onChange={e => set({ dataType: e.target.value as DataType })}
        style={{ ...inputSm, color: TYPE_COLORS[col.dataType] }}
      >
        {DATA_TYPES.map(t => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
      </select>

      {/* PK toggle */}
      <button
        onClick={() => set({ isPrimaryKey: !col.isPrimaryKey, isNullable: col.isPrimaryKey ? true : false })}
        title="Primary Key"
        style={{
          ...toggleBtn,
          background: col.isPrimaryKey ? 'rgba(251,191,36,0.15)' : 'transparent',
          border: `1px solid ${col.isPrimaryKey ? 'rgba(251,191,36,0.5)' : 'rgba(59,130,246,0.15)'}`,
          color: col.isPrimaryKey ? '#fbbf24' : '#334155',
        }}
      >
        <Key size={11} /> PK
      </button>

      {/* FK toggle */}
      <button
        onClick={() => set({ isForeignKey: !col.isForeignKey, foreignTable: col.isForeignKey ? null : col.foreignTable })}
        title="Foreign Key"
        style={{
          ...toggleBtn,
          background: col.isForeignKey ? 'rgba(167,139,250,0.15)' : 'transparent',
          border: `1px solid ${col.isForeignKey ? 'rgba(167,139,250,0.5)' : 'rgba(59,130,246,0.15)'}`,
          color: col.isForeignKey ? '#a78bfa' : '#334155',
        }}
      >
        <Link2 size={11} /> FK
      </button>

      {/* FK target or nullable */}
      {col.isForeignKey ? (
        <select
          value={col.foreignTable ?? ''}
          onChange={e => set({ foreignTable: e.target.value || null })}
          style={{ ...inputSm, fontSize: 10 }}
        >
          <option value="">— table —</option>
          {tables.map(t => (
            <option key={t.id} value={t.tableName}>{t.displayName}</option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => set({ isNullable: !col.isNullable })}
          title="Nullable"
          style={{
            ...toggleBtn,
            background: col.isNullable ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${col.isNullable ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: col.isNullable ? '#34d399' : '#f87171',
          }}
        >
          {col.isNullable ? 'NULL' : 'NOT NULL'}
        </button>
      )}

      {/* Delete */}
      <button onClick={onDelete} style={{ ...toggleBtn, color: '#475569' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Table editor panel ───────────────────────────────────────────────────────

interface EditorPanelProps {
  schema:    TableSchema;
  tables:    TableSchema[];
  onSaved:   (updated: TableSchema) => void;
  onDeleted: (id: string) => void;
}

function EditorPanel({ schema, tables, onSaved, onDeleted }: EditorPanelProps) {
  const [displayName, setDisplayName] = useState(schema.displayName);
  const [tableName,   setTableName]   = useState(schema.tableName);
  const [description, setDescription] = useState(schema.description ?? '');
  const [columns,     setColumns]     = useState<ColumnDef[]>(schema.columns);
  const [saving,      setSaving]      = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [syncLog,     setSyncLog]     = useState<string[]>([]);
  const dragIdx = useRef<number | null>(null);

  // Reset when schema changes
  useEffect(() => {
    setDisplayName(schema.displayName);
    setTableName(schema.tableName);
    setDescription(schema.description ?? '');
    setColumns(schema.columns);
    setSyncLog([]);
  }, [schema.id]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function addColumn() {
    const id = newColId();
    setColumns(prev => [...prev, {
      id, tableId: schema.id, columnName: 'new_column', displayName: 'New Column',
      dataType: 'TEXT', isPrimaryKey: false, isForeignKey: false, foreignTable: null,
      isNullable: true, position: prev.length,
    }]);
  }

  function updateColumn(idx: number, updated: ColumnDef) {
    setColumns(prev => prev.map((c, i) => i === idx ? updated : c));
  }

  function deleteColumn(idx: number) {
    setColumns(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, position: i })));
  }

  // Simple drag-and-drop
  function onDragStart(idx: number) { dragIdx.current = idx; }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) return;
    setColumns(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(idx, 0, item);
      dragIdx.current = idx;
      return arr.map((c, i) => ({ ...c, position: i }));
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/db/schemas/${schema.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, tableName, description, columns }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json() as TableSchema;
      onSaved(updated);
      showToast('Schema saved', true);
    } catch (e: unknown) {
      showToast(`Save failed: ${e instanceof Error ? e.message : String(e)}`, false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncLog([]);
    try {
      const res = await fetch(`/api/db/schemas/${schema.id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncLog(data.operations ?? []);
      showToast('Synced to Neon DB', true);
    } catch (e: unknown) {
      showToast(`Sync failed: ${e instanceof Error ? e.message : String(e)}`, false);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${schema.displayName}" schema? This does NOT drop the actual Neon table.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/db/schemas/${schema.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      onDeleted(schema.id);
    } catch (e: unknown) {
      showToast(`Delete failed: ${e instanceof Error ? e.message : String(e)}`, false);
      setDeleting(false);
    }
  }

  const otherTables = tables.filter(t => t.id !== schema.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Editing table</div>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{schema.displayName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{ ...actionBtn, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }}>
            {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
            Save
          </button>
          <button onClick={handleSync} disabled={syncing} style={{ ...actionBtn, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399' }}>
            {syncing ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />}
            Sync to Neon
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{ ...actionBtn, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
            {deleting ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
            Delete
          </button>
        </div>
      </div>

      {/* Sync log */}
      {syncLog.length > 0 && (
        <div style={{ padding: '10px 20px', background: 'rgba(16,185,129,0.06)', borderBottom: '1px solid rgba(16,185,129,0.15)' }}>
          {syncLog.map((line, i) => (
            <div key={i} style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <CheckCircle2 size={11} /> {line}
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Table metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Display Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputMd} placeholder="e.g. Stock Info" />
          </div>
          <div>
            <label style={labelStyle}>SQL Table Name</label>
            <input
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              style={{ ...inputMd, fontFamily: 'monospace', color: '#94a3b8' }}
              placeholder="e.g. fin_stock_info"
            />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} style={inputMd} placeholder="Optional description" />
          </div>
        </div>

        {/* Column list header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Columns ({columns.length})
          </div>
          <button onClick={addColumn} style={{ ...actionBtn, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
            <Plus size={12} /> Add Column
          </button>
        </div>

        {/* Column header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '20px 1fr 1fr 110px 80px 80px 80px 28px',
          gap: 8, padding: '4px 10px', marginBottom: 4,
        }}>
          {['', 'Display Name', 'SQL Name', 'Type', 'PK', 'FK', 'Nullable', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {/* Column rows */}
        {columns.map((col, idx) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={e => onDragOver(e, idx)}
          >
            <ColumnRow
              col={col}
              tables={otherTables}
              onChange={updated => updateColumn(idx, updated)}
              onDelete={() => deleteColumn(idx)}
              dragHandle={{ style: { cursor: 'grab' } }}
            />
          </div>
        ))}

        {columns.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#334155', fontSize: 13 }}>
            No columns yet. Click "Add Column" to get started.
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DatabaseDashboardPage() {
  const { data: session, status } = useSession();
  const [tables,     setTables]     = useState<TableSchema[]>([]);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [initing,    setIniting]    = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);
  const [newDialog,  setNewDialog]  = useState(false);
  const [newDisplay, setNewDisplay] = useState('');
  const [newTable,   setNewTable]   = useState('');
  const [creating,   setCreating]   = useState(false);

  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/db/schemas');
      if (res.ok) setTables(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleInit() {
    setIniting(true);
    try {
      const res = await fetch('/api/db/init', { method: 'POST' });
      const data = await res.json();
      if (data.created?.length) {
        showToast(`Initialized: ${data.created.join(', ')}`, true);
        await fetchTables();
      } else {
        showToast('Default tables already exist', true);
      }
    } catch {
      showToast('Init failed', false);
    } finally {
      setIniting(false);
    }
  }

  async function handleSyncAll() {
    setSyncing(true);
    try {
      // Sync in order: stock_info first (FK deps)
      const ordered = [...tables].sort((a, b) =>
        a.tableName === 'fin_stock_info' ? -1 : b.tableName === 'fin_stock_info' ? 1 : 0
      );
      const allOps: string[] = [];
      for (const t of ordered) {
        const res = await fetch(`/api/db/schemas/${t.id}/sync`, { method: 'POST' });
        const data = await res.json();
        if (data.operations) allOps.push(...data.operations);
      }
      showToast(`Synced all tables (${allOps.length} ops)`, true);
    } catch {
      showToast('Sync all failed', false);
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreate() {
    if (!newDisplay.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/db/schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: newDisplay.trim(),
          tableName:   newTable.trim() || `fin_${toSnakeCase(newDisplay)}`,
          columns:     [],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json() as TableSchema;
      setTables(prev => [...prev, created]);
      setSelected(created.id);
      setNewDialog(false);
      setNewDisplay('');
      setNewTable('');
    } catch (e: unknown) {
      showToast(`Create failed: ${e instanceof Error ? e.message : String(e)}`, false);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (isAdmin) fetchTables();
  }, [isAdmin, fetchTables]);

  const selectedSchema = tables.find(t => t.id === selected) ?? null;

  // ── Auth guards ──────────────────────────────────────────────────────────

  if (status === 'loading') {
    return <div style={centerPage}><div style={{ color: '#475569', fontSize: 14 }}>Loading…</div></div>;
  }
  if (!session) {
    return (
      <div style={centerPage}>
        <div style={cardStyle}>
          <Shield size={36} style={{ color: '#3b82f6', marginBottom: 12 }} />
          <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Admin Only</h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Sign in with an authorized account.</p>
          <button onClick={() => signIn('google')} style={btnBlue}>
            <LogIn size={15} /> Sign in with Google
          </button>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div style={centerPage}>
        <div style={cardStyle}>
          <Shield size={36} style={{ color: '#ef4444', marginBottom: 12 }} />
          <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Access Denied</h2>
          <p style={{ color: '#64748b', fontSize: 13 }}>
            <strong style={{ color: '#94a3b8' }}>{session.user?.email}</strong> does not have admin access.
          </p>
        </div>
      </div>
    );
  }

  // ── Admin view ───────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#030712', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid rgba(59,130,246,0.15)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(15,23,42,0.6)' }}>
        <Link href="/dashboard" style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
        >
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ width: 1, height: 18, background: 'rgba(59,130,246,0.2)' }} />
        <Database size={16} style={{ color: '#3b82f6' }} />
        <div>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>Database Manager</span>
          <span style={{ color: '#334155', fontSize: 12, marginLeft: 10 }}>Neon PostgreSQL</span>
        </div>
        <div style={{ flex: 1 }} />
        {/* Nav tabs */}
        <Link href="/dashboard" style={{ ...navTab, color: '#475569' }}>Users</Link>
        <div style={{ ...navTab, color: '#3b82f6', borderBottom: '2px solid #3b82f6' }}>Database</div>
        <div style={{ width: 1, height: 18, background: 'rgba(59,130,246,0.2)' }} />
        <button onClick={handleInit} disabled={initing} style={{ ...actionBtn, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
          {initing ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Database size={12} />}
          Init Defaults
        </button>
        <button onClick={handleSyncAll} disabled={syncing || tables.length === 0} style={{ ...actionBtn, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
          {syncing ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} />}
          Sync All
        </button>
        <button onClick={fetchTables} disabled={loading} style={{ ...actionBtn, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd' }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar – table list */}
        <div style={{
          width: 240, borderRight: '1px solid rgba(59,130,246,0.12)',
          background: 'rgba(15,23,42,0.5)', display: 'flex', flexDirection: 'column',
        }}>
          {/* Sidebar header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tables ({tables.length})
            </span>
            <button onClick={() => setNewDialog(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 2 }}>
              <Plus size={15} />
            </button>
          </div>

          {/* Table list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            {loading && tables.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#334155', fontSize: 12 }}>Loading…</div>
            )}
            {!loading && tables.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#334155', fontSize: 12 }}>
                No tables yet.<br />
                <button onClick={handleInit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 12, marginTop: 8 }}>
                  Init default tables
                </button>
              </div>
            )}
            {tables.map(t => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                  background: selected === t.id ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: `1px solid ${selected === t.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                  cursor: 'pointer', marginBottom: 4, transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (selected !== t.id) e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; }}
                onMouseLeave={e => { if (selected !== t.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: selected === t.id ? '#93c5fd' : '#e2e8f0', fontWeight: 600, fontSize: 13 }}>
                    {t.displayName}
                  </span>
                  <ChevronRight size={13} style={{ color: '#334155' }} />
                </div>
                <div style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', marginTop: 3 }}>
                  {t.tableName}
                </div>
                <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Badge color="#475569">{t.columns.length} cols</Badge>
                  {t.columns.some(c => c.isPrimaryKey) && <Badge color="#fbbf24">PK</Badge>}
                  {t.columns.some(c => c.isForeignKey) && <Badge color="#a78bfa">FK</Badge>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel – editor */}
        <div style={{ flex: 1, overflow: 'hidden', background: 'rgba(3,7,18,0.8)' }}>
          {selectedSchema ? (
            <EditorPanel
              key={selectedSchema.id}
              schema={selectedSchema}
              tables={tables}
              onSaved={updated => setTables(prev => prev.map(t => t.id === updated.id ? updated : t))}
              onDeleted={id => {
                setTables(prev => prev.filter(t => t.id !== id));
                setSelected(null);
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155' }}>
              <Database size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Select a table to edit its schema</div>
              <div style={{ fontSize: 13, color: '#1e293b', maxWidth: 320, textAlign: 'center' }}>
                Click any table in the sidebar, or initialize the default 4 finance tables with &ldquo;Init Defaults&rdquo;.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New table dialog */}
      {newDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setNewDialog(false)}>
          <div style={{
            background: 'rgba(10,17,34,0.98)', border: '1px solid rgba(59,130,246,0.35)',
            borderRadius: 14, padding: '24px 28px', minWidth: 340,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16, marginBottom: 18 }}>New Table</h3>
            <label style={labelStyle}>Display Name</label>
            <input
              value={newDisplay}
              onChange={e => {
                setNewDisplay(e.target.value);
                setNewTable(`fin_${toSnakeCase(e.target.value)}`);
              }}
              placeholder="e.g. Momentum"
              style={{ ...inputMd, marginBottom: 12 }}
              autoFocus
            />
            <label style={labelStyle}>SQL Table Name</label>
            <input
              value={newTable}
              onChange={e => setNewTable(e.target.value)}
              placeholder="fin_momentum"
              style={{ ...inputMd, fontFamily: 'monospace', color: '#94a3b8', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setNewDialog(false)} style={{ ...actionBtn, color: '#64748b', border: '1px solid rgba(100,116,139,0.3)' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating || !newDisplay.trim()} style={{ ...actionBtn, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }}>
                {creating ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #0f172a; color: #e2e8f0; }
      `}</style>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const centerPage: React.CSSProperties = {
  minHeight: '100vh', background: '#030712',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'system-ui, sans-serif',
};
const cardStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(59,130,246,0.2)',
  borderRadius: 16, padding: '36px 40px', textAlign: 'center', maxWidth: 380,
};
const btnBlue: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)',
  color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 7,
};
const actionBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 500,
  background: 'transparent', border: '1px solid transparent',
  display: 'flex', alignItems: 'center', gap: 5,
};
const navTab: React.CSSProperties = {
  padding: '6px 12px', fontSize: 13, fontWeight: 500,
  textDecoration: 'none', borderBottom: '2px solid transparent',
  display: 'inline-flex', alignItems: 'center',
};
const inputSm: React.CSSProperties = {
  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.15)',
  borderRadius: 6, padding: '5px 8px', color: '#e2e8f0', fontSize: 12, width: '100%',
  outline: 'none',
};
const inputMd: React.CSSProperties = {
  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
  borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, width: '100%',
  boxSizing: 'border-box', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#475569', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
};
const toggleBtn: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600,
  border: '1px solid transparent', background: 'transparent',
  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
};
