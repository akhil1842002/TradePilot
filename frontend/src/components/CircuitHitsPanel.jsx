import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa';

export const CircuitHitsPanel = ({ onClose }) => {
  const { circuitHits, setSelectedStock, setActiveView } = useApp();
  const [filterType, setFilterType] = useState('ALL'); // ALL, UPPER, LOWER
  const [collapsed, setCollapsed] = useState(false);

  // Today-only hits for the sidebar panel
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayHits = circuitHits.filter(h => new Date(h.time) >= todayStart);

  const filtered = useMemo(() => {
    let result = todayHits;
    if (filterType === 'ALL') return result;
    return result.filter(h => h.type === filterType);
  }, [todayHits, filterType]);

  const handleClick = (symbol) => {
    setSelectedStock(symbol);
    setActiveView('charts');
  };

  const formatTime = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const upperCount = todayHits.filter(h => h.type === 'UPPER').length;
  const lowerCount = todayHits.filter(h => h.type === 'LOWER').length;

  return (
    <div className="tp-card" style={{ maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom" style={{ borderColor: 'var(--tp-border)' }}>
        <div className="d-flex align-items-center gap-2">
          <h6 className="mb-0 fw-bold text-white" style={{ fontSize: '0.9rem' }}>🔒 Today's Circuits</h6>
          {todayHits.length > 0 && (
            <span className="badge rounded-pill" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: '0.7rem' }}>
              {todayHits.length}
            </span>
          )}
        </div>
        <div className="d-flex align-items-center gap-1">
          <button
            className="btn btn-sm btn-link text-muted p-0 border-0"
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '0.8rem' }}
          >
            {collapsed ? <FaChevronDown /> : <FaChevronUp />}
          </button>
          {onClose && (
            <button className="btn btn-sm btn-link text-muted p-0 border-0" onClick={onClose}>
              <FaTimes style={{ fontSize: '0.8rem' }} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* View All link */}
          <button
            className="btn btn-sm btn-link text-decoration-none mb-2"
            style={{ color: '#3B82F6', fontSize: '0.7rem', padding: 0, textAlign: 'left' }}
            onClick={() => setActiveView('circuit-hits')}
          >
            📋 View Full Page →
          </button>

          {/* Filter pills */}
          <div className="d-flex gap-2 mb-2">
            <button
              className={`btn btn-sm rounded-pill px-3 py-1 ${filterType === 'ALL' ? 'btn-secondary' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.7rem' }}
              onClick={() => setFilterType('ALL')}
            >
              All ({todayHits.length})
            </button>
            <button
              className={`btn btn-sm rounded-pill px-3 py-1 ${filterType === 'UPPER' ? 'btn-success' : 'btn-outline-success'}`}
              style={{ fontSize: '0.7rem' }}
              onClick={() => setFilterType('UPPER')}
            >
              🟢 Upper ({upperCount})
            </button>
            <button
              className={`btn btn-sm rounded-pill px-3 py-1 ${filterType === 'LOWER' ? 'btn-danger' : 'btn-outline-danger'}`}
              style={{ fontSize: '0.7rem' }}
              onClick={() => setFilterType('LOWER')}
            >
              🔴 Lower ({lowerCount})
            </button>
          </div>

          {/* List */}
          <div className="d-flex flex-column gap-1" style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div className="text-center text-muted py-3" style={{ fontSize: '0.8rem' }}>
                No circuit hits detected yet.
                <br />
                <small style={{ fontSize: '0.65rem' }}>Stocks frozen at circuit levels will appear here.</small>
              </div>
            ) : (
              filtered.map((hit, idx) => {
                const isUpper = hit.type === 'UPPER';
                const bgColor = isUpper ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)';
                const borderColor = isUpper ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)';
                const sign = hit.changePct >= 0 ? '+' : '';

                return (
                  <div
                    key={idx}
                    className="d-flex align-items-center gap-2 p-2 rounded-2"
                    style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}`, cursor: 'pointer' }}
                    onClick={() => handleClick(hit.symbol)}
                    title={`${hit.name || hit.symbol} — ${hit.sector || ''}`}
                  >
                    <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>
                      {isUpper ? '🟢' : '🔴'}
                    </span>
                    <div className="d-flex flex-column" style={{ minWidth: 0, flex: 1 }}>
                      <div className="d-flex align-items-center gap-1">
                        <span className="fw-bold text-white" style={{ fontSize: '0.78rem' }}>{hit.symbol}</span>
                        <span className="fw-bold" style={{ color: isUpper ? '#22C55E' : '#EF4444', fontSize: '0.72rem' }}>
                          {sign}{hit.changePct}%
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-muted" style={{ fontSize: '0.6rem' }}>
                          ₹{hit.price?.toLocaleString?.('en-IN', { minimumFractionDigits: 2 }) || hit.price}
                        </span>
                        <span className="text-muted" style={{ fontSize: '0.6rem' }}>
                          {formatTime(hit.time)}
                        </span>
                      </div>
                    </div>
                    <span className="badge rounded-pill" style={{
                      backgroundColor: isUpper ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: isUpper ? '#22C55E' : '#EF4444',
                      fontSize: '0.55rem',
                      flexShrink: 0
                    }}>
                      {isUpper ? 'UPPER' : 'LOWER'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CircuitHitsPanel;
