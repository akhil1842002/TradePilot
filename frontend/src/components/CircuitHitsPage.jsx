import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FaSearch, FaTimes, FaArrowUp, FaArrowDown, FaFilter } from 'react-icons/fa';

export const CircuitHitsPage = () => {
  const { circuitHits, setSelectedStock, setActiveView } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, UPPER, LOWER
  const [sortBy, setSortBy] = useState('time'); // time, change, symbol
  const [dayFilter, setDayFilter] = useState('TODAY'); // TODAY, ALL

  // Filter to today only
  const todayHits = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return circuitHits.filter(h => new Date(h.time) >= todayStart);
  }, [circuitHits]);

  const sourceHits = dayFilter === 'TODAY' ? todayHits : circuitHits;

  const filtered = useMemo(() => {
    let result = sourceHits;

    // Type filter
    if (filterType !== 'ALL') {
      result = result.filter(h => h.type === filterType);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(h =>
        h.symbol.toLowerCase().includes(q) ||
        (h.name && h.name.toLowerCase().includes(q)) ||
        (h.sector && h.sector.toLowerCase().includes(q))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'change': return Math.abs(b.changePct) - Math.abs(a.changePct);
        case 'symbol': return a.symbol.localeCompare(b.symbol);
        case 'time':
        default: return new Date(b.time) - new Date(a.time);
      }
    });

    return result;
  }, [sourceHits, filterType, searchQuery, sortBy]);

  const handleClick = (symbol) => {
    setSelectedStock(symbol);
    setActiveView('charts');
  };

  const formatTime = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const upperCount = sourceHits.filter(h => h.type === 'UPPER').length;
  const lowerCount = sourceHits.filter(h => h.type === 'LOWER').length;
  const todayUpper = todayHits.filter(h => h.type === 'UPPER').length;
  const todayLower = todayHits.filter(h => h.type === 'LOWER').length;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="tp-card">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h4 className="fw-bold text-white mb-1">🔒 Circuit Hits Monitor</h4>
            <small className="text-muted">
              {dayFilter === 'TODAY' ? "Today's stocks frozen at circuit limits" : 'All circuit hits since session start'}
            </small>
          </div>
          <div className="d-flex gap-3 text-center">
            <div className="px-3 py-2 rounded-3" style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <div className="fw-bold text-success" style={{ fontSize: '1.2rem' }}>{upperCount}</div>
              <small className="text-muted" style={{ fontSize: '0.6rem' }}>UPPER CIRCUIT</small>
            </div>
            <div className="px-3 py-2 rounded-3" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="fw-bold text-danger" style={{ fontSize: '1.2rem' }}>{lowerCount}</div>
              <small className="text-muted" style={{ fontSize: '0.6rem' }}>LOWER CIRCUIT</small>
            </div>
            <div className="px-3 py-2 rounded-3" style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <div className="fw-bold text-primary" style={{ fontSize: '1.2rem' }}>{sourceHits.length}</div>
              <small className="text-muted" style={{ fontSize: '0.6rem' }}>{dayFilter === 'TODAY' ? 'TODAY' : 'TOTAL'}</small>
            </div>
          </div>
        </div>
        {/* Today hint if there are older hits */}
        {dayFilter === 'ALL' && todayHits.length > 0 && todayHits.length < circuitHits.length && (
          <div className="mt-2 pt-2 border-top" style={{ borderColor: 'var(--tp-border)' }}>
            <small className="text-muted" style={{ fontSize: '0.7rem' }}>
              📅 <strong>{todayHits.length}</strong> hits today · <strong>{circuitHits.length - todayHits.length}</strong> from previous sessions
            </small>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="tp-card">
        <div className="d-flex flex-wrap align-items-center gap-3">
          {/* Day filter */}
          <div className="d-flex gap-2">
            <button
              className={`btn btn-sm rounded-pill px-3 ${dayFilter === 'TODAY' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => { setDayFilter('TODAY'); setFilterType('ALL'); }}
            >
              📅 Today ({todayHits.length})
            </button>
            <button
              className={`btn btn-sm rounded-pill px-3 ${dayFilter === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setDayFilter('ALL')}
            >
              🕐 All Time ({circuitHits.length})
            </button>
          </div>

          {/* Type filter pills */}
          <div className="d-flex gap-2">
            <button
              className={`btn btn-sm rounded-pill px-3 ${filterType === 'ALL' ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterType('ALL')}
            >
              All ({circuitHits.length})
            </button>
            <button
              className={`btn btn-sm rounded-pill px-3 ${filterType === 'UPPER' ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => setFilterType('UPPER')}
            >
              🟢 Upper ({upperCount})
            </button>
            <button
              className={`btn btn-sm rounded-pill px-3 ${filterType === 'LOWER' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => setFilterType('LOWER')}
            >
              🔴 Lower ({lowerCount})
            </button>
          </div>

          {/* Search */}
          <div className="position-relative" style={{ width: '240px' }}>
            <FaSearch
              className="position-absolute"
              style={{ left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '0.75rem', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="form-control form-control-sm border-secondary ps-4"
              placeholder="Search symbol or name..."
              style={{ fontSize: '0.85rem', backgroundColor: 'var(--tp-bg)', color: 'var(--tp-text)', borderColor: 'var(--tp-border)' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <FaTimes
                className="position-absolute"
                style={{ right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#6B7280', fontSize: '0.7rem' }}
                onClick={() => setSearchQuery('')}
              />
            )}
          </div>

          {/* Sort */}
          <div className="ms-auto d-flex align-items-center gap-2">
            <FaFilter style={{ color: '#6B7280', fontSize: '0.7rem' }} />
            <select
              className="form-select form-select-sm border-secondary"
              style={{ width: '130px', fontSize: '0.8rem', backgroundColor: 'var(--tp-bg)', color: 'var(--tp-text)' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="time">Latest First</option>
              <option value="change">Change % ↓</option>
              <option value="symbol">Symbol A–Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="tp-card">
        {filtered.length === 0 ? (
          <div className="text-center text-muted py-5">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
            <div style={{ fontSize: '1rem' }}>No circuit hits detected yet</div>
            <small style={{ fontSize: '0.75rem' }}>
              Stocks that freeze at upper/lower circuit levels will appear here automatically.
            </small>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table tp-table table-hover mb-0">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Circuit</th>
                  <th>Price</th>
                  <th>Change %</th>
                  <th className="d-none d-md-table-cell">Sector</th>
                  <th className="d-none d-md-table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((hit, idx) => {
                  const isUpper = hit.type === 'UPPER';
                  const sign = hit.changePct >= 0 ? '+' : '';

                  return (
                    <tr
                      key={idx}
                      className="tp-table-row-hover"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleClick(hit.symbol)}
                    >
                      <td className="text-muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatTime(hit.time)}
                      </td>
                      <td>
                        <div className="fw-bold text-white" style={{ fontSize: '0.85rem' }}>{hit.symbol}</div>
                        {hit.name && (
                          <small className="text-muted" style={{ fontSize: '0.7rem' }}>{hit.name}</small>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge rounded-pill fw-bold"
                          style={{
                            backgroundColor: isUpper ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: isUpper ? '#22C55E' : '#EF4444',
                            border: `1px solid ${isUpper ? '#22C55E' : '#EF4444'}44`,
                            fontSize: '0.7rem'
                          }}
                        >
                          {isUpper ? <FaArrowUp className="me-1" style={{ fontSize: '0.6rem' }} /> : <FaArrowDown className="me-1" style={{ fontSize: '0.6rem' }} />}
                          {isUpper ? 'UPPER' : 'LOWER'}
                        </span>
                      </td>
                      <td className="fw-bold text-white" style={{ fontSize: '0.85rem' }}>
                        ₹{hit.price?.toLocaleString?.('en-IN', { minimumFractionDigits: 2 }) || hit.price}
                      </td>
                      <td className="fw-bold" style={{ color: isUpper ? '#22C55E' : '#EF4444', fontSize: '0.85rem' }}>
                        {sign}{hit.changePct}%
                      </td>
                      <td className="d-none d-md-table-cell">
                        {hit.sector && (
                          <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle" style={{ fontSize: '0.7rem' }}>
                            {hit.sector}
                          </span>
                        )}
                      </td>
                      <td className="d-none d-md-table-cell">
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          🔒 Frozen
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer stats */}
        <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top" style={{ borderColor: 'var(--tp-border)' }}>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Showing <strong style={{ color: 'var(--tp-text)' }}>{filtered.length}</strong> of <strong style={{ color: 'var(--tp-text)' }}>{circuitHits.length}</strong> circuit hits
          </span>
          {searchQuery && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setSearchQuery('')}>
              <FaTimes className="me-1" /> Clear Search
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CircuitHitsPage;
