'use client';

import { TrendingUp } from 'lucide-react';

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #0c1f3d 50%, #071224 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(26,39,68,0.9)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 20,
        padding: 40,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(59,130,246,0.4)',
          }}>
            <TrendingUp size={24} color="white" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>StockMapper</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Scenario Planner</div>
          </div>
        </div>

        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 36, lineHeight: 1.6, marginTop: 16 }}>
          Visually map how companies operate and test investment scenarios on an interactive world map.
        </p>

        {/* Google Sign In */}
        <form action="/api/auth/signin/google" method="POST">
          <input type="hidden" name="callbackUrl" value="/" />
          <button
            type="submit"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '13px 20px',
              background: 'white',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              color: '#1f2937',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              marginBottom: 16,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'none';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
            }}
          >
            {/* Google SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </form>

        {/* Continue without auth */}
        <a
          href="/"
          style={{
            display: 'block',
            color: '#475569',
            fontSize: 13,
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#94a3b8')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#475569')}
        >
          Continue without signing in →
        </a>

        {/* Features */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(59,130,246,0.15)', textAlign: 'left' }}>
          {[
            '🗺️ Interactive world map canvas',
            '🏢 Visual company entity builder',
            '🔗 Relationship mapping with arrows',
            '📁 Organize with folders',
            '🔗 Share maps with colleagues',
          ].map((feature) => (
            <div key={feature} style={{ fontSize: 12, color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
