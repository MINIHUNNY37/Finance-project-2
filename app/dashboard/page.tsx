'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Shield, Users, RefreshCw, LogIn, ChevronDown, Check, Database } from 'lucide-react';
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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

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
          <button
            onClick={() => signIn('google')}
            style={btnStyle}
          >
            <LogIn size={15} />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <Shield size={36} style={{ color: '#ef4444', marginBottom: 12 }} />
          <h2 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Access Denied</h2>
          <p style={{ color: '#64748b', fontSize: 13 }}>
            Your account (<strong style={{ color: '#94a3b8' }}>{session.user?.email}</strong>) does not have admin permissions.
          </p>
        </div>
      </div>
    );
  }

  // ── Admin view ──
  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={24} style={{ color: '#3b82f6' }} />
            <div>
              <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700, margin: 0 }}>Admin Dashboard</h1>
              <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>Signed in as {session.user?.email}</div>
            </div>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            style={{ ...btnStyle, padding: '7px 14px' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid rgba(59,130,246,0.12)', paddingBottom: 0 }}>
          <div style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#3b82f6', borderBottom: '2px solid #3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} /> Users
          </div>
          <Link href="/dashboard/database" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#475569', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <Database size={14} /> Database
          </Link>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total Users', value: users.length },
            { label: 'Admins', value: users.filter((u) => u.role === 'admin').length },
            { label: 'Total Saved Maps', value: users.reduce((s, u) => s + u.savedMaps, 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#93c5fd' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Users table */}
        <div style={{
          background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(59,130,246,0.15)',
          borderRadius: 14, overflow: 'hidden',
        }}>
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
                    {/* User */}
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
                    {/* Email */}
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{user.email}</td>
                    {/* Role badge */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '3px 8px',
                        background: user.role === 'admin' ? 'rgba(59,130,246,0.2)' : 'rgba(100,116,139,0.2)',
                        color: user.role === 'admin' ? '#93c5fd' : '#94a3b8',
                        border: `1px solid ${user.role === 'admin' ? 'rgba(59,130,246,0.4)' : 'rgba(100,116,139,0.3)'}`,
                      }}>
                        {user.role}
                      </span>
                    </td>
                    {/* Saved maps */}
                    <td style={{ padding: '12px 16px', color: '#64748b', textAlign: 'center' }}>{user.savedMaps}</td>
                    {/* Joined */}
                    <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    {/* Last login */}
                    <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {user.role !== 'admin' ? (
                          <button
                            onClick={() => handleRoleChange(user.id, 'admin')}
                            disabled={updatingId === user.id}
                            style={{
                              padding: '4px 10px', fontSize: 11, borderRadius: 7, cursor: 'pointer',
                              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                              color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {updatingId === user.id ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={10} />}
                            Make Admin
                          </button>
                        ) : (
                          user.email !== session.user?.email && (
                            <button
                              onClick={() => handleRoleChange(user.id, 'user')}
                              disabled={updatingId === user.id}
                              style={{
                                padding: '4px 10px', fontSize: 11, borderRadius: 7, cursor: 'pointer',
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                                color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
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
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#334155' }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
