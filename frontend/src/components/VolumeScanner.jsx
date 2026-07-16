import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  FaFire, FaArrowUp, FaArrowDown, FaSearch, FaFilter,
  FaBolt, FaChartLine, FaExchangeAlt
} from 'react-icons/fa';

// ── RVOL Threshold presets ───────────────────────────────────────
const RVOL_PRESETS = [
  { label: 'All', value: 0 },
  { label: '>1.2×', value: 1.2 },
  { label: '>1.5×', value: 1.5 },
  { label: '>2×', value: 2.0 },
  { label: '>3×', value: 3.0 },
  { label: '>5×', value: 5.0 },
];

// ── RVOL Classification ─────────────────────────────────────────
const getRvolClass = (rvol) => {
  if (rvol >= 5.0) return { label: '🔥 Exceptional', bg: 'rgba(239,68,68,0.2)',   color: '#FCA5A5', glow: '0 0 8px rgba(239,68,68,0.4)' };
  if (rvol >= 3.0) return { label: '🚀 Very High',  bg: 'rgba(249,115,22,0.2)',   color: '#FDBA74', glow: '0 0 4px rgba(249,115,22,0.3)' };
  if (rvol >= 2.0) return { label: '📈 High',       bg: 'rgba(250,204,21,0.15)',  color: '#FDE047', glow: 'none' };
  if (rvol >= 1.2) return { label: '🟢 Above Avg',  bg: 'rgba(34,197,94,0.12)',   color: '#86EFAC', glow: 'none' };
  return              { label: '⚪ Normal',     bg: 'rgba(156,163,175,0.1)',   color: 'var(--tp-text-muted)', glow: 'none' };
};

// ── Volume-based Buy/Sell Signal ────────────────────────────────
const getVolumeSignal = (stock) => {
  const score = stock.score || 0;
  const isUp = stock.price > stock.previousClose;

  // Strong Buy: High RVOL + price rising + breakout/volume confirmation
  if (score >= 50 && isUp && (stock.breakoutVolume || stock.priceUpVolumeUp)) {
    return { label: '🟢 Good to Buy', color: 'var(--tp-success)', bg: 'rgba(34,197,94,0.15)', weight: 'bold' };
  }
  // Buy: Decent RVOL + price rising
  if (score >= 35 && isUp && stock.priceUpVolumeUp) {
    return { label: '🟡 Watch to Buy', color: '#FDE047', bg: 'rgba(250,204,21,0.12)', weight: 'bold' };
  }
  // Strong Sell: High RVOL + price falling heavily
  if (score >= 40 && !isUp && stock.rvol >= 2.0) {
    return { label: '🔴 Good to Sell', color: 'var(--tp-danger)', bg: 'rgba(239,68,68,0.15)', weight: 'bold' };
  }
  // Sell: Price falling + above-average volume
  if (!isUp && stock.rvol >= 1.5) {
    return { label: '🟠 Watch to Sell', color: '#FDBA74', bg: 'rgba(249,115,22,0.12)', weight: 'bold' };
  }
  // Neutral / Wait
  return { label: '⚪ Wait', color: 'var(--tp-text-muted)', bg: 'rgba(156,163,175,0.08)', weight: 'normal' };
};

const getSpikeStyle = (spike) => {
  if (spike >= 4.0) return { color: '#FCA5A5', weight: 'bold' };
  if (spike >= 2.5) return { color: '#FDBA74', weight: 'bold' };
  if (spike >= 2.0) return { color: '#FDE047', weight: 'normal' };
  return { color: 'var(--tp-text-muted)', weight: 'normal' };
};

// ── Filter toggle chips (mode-aware) ────────────────────────────
const BUY_FILTERS = [
  { key: 'consecutiveVol', label: 'Vol ↑ 3 candles', icon: <FaChartLine /> },
  { key: 'priceUpVolUp', label: 'Price ↑ + Vol ↑', icon: <FaArrowUp /> },
  { key: 'breakoutVol', label: 'Breakout + Vol', icon: <FaBolt /> },
  { key: 'gapUpVol', label: 'Gap Up + Vol', icon: <FaExchangeAlt /> },
];

