import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FaTrash, FaPlus, FaEye, FaSync, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import axios from 'axios';
import ConfirmModal from './ConfirmModal';

const API_BASE = 'http://localhost:5000/api';

export const WatchlistManager = () => {
  const {
    watchlists,
    activeWatchlist,
    setActiveWatchlist,
    stocks,
    updateWatchlist,
    setSelectedStock,
    setActiveView
  } = useApp();

  const [newSymbol, setNewSymbol] = useState('');
  const [availableStocks, setAvailableStocks] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncConfirmModal, setSyncConfirmModal] = useState(false);

  // Fetch available stocks for autocomplete
  useEffect(() => {
    axios.get(`${API_BASE}/watchlist/available`)
      .then(res => setAvailableStocks(res.data))
      .catch(() => setAvailableStocks(stocks));
  }, [stocks]);

  const currentWl = watchlists.find(wl => wl.name === activeWatchlist) || { name: activeWatchlist, stocks: [] };

  const handleAddSymbol = (e) => {
    e.preventDefault();
    if (!newSymbol) return;
    const sym = newSymbol.toUpperCase().trim();
    
    if (currentWl.stocks.includes(sym)) {
      alert(`"${sym}" is already in the "${activeWatchlist}" watchlist.`);
      return;
    }

    const updatedList = [...currentWl.stocks, sym];
    updateWatchlist(activeWatchlist, updatedList);
    setNewSymbol('');
  };

  const handleRemoveSymbol = (sym) => {
    const updatedList = currentWl.stocks.filter(s => s !== sym);
    updateWatchlist(activeWatchlist, updatedList);
  };

  const handleViewDetails = (sym) => {
    setSelectedStock(sym);
    setActiveView('charts');
  };

  // Sync watchlist with live Zerodha tracked stocks
  const handleSyncPositions = () => {
    setSyncConfirmModal(true);
  };

  const handleSyncConfirm = async () => {
    setSyncConfirmModal(false);
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await axios.post(`${API_BASE}/watchlist/sync`, { watchlistName: activeWatchlist });
      setSyncResult({ success: true, message: `✅ Synced ${res.data.count} stocks from live positions to "${activeWatchlist}"` });
      // Refresh watchlists
      await axios.get(`${API_BASE}/watchlist`);
      window.location.reload();
    } catch (e) {
      setSyncResult({ success: false, message: '❌ Sync failed: ' + (e.response?.data?.message || e.message) });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const handleSyncCancel = () => {
    setSyncConfirmModal(false);
  };

  const wlStocksData = currentWl.stocks.map(sym => stocks.find(s => s.symbol === sym)).filter(Boolean);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(wlStocksData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedStocks = wlStocksData.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 when watchlist changes
  useEffect(() => { setPage(1); }, [activeWatchlist]);

  return (
    <div className="row g-4">
      <div className="col-12 col-md-4 col-xl-3">
        <div className="tp-card">
          <h6 className="fw-bold text-white mb-3">Watchlists</h6>
          <div className="d-flex flex-column gap-2">
            {watchlists.map((wl) => (
              <button
                key={wl.name}
                className={`btn text-start d-flex align-items-center justify-content-between px-3 py-2 rounded-3 smooth-transition ${activeWatchlist === wl.name ? 'btn-primary' : 'btn-dark border border-secondary text-light'}`}
                onClick={() => setActiveWatchlist(wl.name)}
              >
                <span>{wl.name}</span>
                <span className="badge bg-dark text-muted border border-secondary" style={{ fontSize: '0.7rem' }}>{wl.stocks.length}</span>
              </button>
            ))}
          </div>

          {/* Sync button */}
          <button
            className="btn btn-sm w-100 mt-3 d-flex align-items-center justify-content-center gap-2"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', border: 'none', fontSize: '0.8rem' }}
            onClick={handleSyncPositions}
            disabled={syncing}
            title="Pull all live tracked stocks into this watchlist"
          >
            <FaSync className={syncing ? 'spin-icon' : ''} /> {syncing ? 'Syncing...' : 'Sync Live Positions'}
          </button>
          <small className="text-muted d-block text-center mt-1" style={{ fontSize: '0.65rem' }}>
            {availableStocks.length} stocks available
          </small>

          {syncResult && (
            <div className={`alert py-2 px-3 mt-2 mb-0 border ${syncResult.success ? 'text-success border-success' : 'text-danger border-danger'}`} style={{ fontSize: '0.78rem', background: 'transparent' }}>
              {syncResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Active List */}
      <div className="col-12 col-md-8 col-xl-9">
        <div className="tp-card">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 pb-3 border-bottom border-secondary mb-4">
            <div>
              <h5 className="mb-0 fw-bold text-white">{activeWatchlist}</h5>
              <small className="text-muted">{wlStocksData.length} stocks · Live prices via Zerodha</small>
            </div>

            <form onSubmit={handleAddSymbol} className="d-flex align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm bg-dark border-secondary text-white"
                placeholder="Add symbol…"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                list="stock-suggestions"
                style={{ width: '160px' }}
              />
              <datalist id="stock-suggestions">
                {availableStocks.map(s => (
                  <option key={s.symbol} value={s.symbol}>{s.symbol} — ₹{s.price?.toFixed(2)} — {s.sector}</option>
                ))}
              </datalist>
              <button type="submit" className="btn btn-sm btn-success d-flex align-items-center gap-1 px-3">
                <FaPlus /> Add
              </button>
            </form>
          </div>

          <div className="table-responsive">
            <table className="table tp-table table-hover">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Price</th>
                  <th>Change %</th>
                  <th>VWAP</th>
                  <th>RSI</th>
                  <th>ADX</th>
                  <th>Sector</th>
                  <th className="text-center">Signal</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStocks.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center text-muted py-5">
                      Empty watchlist. Click <strong>Sync Live Positions</strong> or add stocks manually.
                    </td>
                  </tr>
                ) : (
                  paginatedStocks.map((s) => {
                    const refPrice = s.previousClose || s.close || s.price;
                    const isUp = s.price >= refPrice;
                    const changePct = (s.previousClose || s.close) ? (((s.price - refPrice) / refPrice) * 100).toFixed(2) : '0.00';
                    const changeColor = isUp ? 'text-success' : 'text-danger';

                    let badgeClass = 'badge-hold';
                    const action = s.recommendation?.action || 'HOLD';
                    if (action === 'BUY') badgeClass = 'badge-buy';
                    else if (action === 'EXIT') badgeClass = 'badge-exit';
                    else if (action === 'BOOK PROFIT') badgeClass = 'badge-profit';
                    else if (action === 'WATCH') badgeClass = 'badge-watch';

                    return (
                      <tr key={s.symbol}>
                        <td className="fw-bold text-white">{s.symbol}</td>
                        <td className="fw-bold">₹{s.price?.toFixed(2) || '—'}</td>
                        <td className={`fw-semibold ${changeColor}`}>
                          {isUp ? '▲' : '▼'} {changePct}%
                        </td>
                        <td>₹{s.vwap?.toFixed(2) || '—'}</td>
                        <td>{s.rsi?.toFixed(1) || '—'}</td>
                        <td>{s.adx?.toFixed(1) || '—'}</td>
                        <td>{s.sector || '—'}</td>
                        <td className="text-center">
                          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem' }}>{action}</span>
                        </td>
                        <td className="text-center">
                          <div className="d-flex align-items-center justify-content-center gap-2">
                            <button className="btn btn-sm btn-outline-info" style={{ fontSize: '0.7rem' }} onClick={() => handleViewDetails(s.symbol)}>
                              <FaEye /> Chart
                            </button>
                            <button className="btn btn-sm btn-outline-danger" style={{ fontSize: '0.7rem' }} onClick={() => handleRemoveSymbol(s.symbol)}>
                              <FaTrash />
                            </button>
                          </div>
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
                Showing <strong style={{ color: 'var(--tp-text)' }}>{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, wlStocksData.length)}</strong> of <strong style={{ color: 'var(--tp-text)' }}>{wlStocksData.length}</strong> stocks
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
        </div>
      </div>

      {/* Sync Confirmation Modal */}
      <ConfirmModal
        show={syncConfirmModal}
        title="Sync Live Positions"
        message={`This will replace all stocks in "${activeWatchlist}" with your current live Zerodha tracked positions. Continue?`}
        confirmLabel="Sync Now"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={handleSyncConfirm}
        onCancel={handleSyncCancel}
      />
    </div>
  );
};

export default WatchlistManager;
