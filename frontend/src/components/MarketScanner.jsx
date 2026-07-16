import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FaSlidersH, FaTimes, FaChevronLeft, FaChevronRight, FaStar, FaRegStar, FaSearch } from 'react-icons/fa';
import ScannerSettingsModal from './ScannerSettingsModal';
import { getEffectiveRec, getActionStyle } from '../utils/tradeLogic';

export const MarketScanner = () => {
  const {
    stocks,
    searchQuery,
    activeSectorFilter,
    setActiveSectorFilter,
    selectedIndex,
    selectedIndexStocks,
    clearIndexFilter,
    setSelectedStock,
    setActiveView,
    tradeMode,
    favorites,
    toggleFavorite,
    isFavorite,
    setSearchQuery
  } = useApp();

  const [showSettings, setShowSettings] = useState(false);
  const [filterRec, setFilterRec] = useState('ALL');
  const [filterUnusual, setFilterUnusual] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const isSell = tradeMode === 'SELL';

  // Derive effective recommendation per stock based on tradeMode
  const enriched = useMemo(() => stocks.map(s => ({
    ...s,
    effectiveRec: getEffectiveRec(s, tradeMode)
  })), [stocks, tradeMode]);

  // Build filter options per mode
  const buyFilters  = ['ALL', 'FAVORITES', 'BUY', 'HOLD', 'WATCH', 'BOOK PROFIT', 'EXIT', 'IGNORE'];
  const sellFilters = ['ALL', 'FAVORITES', 'SHORT', 'HOLD SHORT', 'WATCH SHORT', 'COVER PROFIT', 'COVER'];
  const filters = isSell ? sellFilters : buyFilters;

  // Reset filter when mode changes if current filter doesn't exist in new set
  const activeFilter = filters.includes(filterRec) ? filterRec : 'ALL';

  // Filter and sort — memoized so it only recomputes when inputs change
  const sortedStocks = useMemo(() => {
    const filtered = enriched.filter(s => {
      const matchSearch  = s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSector  = activeSectorFilter ? s.sector === activeSectorFilter : true;
      const matchIndex   = selectedIndexStocks.length > 0 ? selectedIndexStocks.includes(s.symbol) : true;
      const matchRec     = activeFilter === 'ALL' ? true
                        : activeFilter === 'FAVORITES' ? favorites.includes(s.symbol)
                        : s.effectiveRec?.action === activeFilter;
      // Unusual move filter
      const um = s.unusualMove;
      const matchUnusual = filterUnusual === 'ALL' ? true
                        : filterUnusual === 'ANY'     ? (um && um.opportunityScore >= 25)
                        : filterUnusual === 'UNEXPECTED'  ? (um && um.opportunityScore >= 80)
                        : filterUnusual === 'STRONG'      ? (um && um.opportunityScore >= 60 && um.opportunityScore < 80)
                        : filterUnusual === 'NOTICEABLE'  ? (um && um.opportunityScore >= 40 && um.opportunityScore < 60)
                        : filterUnusual === 'MINOR'       ? (um && um.opportunityScore >= 25 && um.opportunityScore < 40)
                        : filterUnusual === 'NONE'        ? (!um || um.opportunityScore < 25)
                        : true;
      return matchSearch && matchSector && matchIndex && matchRec && matchUnusual;
    });

    return filtered.sort((a, b) => {
      const confA = a.effectiveRec?.confidence ?? 0;
      const confB = b.effectiveRec?.confidence ?? 0;
      return confB - confA;
    });
  }, [enriched, searchQuery, activeSectorFilter, selectedIndexStocks, activeFilter, filterUnusual]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedStocks.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedStocks = sortedStocks.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [searchQuery, activeSectorFilter, selectedIndexStocks, activeFilter, filterUnusual]);

  // Top signal for the notice hero banner
  const topSignal = sortedStocks.length > 0 ? sortedStocks[0] : null;

  const handleRowClick = (sym) => {
    setSelectedStock(sym);
    setActiveView('charts');
  };

  const ActionBadge = ({ action }) => {
    const s = getActionStyle(action);
    return (
      <span
        className="badge rounded-pill px-2 py-1 fw-bold"
        style={{
          backgroundColor: s.bg,
          color: s.color,
          border: `1px solid ${s.border}`,
          fontSize: '0.7rem',
          whiteSpace: 'nowrap'
        }}
      >
        {s.emoji} {s.label}
      </span>
    );
  };

  return (
    <div className="tp-card">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--tp-border)' }}>
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h5 className="mb-0 fw-bold" style={{ color: 'var(--tp-text)' }}>
              {isSell ? '🔻 Short Sell Scanner' : '🟢 Long Buy Scanner'}
            </h5>
            <span
              className="badge rounded-pill px-3 py-1 fw-bold"
              style={{
                fontSize: '0.75rem',
                backgroundColor: isSell ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                color: isSell ? '#EF4444' : '#22C55E',
                border: `1px solid ${isSell ? '#EF4444' : '#22C55E'}`
              }}
            >
              {isSell ? 'SELL / SHORT MODE' : 'BUY / LONG MODE'}
            </span>
          </div>
          <small className="text-muted">
            {isSell
              ? 'Bearish signals — overbought stocks, below VWAP, bearish cross'
              : 'Bullish signals — above VWAP, momentum, EMA crossover'}
          </small>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Search input */}
          <div className="position-relative" style={{ width: '220px' }}>
            <FaSearch
              className="position-absolute"
              style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '0.8rem', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="form-control form-control-sm border-secondary ps-5"
              placeholder="Search symbol or name..."
              style={{
                fontSize: '0.85rem',
                backgroundColor: 'var(--tp-bg)',
                color: 'var(--tp-text)',
                borderColor: 'var(--tp-border)'
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <FaTimes
                className="position-absolute"
                style={{ right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#6B7280', fontSize: '0.7rem' }}
                onClick={() => setSearchQuery('')}
                title="Clear search"
              />
            )}
          </div>

          {/* Show active index filter chip */}
          {selectedIndex && (
            <span
              className="badge rounded-pill d-inline-flex align-items-center gap-2 px-3 py-2 fw-bold"
              style={{
                backgroundColor: 'rgba(59,130,246,0.15)',
                color: '#3B82F6',
                border: '1px solid rgba(59,130,246,0.4)',
                fontSize: '0.8rem',
                cursor: 'default'
              }}
            >
              📊 {selectedIndex}
              <FaTimes
                style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                onClick={(e) => { e.stopPropagation(); clearIndexFilter(); }}
                title="Clear index filter"
              />
            </span>
          )}
          {activeSectorFilter && (
            <span
              className="badge rounded-pill d-inline-flex align-items-center gap-2 px-3 py-2 fw-bold"
              style={{
                backgroundColor: 'rgba(34,197,94,0.12)',
                color: '#22C55E',
                border: '1px solid rgba(34,197,94,0.35)',
                fontSize: '0.8rem',
                cursor: 'default'
              }}
            >
              🏷️ {activeSectorFilter}
              <FaTimes
                style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                onClick={(e) => { e.stopPropagation(); setActiveSectorFilter(null); }}
                title="Clear sector filter"
              />
            </span>
          )}

          <select
            className="form-select form-select-sm border-secondary"
            style={{ width: '190px', fontSize: '0.85rem', backgroundColor: 'var(--tp-bg)', color: 'var(--tp-text)' }}
            value={activeFilter}
            onChange={e => setFilterRec(e.target.value)}
          >
            {filters.map(f => (
              <option key={f} value={f}>{f === 'ALL' ? 'All Signals' : f}</option>
            ))}
          </select>

          {/* Unusual Move Filter */}
          <select
            className="form-select form-select-sm border-secondary"
            style={{ width: '160px', fontSize: '0.85rem', backgroundColor: 'var(--tp-bg)', color: 'var(--tp-text)' }}
            value={filterUnusual}
            onChange={e => setFilterUnusual(e.target.value)}
          >
            <option value="ALL">📊 All Moves</option>
            <option value="ANY">⭐ Any Unusual</option>
            <option value="UNEXPECTED">🚀 Unexpected (80+)</option>
            <option value="STRONG">🔥 Strong (60+)</option>
            <option value="NOTICEABLE">⚡ Noticeable (40+)</option>
            <option value="MINOR">📊 Minor (25+)</option>
            <option value="NONE">◻ No Unusual</option>
          </select>

          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 px-3"
            style={{ fontSize: '0.85rem' }}
            onClick={() => setShowSettings(true)}
          >
            <FaSlidersH /> Configure Engine
          </button>
        </div>
      </div>

      {/* ═══ TOP SIGNAL HERO BANNER ═══ */}
      {topSignal && topSignal.effectiveRec && (() => {
        const ts = topSignal;
        const rec = ts.effectiveRec;
        const s = getActionStyle(rec.action);
        const scoreColor = rec.confidence >= 75 ? '#22C55E' : rec.confidence >= 50 ? '#3B82F6' : '#EF4444';
        if (activeFilter !== 'ALL' && rec.action !== activeFilter) return null; // hide if filtered to specific action & top doesn't match
        if (rec.action === 'IGNORE' || rec.action === 'HOLD') return null; // only show actionable signals

        return (
          <div
            className="d-flex align-items-center gap-4 p-3 rounded-3 mb-3"
            style={{
              background: `linear-gradient(135deg, ${s.bg}, rgba(0,0,0,0.05))`,
              border: `2px solid ${s.border}`,
              cursor: 'pointer'
            }}
            onClick={() => handleRowClick(ts.symbol)}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
                style={{
                  backgroundColor: s.bg,
                  border: `2px solid ${s.border}`,
                  color: s.color,
                  fontWeight: 800,
                  fontSize: '1.1rem'
                }}
              >
                {s.emoji} {rec.action === 'BUY' ? 'TOP BUY SIGNAL' : rec.action === 'SHORT' ? 'TOP SHORT SIGNAL' : rec.action === 'EXIT' ? 'EXIT SIGNAL' : rec.action === 'BOOK PROFIT' ? 'BOOK PROFIT' : 'TOP SIGNAL'}
              </div>
              <div>
                <span className="fw-bold text-white" style={{ fontSize: '1.2rem' }}>{ts.symbol}</span>
                <span className="text-muted ms-2" style={{ fontSize: '0.85rem' }}>₹{ts.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3 ms-auto">
              <div className="text-center">
                <div className="fw-bold" style={{ color: scoreColor, fontSize: '1.3rem' }}>{rec.confidence}%</div>
                <small className="text-muted" style={{ fontSize: '0.65rem' }}>CONFIDENCE</small>
              </div>
              <div className="text-center">
                <div className="fw-bold text-white" style={{ fontSize: '0.9rem' }}>₹{rec.target1?.toLocaleString?.('en-IN', { minimumFractionDigits: 2 }) || rec.target1}</div>
                <small className="text-muted" style={{ fontSize: '0.65rem' }}>TARGET</small>
              </div>
              <div className="text-center">
                <div className="fw-bold text-white" style={{ fontSize: '0.9rem' }}>₹{rec.stopLoss?.toLocaleString?.('en-IN', { minimumFractionDigits: 2 }) || rec.stopLoss}</div>
                <small className="text-muted" style={{ fontSize: '0.65rem' }}>STOP LOSS</small>
              </div>
              <span className="text-muted" style={{ fontSize: '0.7rem' }}>Click to view →</span>
            </div>
          </div>
        );
      })()}

      {/* ═══ UNUSUAL PRICE MOVEMENT ALERTS ═══ */}
      {(() => {
        const unusualStocks = enriched.filter(s => s.unusualMove && s.unusualMove.opportunityScore >= 40);
        if (unusualStocks.length === 0) return null;

        return (
          <div className="d-flex flex-wrap gap-2 mb-3">
            {unusualStocks.slice(0, 4).map(us => {
              const um = us.unusualMove;
              const isSurge = um.type === 'SURGE';
              const accentColor = um.opportunityScore >= 70 ? (isSurge ? '#22C55E' : '#EF4444') : '#F59E0B';
              const bgColor = um.opportunityScore >= 70 ? (isSurge ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)') : 'rgba(245,158,11,0.18)';
              const sign = um.changePct >= 0 ? '+' : '';

              return (
                <div
                  key={us.symbol}
                  className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill"
                  style={{
                    backgroundColor: bgColor,
                    border: `1.5px solid ${accentColor}66`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => handleRowClick(us.symbol)}
                  title={`${um.reason}\nATR: ${um.atrRatio}× | Vol: ${um.volumeRatio}× | Intraday: ${um.intradayPct >= 0 ? '+' : ''}${um.intradayPct}%`}
                >
                  <span style={{ fontSize: '1.1rem' }}>{um.emoji}</span>
                  <span className="fw-bold text-white" style={{ fontSize: '0.82rem' }}>{us.symbol}</span>
                  <span className="fw-bold" style={{ color: accentColor, fontSize: '0.82rem' }}>
                    {sign}{um.changePct}% ({sign}₹{um.moveRupees?.toLocaleString?.('en-IN', { minimumFractionDigits: 2 }) || um.moveRupees})
                  </span>
                  <span className="fw-semibold" style={{ color: '#F59E0B', fontSize: '0.75rem' }}>
                    {um.opportunityScore}/100
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Table */}
      <div className="table-responsive" style={{ maxHeight: '550px' }}>
        <table className="table tp-table table-hover">
          <thead>
            <tr>
              <th style={{ width: '30px' }}></th>
              <th>Symbol</th>
              <th>Price</th>
              <th>Chg %</th>
              <th>Volume</th>
              <th>VWAP</th>
              <th>RSI</th>
              <th>EMA20</th>
              <th>EMA50</th>
              <th>MACD</th>
              <th>ADX</th>
              <th>Sector</th>
              <th>Unusual Move</th>
              <th className="text-center">Score</th>
              <th className="text-center">{isSell ? 'Short Signal' : 'Signal'}</th>
            </tr>
          </thead>
          <tbody>
            {sortedStocks.length === 0 ? (
              <tr>
                <td colSpan="15" className="text-center text-muted py-5">
                  {selectedIndex && selectedIndexStocks.length === 0
                    ? `INDIA VIX is a volatility index — it has no constituent stocks.`
                    : selectedIndex && selectedIndexStocks.length > 0
                      ? `No ${selectedIndex} stocks match the current filter. ${stocks.length === 0 ? '(Waiting for market data...)' : ''}`
                      : stocks.length === 0
                        ? 'Waiting for live market data... Connect Zerodha or check backend.'
                        : `No stocks match the current ${isSell ? 'short' : 'long'} filter.`}
                </td>
              </tr>
            ) : (
              paginatedStocks.map(stock => {
                const changeVal = stock.price - stock.close;
                const changePct = ((changeVal / stock.close) * 100).toFixed(2);
                const isUp = changeVal >= 0;
                const changeColor = isUp ? 'text-success' : 'text-danger';
                const macdColor = stock.macd?.hist >= 0 ? 'text-success' : 'text-danger';
                const rec = stock.effectiveRec;
                const score = rec?.confidence ?? 0;
                const scoreColor = score >= 75 ? 'bg-success' : score >= 50 ? 'bg-info' : 'bg-danger';

                // In SELL mode, highlight stocks with RSI overbought or below VWAP
                let flashClass = '';
                if (stock.flash === 'up')   flashClass = 'flash-up';
                if (stock.flash === 'down') flashClass = 'flash-down';

                // Row accent for strong signals
                const rowHighlight = isSell
                  ? (rec?.action === 'SHORT' ? 'rgba(239,68,68,0.04)' : 'transparent')
                  : (rec?.action === 'BUY'   ? 'rgba(34,197,94,0.04)'  : 'transparent');

                return (
                  <tr
                    key={stock.symbol}
                    className={`tp-table-row-hover smooth-transition ${flashClass}`}
                    style={{ backgroundColor: rowHighlight }}
                  >
                    <td
                      className="text-center"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(stock.symbol); }}
                      style={{ cursor: 'pointer', padding: '8px 4px' }}
                      title={isFavorite(stock.symbol) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFavorite(stock.symbol) ? (
                        <FaStar style={{ color: '#F59E0B', fontSize: '0.9rem' }} />
                      ) : (
                        <FaRegStar style={{ color: '#6B7280', fontSize: '0.9rem' }} />
                      )}
                    </td>
                    <td className="fw-bold" style={{ color: 'var(--tp-text)' }} onClick={() => handleRowClick(stock.symbol)}>
                      <div className="d-flex align-items-center gap-1">
                        <span>{stock.symbol}</span>
                        {stock.unusualMove && stock.unusualMove.stars >= 2 && (
                          <span
                            className="badge rounded-pill"
                            style={{
                              backgroundColor: stock.unusualMove.type === 'SURGE' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                              color: stock.unusualMove.type === 'SURGE' ? '#22C55E' : '#EF4444',
                              border: `1px solid ${stock.unusualMove.type === 'SURGE' ? '#22C55E' : '#EF4444'}44`,
                              fontSize: '0.6rem',
                              cursor: 'help'
                            }}
                            title={`${stock.unusualMove.emoji} ${stock.unusualMove.changePct >= 0 ? '+' : ''}${stock.unusualMove.changePct}% in ${stock.unusualMove.minutes}min — ${'⭐'.repeat(stock.unusualMove.stars)}`}
                          >
                            {'⭐'.repeat(stock.unusualMove.stars)}
                          </span>
                        )}
                      </div>
                      <small className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>{stock.name}</small>
                    </td>
                    <td className="fw-bold" style={{ color: 'var(--tp-text)' }}>
                      ₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`fw-semibold ${changeColor}`}>
                      {isUp ? '▲' : '▼'} {changePct}%
                      <div className="fw-normal" style={{ fontSize: '0.7rem' }}>
                        {isUp ? '+' : '-'}₹{Math.abs(changeVal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {(stock.volume / 100000).toFixed(1)}L
                    </td>
                    {/* VWAP — red if below in SELL mode */}
                    <td className={isSell && stock.price < stock.vwap ? 'text-danger fw-bold' : ''}>
                      ₹{stock.vwap}
                    </td>
                    {/* RSI — red if overbought in SELL mode */}
                    <td className={
                      isSell
                        ? (stock.rsi >= 70 ? 'text-danger fw-bold' : stock.rsi <= 30 ? 'text-success fw-bold' : '')
                        : (stock.rsi >= 60 ? 'text-success fw-bold' : stock.rsi <= 40 ? 'text-danger fw-bold' : '')
                    }>
                      {stock.rsi}
                    </td>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>₹{stock.ema20}</td>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>₹{stock.ema50}</td>
                    <td className={macdColor} style={{ fontSize: '0.85rem' }}>
                      {stock.macd?.macd?.toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--tp-text)' }}>{stock.adx}</td>
                    <td>
                      <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle" style={{ fontSize: '0.7rem' }}>
                        {stock.sector}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {stock.unusualMove && stock.unusualMove.stars >= 1 ? (() => {
                        const um = stock.unusualMove;
                        const isSurge = um.type === 'SURGE';
                        const sign = um.changePct >= 0 ? '+' : '';
                        const labelColor = um.opportunityScore >= 80 ? (isSurge ? '#22C55E' : '#EF4444')
                                        : um.opportunityScore >= 60 ? '#F59E0B'
                                        : um.opportunityScore >= 40 ? '#8B5CF6'
                                        : '#6B7280';
                        return (
                          <div className="d-flex flex-column" style={{ gap: '2px' }}>
                            {/* Alert label + ₹ amount + % change */}
                            <span
                              className="fw-bold"
                              style={{ color: labelColor, fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                              title={`${um.emoji} ${um.reason}\nOpportunity Score: ${um.opportunityScore}/100\n${'⭐'.repeat(um.stars)}`}
                            >
                              {um.emoji} {sign}₹{um.moveRupees?.toLocaleString?.('en-IN', { minimumFractionDigits: 2 }) || um.moveRupees}
                              <span style={{ fontSize: '0.7rem', fontWeight: 500 }}> ({sign}{um.changePct}%)</span>
                            </span>
                            {/* Sub-metrics row */}
                            <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.65rem' }}>
                              {um.atrRatio >= 1.2 && (
                                <span className="text-muted" title="Move vs normal daily range">ATR {um.atrRatio}×</span>
                              )}
                              {um.volumeRatio >= 1.3 && (
                                <span className="text-muted" title="Volume vs average">Vol {um.volumeRatio}×</span>
                              )}
                              <span className="fw-semibold" style={{ color: labelColor, fontSize: '0.6rem' }}>
                                {um.opportunityScore}/100
                              </span>
                            </div>
                          </div>
                        );
                      })() : (
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex flex-column align-items-center" style={{ width: '70px' }}>
                        <span className="fw-bold mb-1" style={{ fontSize: '0.85rem', color: 'var(--tp-text)' }}>{score}%</span>
                        <div className="progress w-100 bg-dark" style={{ height: '4px' }}>
                          <div className={`progress-bar ${scoreColor}`} style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <ActionBadge action={rec?.action} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mt-3 pt-3 border-top" style={{ borderColor: 'var(--tp-border)' }}>
        <div className="d-flex align-items-center gap-3">
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            Showing <strong style={{ color: 'var(--tp-text)' }}>{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedStocks.length)}</strong> of <strong style={{ color: 'var(--tp-text)' }}>{sortedStocks.length}</strong> stocks
          </span>
          <select
            className="form-select form-select-sm border-secondary"
            style={{ width: '80px', fontSize: '0.8rem', backgroundColor: 'var(--tp-bg)', color: 'var(--tp-text)' }}
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={safePage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <FaChevronLeft />
          </button>
          <span className="text-muted px-2" style={{ fontSize: '0.85rem' }}>
            Page <strong style={{ color: 'var(--tp-text)' }}>{safePage}</strong> of {totalPages}
          </span>
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={safePage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            <FaChevronRight />
          </button>
        </div>
      </div>

      {showSettings && <ScannerSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default MarketScanner;
