'use client';

import React, { useState } from 'react';
import { X, Copy, Share2, Check, Link, Code, Download } from 'lucide-react';
import { useMapStore } from '../store/mapStore';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareDialog({ isOpen, onClose }: ShareDialogProps) {
  const { currentMap, generateShareToken, saveCurrentMap } = useMapStore();
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [shareEmails, setShareEmails] = useState<string[]>([]);

  if (!isOpen) return null;

  const shareUrl = currentMap.shareToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${currentMap.shareToken}`
    : null;

  const handleGenerateLink = () => {
    generateShareToken();
    saveCurrentMap();
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddEmail = () => {
    if (email.trim() && !shareEmails.includes(email.trim())) {
      setShareEmails([...shareEmails, email.trim()]);
      setEmail('');
    }
  };

  // Generate a compact code that encodes all map data
  const handleCopyMapCode = () => {
    try {
      const code = btoa(encodeURIComponent(JSON.stringify(currentMap)));
      navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Export as JSON
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(currentMap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentMap.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="glass-panel fade-in"
        style={{ width: '100%', maxWidth: 460, borderRadius: 16, padding: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Share2 size={18} style={{ color: '#06b6d4' }} />
            <h2 style={{ color: '#93c5fd', fontSize: 18, fontWeight: 700 }}>Share Map</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0' }}>
            <X size={20} />
          </button>
        </div>

        {/* Map info */}
        <div style={{ marginBottom: 20, padding: 12, background: 'rgba(15,23,42,0.5)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{currentMap.name}</div>
          <div style={{ fontSize: 12, color: '#8899b0' }}>
            {currentMap.entities.length} entities · {currentMap.relationships.length} connections · {currentMap.folders.length} folders
          </div>
        </div>

        {/* Map Code — portable snapshot */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Map Code
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 }}>
            Copy this code and paste it in any Plotifolio session to import a full copy of this map.
          </div>
          <button
            className="btn-primary"
            onClick={handleCopyMapCode}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {codeCopied ? <Check size={14} /> : <Code size={14} />}
            {codeCopied ? 'Code Copied!' : 'Copy Map Code'}
          </button>
        </div>

        {/* Shareable link */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Shareable Link
          </div>
          {shareUrl ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                flex: 1,
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#93c5fd',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {shareUrl}
              </div>
              <button
                className="btn-primary"
                onClick={handleCopy}
                style={{ padding: '8px 12px', flexShrink: 0 }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          ) : (
            <button className="btn-ghost" onClick={handleGenerateLink} style={{ width: '100%' }}>
              <Link size={14} style={{ display: 'inline', marginRight: 6 }} />
              Generate Share Link
            </button>
          )}
        </div>

        {/* Share with emails (UI only - would need backend) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Invite by Email
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
            />
            <button className="btn-primary" onClick={handleAddEmail} style={{ padding: '8px 12px', flexShrink: 0, fontSize: 12 }}>
              Add
            </button>
          </div>
          {shareEmails.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {shareEmails.map((em) => (
                <div key={em} style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  color: '#93c5fd',
                }}>
                  {em}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <div style={{ borderTop: '1px solid rgba(59,130,246,0.15)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Export
          </div>
          <button className="btn-ghost" onClick={handleExportJSON} style={{ width: '100%', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Download size={13} />
            Download as JSON
          </button>
        </div>
      </div>
    </div>
  );
}
