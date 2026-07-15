import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FaSlidersH } from 'react-icons/fa';
import ScannerSettingsModal from './ScannerSettingsModal';
import { getEffectiveRec, getActionStyle } from '../utils/tradeLogic';

export const MarketScanner = () => {
  const {
    stocks,
    searchQuery,
    activeSectorFilter,
    setSelectedStock,
    setActiveView,
    tradeMode
  } = useApp();

  const [showSettings, setShowSettings] = useState(false);
  const [filterRec, setFilterRec] = useState('ALL');

  const isSell = tradeMode === 'SELL';

  // Derive effective recommendation per stock based on tradeMode
  const enriched = stocks.map(s => ({
    ...s,
    effectiveRec: getEffectiveRec(s, tradeMode)
  }));

  // Build filter options per mode
  const buyFilters  = ['ALL', 'BUY', 'HOLD', 'WATCH', 'BOOK PROFIT', 'EXIT', 'IGNORE'];
  const sellFilters = ['ALL', 'SHORT', 'HOLD SHORT', 'WATCH SHORT', 'COVER PROFIT', 'COVER'];
  const filters = isSell ? sellFilters : buyFilters;

  // Reset filter when mode changes if current filter doesn't exist in new set
  const activeFilter = filters.includes(filterRec) ? filterRec : 'ALL';

  const filteredStocks = enriched.filter(s => {
    const matchSearch  = s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSector  = activeSectorFilter ? s.sector === activeSectorFilter : true;
    const matchRec     = activeFilter === 'ALL' ? true : s.effectiveRec?.action === activeFilter;
    return matchSearch && matchSector && matchRec;
  });

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

          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 px-3"
            style={{ fontSize: '0.85rem' }}
            onClick={() => setShowSettings(true)}
          >
            <FaSlidersH /> Configure Engine
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive" style={{ maxHeight: '550px' }}>
        <table className="table tp-table table-hover">
          <thead>
            <tr>
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
              <th className="text-center">Score</th>
              <th className="text-center">{isSell ? 'Short Signal' : 'Signal'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredStocks.length === 0 ? (
              <tr>
                <td colSpan="13" className="text-center text-muted py-5">
                  No stocks match the current {isSell ? 'short' : 'long'} filter.
                </td>
              </tr>
            ) : (
              filteredStocks.map(stock => {
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
                    onClick={() => handleRowClick(stock.symbol)}
                  >
                    <td className="fw-bold" style={{ color: 'var(--tp-text)' }}>
                      <div>{stock.symbol}</div>
                      <small className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>{stock.name}</small>
                    </td>
                    <td className="fw-bold" style={{ color: 'var(--tp-text)' }}>
                      ₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`fw-semibold ${changeColor}`}>
                      {isUp ? '▲' : '▼'} {changePct}%
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

      {showSettings && <ScannerSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default MarketScanner;