const SELL_FILTERS = [
  { key: 'consecutiveVol', label: 'Vol ↑ 3 candles', icon: <FaChartLine /> },
  { key: 'priceUpVolUp', label: 'Price ↓ + Vol ↑', icon: <FaArrowDown /> },
  { key: 'breakoutVol', label: 'Breakdown + Vol', icon: <FaBolt /> },
  { key: 'gapUpVol', label: 'Gap Down + Vol', icon: <FaExchangeAlt /> },
];

export const VolumeScanner = () => {
  const { volumeScanner, setSelectedStock, setActiveView, tradeMode, toggleTradeMode } = useApp();

  const isSell = tradeMode === 'SELL';

  const [rvolThreshold, setRvolThreshold] = useState(1.2);
  const [minSpike1m, setMinSpike1m] = useState(0);
  const [minSpike5m, setMinSpike5m] = useState(0);
  const [activeFilters, setActiveFilters] = useState({});
  const [search, setSearch] = useState('');
  const [priceRange, setPriceRange] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Toggle a filter on/off
  const toggleFilter = (key) => {
    setActiveFilters(prev => ({ ...prev, [key]: !prev[key] }));
    setPage(1);
  };

  const handleStockClick = (symbol) => {
    setSelectedStock(symbol);
    setActiveView('charts');
  };

  // ── Client-side filtering & ranking (mode-aware) ─────────────
  const ranked = useMemo(() => {
    let data = volumeScanner.ranked || [];

    // Apply RVOL threshold
    if (rvolThreshold > 0) {
      data = data.filter(s => s.rvol >= rvolThreshold);
    }

    // Apply 1-min spike filter
    if (minSpike1m > 0) {
      data = data.filter(s => s.spike1m >= minSpike1m);
    }

    // Apply 5-min spike filter
    if (minSpike5m > 0) {
      data = data.filter(s => s.spike5m >= minSpike5m);
    }

    // ── Mode-specific filtering ──────────────────────────────
    if (isSell) {
      // SELL mode: only show stocks where price is falling
      data = data.filter(s => s.price <= s.previousClose);
    } else {
      // BUY mode: only show stocks where price is rising
      data = data.filter(s => s.price >= s.previousClose);
    }

    // Apply toggle filters (mode-aware)
    if (activeFilters.consecutiveVol) data = data.filter(s => s.consecutiveVol);
    if (activeFilters.priceUpVolUp) {
      if (isSell) {
        // SELL: price falling + high volume (invert priceUpVolumeUp)
        data = data.filter(s => s.rvol >= 1.2 && s.price <= s.previousClose);
      } else {
        data = data.filter(s => s.priceUpVolumeUp);
      }
    }
    if (activeFilters.breakoutVol) {
      if (isSell) {
        // SELL: breakdown = high volume + price falling hard
        data = data.filter(s => s.rvol >= 2.0 && s.price <= s.previousClose);
      } else {
        data = data.filter(s => s.breakoutVolume);
      }
    }
    if (activeFilters.gapUpVol) {
      if (isSell) {
        // SELL: gap down = open below prev close + high vol
        data = data.filter(s => s.rvol >= 1.2 && s.open < s.previousClose);
      } else {
        data = data.filter(s => s.gapUpVolume);
      }
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
      );
    }

    // Price range filter (dropdown presets)
    if (priceRange !== 'ALL') {
      data = data.filter(s => {
        if (priceRange === 'BELOW_100')   return s.price < 100;
        if (priceRange === '100_500')     return s.price >= 100 && s.price <= 500;
        if (priceRange === '500_1000')    return s.price >= 500 && s.price <= 1000;
        if (priceRange === '1000_5000')   return s.price >= 1000 && s.price <= 5000;
        if (priceRange === '5000_10000')  return s.price >= 5000 && s.price <= 10000;
        if (priceRange === 'ABOVE_10000') return s.price > 10000;
        return true;
      });
    }

    // Sort: in BUY mode score desc, in SELL mode sort by sell relevance
    data.sort((a, b) => {
      if (isSell) {
        // SELL: prioritize high RVOL + price falling
        const sellScoreA = a.score + (a.rvol >= 2.0 ? 20 : 0) + (a.consecutiveVol ? 10 : 0);
        const sellScoreB = b.score + (b.rvol >= 2.0 ? 20 : 0) + (b.consecutiveVol ? 10 : 0);
        if (sellScoreB !== sellScoreA) return sellScoreB - sellScoreA;
        return b.rvol - a.rvol;
      }
      // BUY: default score descending
      if (b.score !== a.score) return b.score - a.score;
      return b.rvol - a.rvol;
    });

    return data;
  }, [volumeScanner, rvolThreshold, minSpike1m, minSpike5m, activeFilters, search, isSell, priceRange]);

  const totalPages = Math.max(1, Math.ceil(ranked.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = ranked.slice((safePage - 1) * pageSize, safePage * pageSize);

  const summary = volumeScanner.summary || {};

  return (
    <div className="d-flex flex-column gap-3" style={{ color: 'var(--tp-text)' }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h4 className="fw-bold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--tp-text)' }}>
            <FaFire style={{ color: '#F97316' }} />
            {isSell ? '🔻 Volume Sell Scanner' : '🟢 Volume Buy Scanner'}
            <span
              className="badge rounded-pill px-3 py-1 fw-bold ms-1"
              style={{
                fontSize: '0.72rem',
                backgroundColor: isSell ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                color: isSell ? '#EF4444' : '#22C55E',
                border: `1px solid ${isSell ? '#EF4444' : '#22C55E'}`
              }}
            >
              {isSell ? 'SELL / SHORT MODE' : 'BUY / LONG MODE'}
            </span>
          </h4>
          <small className="text-muted">
            {isSell
              ? 'Showing stocks with heavy selling volume — price falling + RVOL spikes + distribution signals'
              : 'Showing stocks with strong buying volume — price rising + RVOL spikes + accumulation signals'}
            &nbsp;— {ranked.length} stocks
          </small>
        </div>
        {/* Live indicator + Trade Mode Toggle */}
        <div className="d-flex align-items-center gap-3">
          <span className="badge rounded-pill px-3 py-2"
            style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ADE80', fontSize: '0.78rem' }}>
            ● LIVE
          </span>
          <button
            onClick={toggleTradeMode}
            className="btn btn-sm rounded-pill px-4 py-2 fw-bold border-0"
            style={{
              backgroundColor: isSell ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
              color: isSell ? '#FCA5A5' : '#86EFAC',
              border: `2px solid ${isSell ? '#EF4444' : '#22C55E'}`,
              fontSize: '0.82rem',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
          >
            {isSell ? '🔴 SELL' : '🟢 BUY'} — Click to Switch
          </button>
        </div>
      </div>

      {/* ── Summary cards ───────────────────────────────────── */}
      <div className="row g-2">
        {[
          { label: 'High RVOL (≥2×)', value: summary.highRvol || 0, color: '#F97316' },
          { label: '1-min Spikes', value: summary.spike1mCount || 0, color: '#EF4444' },
          { label: '5-min Spikes', value: summary.spike5mCount || 0, color: '#F59E0B' },
          { label: 'Vol ↑ 3 Candles', value: summary.consecutiveVolCount || 0, color: '#10B981' },
          { label: 'Price ↑ + Vol ↑', value: summary.priceUpVolUpCount || 0, color: '#3B82F6' },
        ].map(card => (
          <div key={card.label} className="col-6 col-md">
            <div className="tp-card p-2 text-center" style={{ borderTop: `3px solid ${card.color}` }}>
              <div className="fw-bold" style={{ fontSize: '1.4rem', color: card.color }}>{card.value}</div>
              <small className="text-muted" style={{ fontSize: '0.68rem' }}>{card.label}</small>
            </div>
          </div>
        ))}
      </div>

      {/* ── Controls bar ────────────────────────────────────── */}
      <div className="tp-card p-3">
        <div className="d-flex flex-wrap align-items-center gap-3">
          {/* RVOL Threshold */}
          <div className="d-flex align-items-center gap-2">
            <small className="text-muted fw-semibold" style={{ whiteSpace: 'nowrap' }}>RVOL:</small>
            <div className="d-flex gap-1 flex-wrap">
              {RVOL_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => { setRvolThreshold(p.value); setPage(1); }}
                  className="btn btn-sm rounded-pill px-3 py-1 border-0"
                  style={{
                    backgroundColor: rvolThreshold === p.value ? 'var(--tp-primary)' : 'var(--tp-hover)',
                    color: rvolThreshold === p.value ? '#fff' : 'var(--tp-text)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                    opacity: rvolThreshold === p.value ? 1 : 0.7,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--tp-border)' }} />

          {/* 1-min Spike filter */}
          <div className="d-flex align-items-center gap-2">
            <small className="text-muted fw-semibold" style={{ whiteSpace: 'nowrap' }}>1-min Spike ≥</small>
            <select
              className="form-select form-select-sm"
              style={{ width: '90px', backgroundColor: 'var(--tp-bg)', borderColor: 'var(--tp-border)', color: 'var(--tp-text)' }}
              value={minSpike1m}
              onChange={e => { setMinSpike1m(parseFloat(e.target.value)); setPage(1); }}
            >
              <option value={0}>Any</option>
              <option value={1.5}>1.5×</option>
              <option value={2.0}>2×</option>
              <option value={3.0}>3×</option>
              <option value={5.0}>5×</option>
            </select>
          </div>

          {/* 5-min Spike filter */}
          <div className="d-flex align-items-center gap-2">
            <small className="text-muted fw-semibold" style={{ whiteSpace: 'nowrap' }}>5-min Spike ≥</small>
            <select
              className="form-select form-select-sm"
              style={{ width: '90px', backgroundColor: 'var(--tp-bg)', borderColor: 'var(--tp-border)', color: 'var(--tp-text)' }}
              value={minSpike5m}
              onChange={e => { setMinSpike5m(parseFloat(e.target.value)); setPage(1); }}
            >
              <option value={0}>Any</option>
              <option value={1.5}>1.5×</option>
              <option value={2.0}>2×</option>
              <option value={3.0}>3×</option>
              <option value={5.0}>5×</option>
            </select>
          </div>
        </div>

        {/* Second row: toggle filters + search */}
        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
          {(isSell ? SELL_FILTERS : BUY_FILTERS).map(f => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className="btn btn-sm rounded-pill px-3 py-1 border-0 d-flex align-items-center gap-1"
              style={{
                backgroundColor: activeFilters[f.key] ? 'var(--tp-primary)' : 'var(--tp-hover)',
                color: activeFilters[f.key] ? '#fff' : 'var(--tp-text)',
                fontSize: '0.73rem',
                fontWeight: 500,
                transition: 'all 0.15s',
                opacity: activeFilters[f.key] ? 1 : 0.7,
              }}
            >
              {f.icon}
              {f.label}
            </button>
          ))}

          <div className="ms-auto d-flex align-items-center gap-2">
            <FaSearch className="text-muted" />
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search symbol or name..."
              style={{
                width: '200px',
                backgroundColor: 'var(--tp-bg)',
                borderColor: 'var(--tp-border)',
                color: 'var(--tp-text)',
                fontSize: '0.8rem'
              }}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <select
              className="form-select form-select-sm"
              style={{ width: '155px', backgroundColor: 'var(--tp-bg)', borderColor: 'var(--tp-border)', color: 'var(--tp-text)', fontSize: '0.78rem' }}
              value={priceRange}
              onChange={e => { setPriceRange(e.target.value); setPage(1); }}
            >
              <option value="ALL">💰 All Prices</option>
              <option value="BELOW_100">Below ₹100</option>
              <option value="100_500">₹100 – ₹500</option>
              <option value="500_1000">₹500 – ₹1,000</option>
              <option value="1000_5000">₹1,000 – ₹5,000</option>
              <option value="5000_10000">₹5,000 – ₹10,000</option>
              <option value="ABOVE_10000">Above ₹10,000</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Column Guide ───────────────────────────────────── */}
      <div className="tp-card p-3">
        <div className="d-flex flex-wrap align-items-center gap-2 gap-xl-3" style={{ fontSize: '0.72rem' }}>
          <span className="fw-semibold text-muted me-1">Guide:</span>
          <span><span style={{ color: '#FCA5A5' }}>🔥 Exceptional ≥5×</span></span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span><span style={{ color: '#FDBA74' }}>🚀 Very High ≥3×</span></span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span><span style={{ color: '#FDE047' }}>📈 High ≥2×</span></span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span><span style={{ color: '#86EFAC' }}>🟢 Above Avg ≥1.2×</span></span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span className="text-muted">⚪ Normal &lt;1.2×</span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span>1m/5m Spike = candle vol ÷ avg</span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span>Vol ↑3 = 3 rising candles</span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span>P↑+V↑ = Price &amp; Vol both up</span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span>🚀 Breakout = near resistance + vol</span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span>📈 Gap Up = gap ≥1% + high vol</span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span>Score = composite 0–100</span>
          <span style={{ color: 'var(--tp-border)' }}>|</span>
          <span>Signal = <span style={{ color: 'var(--tp-success)' }}>🟢 Buy</span> / <span style={{ color: 'var(--tp-danger)' }}>🔴 Sell</span></span>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="tp-card p-0" style={{ overflowX: 'auto' }}>
        <table className="table tp-table table-hover mb-0" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Symbol</th>
              <th className="text-end">Price</th>
              <th className="text-end">Chg%</th>
              <th className="text-end">Volume</th>
              <th className="text-center">RVOL</th>
              <th className="text-center">1-min Spike</th>
              <th className="text-center">5-min Spike</th>
              <th className="text-center">Vol ↑3</th>
              <th className="text-center">P↑+V↑</th>
              <th className="text-center">Breakout</th>
              <th className="text-center">Gap Up</th>
              <th className="text-center">Score</th>
              <th className="text-center" style={{ minWidth: '130px' }}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-5 text-muted">
                  <FaFilter className="me-2" />
                  No stocks match the current filters. Try lowering the RVOL threshold.
                </td>
              </tr>
            ) : (
              paginated.map((stock, idx) => {
                const rvolClass = getRvolClass(stock.rvol);
                const volSignal = getVolumeSignal(stock);
                const spike1Style = getSpikeStyle(stock.spike1m);
                const spike5Style = getSpikeStyle(stock.spike5m);
                const globalIdx = (safePage - 1) * pageSize + idx + 1;
                const chgPct = stock.previousClose > 0
                  ? ((stock.price - stock.previousClose) / stock.previousClose * 100).toFixed(2)
                  : '—';
                const isUp = parseFloat(chgPct) >= 0;

                return (
                  <tr
                    key={stock.symbol}
                    onClick={() => handleStockClick(stock.symbol)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Rank */}
                    <td style={{ fontWeight: 600 }}>
                      {globalIdx <= 3 ? (
                        <span style={{ fontSize: '1rem' }}>
                          {globalIdx === 1 ? '🥇' : globalIdx === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>{globalIdx}</span>
                      )}
                    </td>

                    {/* Symbol + Name */}
                    <td>
                      <div className="fw-bold" style={{ fontSize: '0.84rem', color: 'var(--tp-text)' }}>{stock.symbol}</div>
                      <small className="text-muted" style={{ fontSize: '0.65rem' }}>{stock.name}</small>
                    </td>

                    {/* Price */}
                    <td className="text-end fw-semibold" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--tp-text)' }}>
                      ₹{stock.price?.toFixed(2)}
                    </td>

                    {/* Change % */}
                    <td className="text-end fw-semibold" style={{
                      color: isUp ? 'var(--tp-success)' : 'var(--tp-danger)',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {isUp ? '+' : ''}{chgPct}%
                    </td>

                    {/* Volume */}
                    <td className="text-end text-muted" style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}>
                      {(stock.volume / 100000).toFixed(1)}L
                    </td>

                    {/* RVOL */}
                    <td className="text-center">
                      <span
                        className="badge rounded-pill px-2 py-1 fw-bold"
                        style={{
                          backgroundColor: rvolClass.bg,
                          color: rvolClass.color,
                          fontSize: '0.75rem',
                          boxShadow: rvolClass.glow,
                        }}
                      >
                        {rvolClass.label}
                      </span>
                      <div className="text-muted mt-1" style={{ fontSize: '0.65rem' }}>{stock.rvol}×</div>
                    </td>

                    {/* 1-min Spike */}
                    <td className="text-center fw-semibold" style={{
                      color: spike1Style.color,
                      fontWeight: spike1Style.weight,
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {stock.spike1m >= 1.5 ? '⚡ ' : ''}{stock.spike1m}×
                    </td>

                    {/* 5-min Spike */}
                    <td className="text-center fw-semibold" style={{
                      color: spike5Style.color,
                      fontWeight: spike5Style.weight,
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {stock.spike5m >= 1.5 ? '⚡ ' : ''}{stock.spike5m}×
                    </td>

                    {/* Consecutive Vol ↑ */}
                    <td className="text-center">
                      {stock.consecutiveVol ? (
                        <span style={{ color: 'var(--tp-success)', fontSize: '1rem' }}>✅</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Price ↑ + Vol ↑ */}
                    <td className="text-center">
                      {stock.priceUpVolumeUp ? (
                        <span style={{ color: 'var(--tp-info)', fontSize: '1rem' }}>✅</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Breakout + Vol */}
                    <td className="text-center">
                      {stock.breakoutVolume ? (
                        <span style={{ fontSize: '1rem' }}>🚀</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Gap Up + Vol */}
                    <td className="text-center">
                      {stock.gapUpVolume ? (
                        <span style={{ fontSize: '1rem' }}>📈</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Composite Score */}
                    <td className="text-center">
                      <span className="badge rounded-pill px-2 py-1 fw-bold"
                        style={{
                          backgroundColor: stock.score >= 60 ? 'rgba(239,68,68,0.2)' :
                                           stock.score >= 40 ? 'rgba(251,146,60,0.2)' :
                                           stock.score >= 25 ? 'rgba(250,204,21,0.2)' :
                                           'rgba(156,163,175,0.15)',
                          color: stock.score >= 60 ? '#FCA5A5' :
                                  stock.score >= 40 ? '#FDBA74' :
                                  stock.score >= 25 ? '#FDE047' :
                                  'var(--tp-text-muted)',
                          fontSize: '0.78rem'
                        }}
                      >
                        {stock.score}
                      </span>
                    </td>

                    {/* Buy/Sell Signal — mode-aware highlight */}
                    <td className="text-center">
                      {(() => {
                        const sig = volSignal;
                        const isBuySignal = sig.label.includes('Buy');
                        const isSellSignal = sig.label.includes('Sell');
                        const isRelevant = (isSell && isSellSignal) || (!isSell && isBuySignal);

                        return (
                          <span className="badge rounded-pill px-2 py-1"
                            style={{
                              backgroundColor: isRelevant ? sig.bg : 'rgba(156,163,175,0.06)',
                              color: isRelevant ? sig.color : 'var(--tp-text-muted)',
                              fontWeight: isRelevant ? sig.weight : 'normal',
                              fontSize: '0.73rem',
                              opacity: isRelevant ? 1 : 0.5,
                            }}
                          >
                            {sig.label}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      <div className="tp-card p-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <small className="text-muted">
              Showing <strong style={{ color: 'var(--tp-text)' }}>{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, ranked.length)}</strong> of <strong style={{ color: 'var(--tp-text)' }}>{ranked.length}</strong> stocks
            </small>
            <div className="d-flex align-items-center gap-2">
              <small className="text-muted">Rows:</small>
              <select
                className="form-select form-select-sm"
                style={{ width: '75px', backgroundColor: 'var(--tp-bg)', borderColor: 'var(--tp-border)', color: 'var(--tp-text)' }}
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              // Show pages around current page
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (safePage <= 4) {
                pageNum = i + 1;
              } else if (safePage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = safePage - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  className="btn btn-sm rounded-2 border-0"
                  style={{
                    minWidth: '34px',
                    backgroundColor: pageNum === safePage ? 'var(--tp-primary)' : 'var(--tp-hover)',
                    color: pageNum === safePage ? '#fff' : 'var(--tp-text)',
                    fontWeight: pageNum === safePage ? 700 : 400,
                    fontSize: '0.8rem',
                  }}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VolumeScanner;
