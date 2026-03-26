'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import {
  Shield, Users, RefreshCw, LogIn, ChevronDown, Check,
  Database, User, LayoutTemplate, Plus, Trash2, Eye, EyeOff, X,
} from 'lucide-react';
import Link from 'next/link';

const ADMIN_EMAILS = ['minjune043010@gmail.com'];

interface DashboardUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  lastLogin: string | null;
  savedMaps: number;
}

interface AdminTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type DashTab = 'users' | 'templates';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [dashTab, setDashTab] = useState<DashTab>('users');

  // ── Users state ──
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Templates state ──
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('markets');
  const [uploadData, setUploadData] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard/users');
      if (!res.ok) {
        const e = await res.json();
        setError(e.error || 'Failed to load');
      } else {
        setUsers(await res.json());
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const res = await fetch('/api/admin/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
      } else {
        setTemplatesError('Failed to load templates');
      }
    } catch {
      setTemplatesError('Network error');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && dashTab === 'templates') fetchTemplates();
  }, [isAdmin, dashTab, fetchTemplates]);

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/dashboard/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpload = async () => {
    setUploadError('');
    if (!uploadName.trim()) { setUploadError('Title is required'); return; }
    if (!uploadData.trim()) { setUploadError('Map JSON is required'); return; }
    try { JSON.parse(uploadData); } catch { setUploadError('Invalid JSON — paste the full map code'); return; }
    setUploading(true);
    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: uploadName.trim(),
          description: uploadDescription.trim(),
          category: uploadCategory.trim() || 'custom',
          data: uploadData,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error || 'Upload failed'); return; }
      setShowUploadForm(false);
      setUploadName(''); setUploadDescription(''); setUploadCategory('markets'); setUploadData('');
      fetchTemplates();
    } catch {
      setUploadError('Network error');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (template: AdminTemplate) => {
    setTogglingId(template.id);
    try {
      const res = await fetch(`/api/admin/templates?id=${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      if (res.ok) {
        setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, isActive: !t.isActive } : t));
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/templates?id=${id}`, { method: 'DELETE' });
      if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  // ── Not signed in ──
  if (status === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={{ color: '#475569', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <Shield size={36} style={{ color: '#3b82f6', marginBottom: 12 }} />
          <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Admin Dashboard</h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Sign in with an authorized account to access this page.</p>
          <button onClick={() => signIn('google')} style={btnStyle}>
            <LogIn size={15} /> Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, maxWidth: 440, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            {session.user?.image
              ? <img src={session.user.image} alt="" style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid rgba(6,182,212,0.4)' }} />
              : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#06b6d4' }}>
                  {(session.user?.name || session.user?.email || '?')[0].toUpperCase()}
                </div>
            }
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>{session.user?.name || 'User'}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{session.user?.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <User size={13} style={{ color: '#06b6d4' }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>Role</span>
            <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 8px', background: 'rgba(100,116,139,0.2)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}>
              member
            </span>
          </div>
          <div style={{ borderTop: '1px solid rgba(59,130,246,0.12)', paddingTop: 16, fontSize: 12, color: '#475569' }}>
            You are signed in. Admin access is required to view the full dashboard.
          </div>
        </div>
      </div>
    );
  }

  // ── Admin view ──
  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={24} style={{ color: '#3b82f6' }} />
            <div>
              <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, margin: 0 }}>Admin Dashboard</h1>
              <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>Signed in as {session.user?.email}</div>
            </div>
          </div>
          <button
            onClick={dashTab === 'users' ? fetchUsers : fetchTemplates}
            disabled={loading || templatesLoading}
            style={{ ...btnStyle, padding: '7px 14px' }}
          >
            <RefreshCw size={13} style={{ animation: (loading || templatesLoading) ? 'spin 1s linear infinite' : 'none' }} />
            {(loading || templatesLoading) ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
          {([
            { id: 'users', label: 'Users', icon: <Users size={14} /> },
            { id: 'templates', label: 'Templates', icon: <LayoutTemplate size={14} /> },
          ] as { id: DashTab; label: string; icon: React.ReactNode }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDashTab(tab.id)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none',
                borderBottom: `2px solid ${dashTab === tab.id ? '#3b82f6' : 'transparent'}`,
                color: dashTab === tab.id ? '#3b82f6' : '#475569',
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { if (dashTab !== tab.id) (e.currentTarget as HTMLElement).style.color = '#93c5fd'; }}
              onMouseLeave={(e) => { if (dashTab !== tab.id) (e.currentTarget as HTMLElement).style.color = '#475569'; }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <Link href="/dashboard/database" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#475569', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <Database size={14} /> Database
          </Link>
        </div>

        {/* ── USERS TAB ── */}
        {dashTab === 'users' && (
          <>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Total Users', value: users.length },
                { label: 'Admins', value: users.filter((u) => u.role === 'admin').length },
                { label: 'Total Saved Maps', value: users.reduce((s, u) => s + u.savedMaps, 0) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#93c5fd' }}>{value}</div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} style={{ color: '#3b82f6' }} />
                <span style={{ color: '#93c5fd', fontWeight: 600, fontSize: 14 }}>Users ({users.length})</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(59,130,246,0.1)' }}>
                      {['User', 'Email', 'Role', 'Saved Maps', 'Joined', 'Last Login', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid rgba(59,130,246,0.07)', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {user.image
                              ? <img src={user.image} alt="" style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(59,130,246,0.3)' }} />
                              : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd', fontWeight: 700, fontSize: 13 }}>
                                  {(user.name || user.email)[0].toUpperCase()}
                                </div>
                            }
                            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{user.name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{user.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '3px 8px', background: user.role === 'admin' ? 'rgba(59,130,246,0.2)' : 'rgba(100,116,139,0.2)', color: user.role === 'admin' ? '#93c5fd' : '#94a3b8', border: `1px solid ${user.role === 'admin' ? 'rgba(59,130,246,0.4)' : 'rgba(100,116,139,0.3)'}` }}>
                            {user.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', textAlign: 'center' }}>{user.savedMaps}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {user.role !== 'admin' ? (
                              <button onClick={() => handleRoleChange(user.id, 'admin')} disabled={updatingId === user.id} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 7, cursor: 'pointer', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {updatingId === user.id ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={10} />}
                                Make Admin
                              </button>
                            ) : (
                              user.email !== session.user?.email && (
                                <button onClick={() => handleRoleChange(user.id, 'user')} disabled={updatingId === user.id} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 7, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {updatingId === user.id ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <ChevronDown size={10} />}
                                  Revoke Admin
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#334155' }}>No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── TEMPLATES TAB ── */}
        {dashTab === 'templates' && (
          <>
            {/* Stats + action row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: 'Total Templates', value: templates.length },
                  { label: 'Active', value: templates.filter((t) => t.isActive).length },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '12px 20px', minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#93c5fd' }}>{value}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setShowUploadForm(true); setUploadError(''); }}
                style={{ ...btnStyle, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.4)', color: '#06b6d4' }}
              >
                <Plus size={14} /> Upload Template
              </button>
            </div>

            {/* Upload form */}
            {showUploadForm && (
              <div style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ color: '#06b6d4', fontWeight: 600, fontSize: 14 }}>Upload New Template</span>
                  <button onClick={() => setShowUploadForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Display Title *</label>
                    <input
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="e.g. NASDAQ-100 & S&P 500 — Market Universe"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <input
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      placeholder="markets / geopolitics / custom"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Description</label>
                  <input
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Short description shown on the template card…"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Map JSON Code *</label>
                  <textarea
                    value={uploadData}
                    onChange={(e) => setUploadData(e.target.value)}
                    placeholder={'Paste the full map JSON here…\n\nTip: open your map → More options → Export → copy the JSON'}
                    rows={10}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
                  />
                </div>

                {uploadError && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: 12, marginBottom: 12 }}>
                    {uploadError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowUploadForm(false)} style={{ ...btnStyle, background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.25)', color: '#64748b' }}>
                    Cancel
                  </button>
                  <button onClick={handleUpload} disabled={uploading} style={{ ...btnStyle, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.4)', color: '#06b6d4' }}>
                    {uploading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
            )}

            {templatesError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
                {templatesError}
              </div>
            )}

            {/* Templates list */}
            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <LayoutTemplate size={16} style={{ color: '#3b82f6' }} />
                <span style={{ color: '#93c5fd', fontWeight: 600, fontSize: 14 }}>Market Templates ({templates.length})</span>
              </div>

              {templatesLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>
              ) : templates.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#334155', fontSize: 13 }}>
                  No templates yet. Click &quot;Upload Template&quot; to add one.
                </div>
              ) : (
                <div>
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 20px', borderBottom: '1px solid rgba(59,130,246,0.07)',
                        opacity: tmpl.isActive ? 1 : 0.5, transition: 'opacity 0.15s',
                      }}
                    >
                      {/* Category badge */}
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>
                        {tmpl.category}
                      </span>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tmpl.name}
                          {!tmpl.isActive && <span style={{ marginLeft: 8, fontSize: 10, color: '#64748b', fontWeight: 400 }}>hidden from users</span>}
                        </div>
                        {tmpl.description && (
                          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tmpl.description}
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      <span style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>
                        {new Date(tmpl.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => handleToggleActive(tmpl)}
                          disabled={togglingId === tmpl.id}
                          title={tmpl.isActive ? 'Hide from users' : 'Show to users'}
                          style={{ padding: '5px 10px', fontSize: 11, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: tmpl.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', border: `1px solid ${tmpl.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.3)'}`, color: tmpl.isActive ? '#4ade80' : '#64748b' }}
                        >
                          {togglingId === tmpl.id
                            ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                            : tmpl.isActive ? <Eye size={11} /> : <EyeOff size={11} />
                          }
                          {tmpl.isActive ? 'Active' : 'Hidden'}
                        </button>
                        <button
                          onClick={() => handleDelete(tmpl.id)}
                          disabled={deletingId === tmpl.id}
                          title="Delete template"
                          style={{ padding: '5px 8px', fontSize: 11, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                        >
                          {deletingId === tmpl.id ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#030712',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'system-ui, sans-serif',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(59,130,246,0.2)',
  borderRadius: 16, padding: '36px 40px', textAlign: 'center', maxWidth: 380,
};

const btnStyle: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)',
  color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 7,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
  borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#475569', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
};
