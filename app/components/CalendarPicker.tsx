'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMapStore } from '../store/mapStore';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type View = 'year' | 'month' | 'day';

export default function CalendarPicker() {
  const { globalViewDate, setGlobalViewDate } = useMapStore();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('year');
  const [draftYear, setDraftYear] = useState<number | null>(null);
  const [draftMonth, setDraftMonth] = useState<number | null>(null);
  const [yearPage, setYearPage] = useState(0); // which page of years
  const panelRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const currentYear = today.getFullYear();
  const selectedDate = globalViewDate ? new Date(globalViewDate + 'T00:00:00') : null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    // Reset drill-down to year view
    setView('year');
    setDraftYear(selectedDate?.getFullYear() ?? null);
    setDraftMonth(selectedDate ? selectedDate.getMonth() : null);
    setYearPage(0);
    setOpen((v) => !v);
  };

  const handleSelectYear = (y: number) => {
    setDraftYear(y);
    setView('month');
  };

  const handleSelectMonth = (m: number) => {
    setDraftMonth(m);
    setView('day');
  };

  const handleSelectDay = (d: number) => {
    if (draftYear == null || draftMonth == null) return;
    const mm = String(draftMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    setGlobalViewDate(`${draftYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setGlobalViewDate(null);
  };

  // Year grid: 12 years per page
  const YEARS_PER_PAGE = 12;
  const baseYear = currentYear - (currentYear % YEARS_PER_PAGE) - yearPage * YEARS_PER_PAGE;
  const yearGrid = Array.from({ length: YEARS_PER_PAGE }, (_, i) => baseYear + i).reverse();

  // Day grid
  const daysInMonth = draftYear != null && draftMonth != null
    ? new Date(draftYear, draftMonth + 1, 0).getDate() : 31;
  const firstDow = draftYear != null && draftMonth != null
    ? new Date(draftYear, draftMonth, 1).getDay() : 0;

  const formatLabel = () => {
    if (!selectedDate) return null;
    return selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const label = formatLabel();

  return (
    <div style={{ position: 'relative', flexShrink: 0 }} ref={panelRef}>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        title="Set view date (time travel)"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          border: `1px solid ${globalViewDate ? '#f59e0b' : 'rgba(59,130,246,0.2)'}`,
          background: globalViewDate ? 'rgba(245,158,11,0.1)' : 'transparent',
          color: globalViewDate ? '#f59e0b' : '#475569',
          transition: 'all 0.15s',
        }}
      >
        <Calendar size={13} />
        <span>{label ?? 'View date'}</span>
        {globalViewDate && (
          <span
            onClick={handleClear}
            title="Clear date filter"
            style={{ display: 'flex', alignItems: 'center', marginLeft: 2, cursor: 'pointer', color: '#94a3b8' }}
          >
            <X size={11} />
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          width: 260, background: 'rgba(10,17,34,0.99)',
          border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
          zIndex: 600, padding: 14,
        }}>
          {/* ── YEAR VIEW ── */}
          {view === 'year' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>Select Year</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setYearPage((p) => p + 1)} style={navBtnStyle}><ChevronLeft size={13} /></button>
                  <button onClick={() => setYearPage((p) => Math.max(0, p - 1))} style={navBtnStyle}><ChevronRight size={13} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {yearGrid.map((y) => (
                  <button key={y} onClick={() => handleSelectYear(y)} style={{
                    ...cellStyle,
                    background: y === selectedDate?.getFullYear() ? 'rgba(59,130,246,0.25)' : y === draftYear ? 'rgba(59,130,246,0.12)' : 'transparent',
                    color: y === selectedDate?.getFullYear() ? '#93c5fd' : y > currentYear ? '#334155' : '#94a3b8',
                    border: y === currentYear ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  }}>
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── MONTH VIEW ── */}
          {view === 'month' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button onClick={() => setView('year')} style={{ ...navBtnStyle, gap: 4, paddingLeft: 2 }}>
                  <ChevronLeft size={13} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>{draftYear}</span>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {MONTHS.map((m, i) => (
                  <button key={m} onClick={() => handleSelectMonth(i)} style={{
                    ...cellStyle,
                    background: selectedDate?.getFullYear() === draftYear && selectedDate?.getMonth() === i
                      ? 'rgba(59,130,246,0.25)' : 'transparent',
                    color: '#94a3b8',
                    border: today.getFullYear() === draftYear && today.getMonth() === i ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  }}>
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── DAY VIEW ── */}
          {view === 'day' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <button onClick={() => setView('month')} style={{ ...navBtnStyle, gap: 4, paddingLeft: 2 }}>
                  <ChevronLeft size={13} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>
                    {draftYear != null && draftMonth != null ? `${MONTHS[draftMonth]} ${draftYear}` : ''}
                  </span>
                </button>
              </div>
              {/* Day-of-week headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 9, color: '#475569', padding: '2px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {/* Empty cells before first day */}
                {Array.from({ length: firstDow }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const isSelected = selectedDate?.getFullYear() === draftYear &&
                    selectedDate?.getMonth() === draftMonth &&
                    selectedDate?.getDate() === day;
                  const isToday = today.getFullYear() === draftYear &&
                    today.getMonth() === draftMonth &&
                    today.getDate() === day;
                  return (
                    <button key={day} onClick={() => handleSelectDay(day)} style={{
                      ...cellStyle,
                      fontSize: 11,
                      background: isSelected ? 'rgba(59,130,246,0.3)' : 'transparent',
                      color: isSelected ? '#93c5fd' : '#94a3b8',
                      border: isToday ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                    }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(59,130,246,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#475569' }}>
              {globalViewDate ? `Viewing as of ${label}` : 'Showing all data (no filter)'}
            </span>
            {globalViewDate && (
              <button onClick={handleClear} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
  display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 5,
};

const cellStyle: React.CSSProperties = {
  padding: '6px 4px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  textAlign: 'center', transition: 'background 0.1s', outline: 'none',
};
