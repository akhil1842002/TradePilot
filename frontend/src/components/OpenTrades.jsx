import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FaTimesCircle, FaCheck, FaExclamationTriangle, FaSync, FaLink } from 'react-icons/fa';

export const OpenTrades = () => {
  const { openTrades, closeTrade, syncKitePositions, isSimulation } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleSyncKite = async () => {
    setSyncing(true);
    setSyncResult(null);
    const result = await syncKitePositions();
    setSyncResult(result);
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 5000);
  };

  // Exit position modal state
  const [exitingTrade, setExitingTrade] = useState(null);
  const [exitPrice, setExitPrice] = useState('');
  const [reason, setReason] = useState('');
  const [emotion, setEmotion] = useState('Patience');
  const [mistake, setMistake] = useState('None');
  const [notes, setNotes] = useState('');

  const handleOpenExitModal = (trade) => {
    setExitingTrade(trade);
    setExitPrice(trade.currentPrice);
    setReason(trade.recommendation === 'BOOK PROFIT' ? 'Target Reached' : (trade.recommendation === 'EXIT' ? 'Stoploss Triggered' : 'Manual Close'));
  };

  const handleConfirmExit = async (e) => {
    e.preventDefault();
    if (!exitingTrade) return;

    const details = {
      exitPrice: Number(exitPrice),
      reason,
      emotion,
      mistake,
      notes
    };

    const res = await closeTrade(exitingTrade._id || exitingTrade.id, details);
    if (res.success) {
      setExitingTrade(null);
      setExitPrice('');
      setReason('');
      setEmotion('Patience');
      setMistake('None');
      setNotes('');
    }
  };

  // Calculate total active P&L
  const totalPnL = openTrades.reduce((sum, t) => sum + (t.currentProfit || 0), 0);
  const pnlClass = totalPnL >= 0 ? 'text-success' : 'text-danger';

  return (
    <div className="d-flex flex-column gap-4">
      {/* Portfolio/Open Position Header metrics card */}
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <div className="tp-card text-center">
            <small className="text-muted d-block uppercase" style={{ fontSize: '0.7rem' }}>ACTIVE POSITIONS</small>
            <span className="fs-2 fw-extrabold text-white">{openTrades.length}</span>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="tp-card text-center">
            <small className="text-muted d-block uppercase" style={{ fontSize: '0.7rem' }}>TOTAL EXPENDITURE</small>
            <span className="fs-2 fw-extrabold text-white">
              ₹{openTrades.reduce((sum, t) => sum + (t.entry * t.quantity), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="tp-card text-center">
            <small className="text-muted d-block uppercase" style={{ fontSize: '0.7rem' }}>TOTAL ACTIVE P&L</small>
            <span className={`fs-2 fw-extrabold ${pnlClass}`}>
              {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Trades Grid Table */}
      <div className="tp-card">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <h5 className="fw-bold text-white mb-0">Live Active Positions</h5>
          <button
            className="btn btn-sm d-flex align-items-center gap-2 fw-bold"
            style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', border: '1px solid #4fc3f7', color: '#4fc3f7', borderRadius: '8px', padding: '6px 14px' }}
            onClick={handleSyncKite}
            disabled={syncing}
            title={isSimulation ? 'Fill KITE_API_SECRET & KITE_ACCESS_TOKEN in .env and set SIMULATION_MODE=false to enable live sync' : 'Import your real Zerodha positions into TradePilot'}
          >
            <FaSync className={syncing ? 'spin-icon' : ''} />
            {syncing ? 'Syncing...' : '🔗 Sync from Kite'}
          </button>
        </div>
        {syncResult && (
          <div className={`alert py-2 px-3 mb-3 border ${syncResult.success ? 'text-success border-success' : 'text-danger border-danger'}`} style={{ fontSize: '0.82rem', background: 'transparent' }}>
            {syncResult.success
              ? `✅ Synced ${syncResult.count} position(s) from your Zerodha account successfully.`
              : `❌ ${syncResult.error}`}
          </div>
        )}
        
        <div className="table-responsive">
          <table className="table tp-table table-hover">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Qty</th>
                <th>Avg. Entry</th>
                <th>Current Price</th>
                <th>Target</th>
                <th>Stop Loss</th>
                <th>Holding Time</th>
                <th>Unrealized P&L</th>
                <th className="text-center">Advice</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center text-muted py-5">
                    No active positions currently running. Open positions from Stock details.
                  </td>
                </tr>
              ) : (
                openTrades.map((t) => {
                  const pnl = t.currentProfit || 0;
                  const isProfit = pnl >= 0;
                  const valColor = isProfit ? 'text-success' : 'text-danger';

                  // Advice badge mapping
                  let adviceBadge = 'badge-hold';
                  if (t.recommendation === 'BUY MORE') adviceBadge = 'badge-buy';
                  if (t.recommendation === 'BOOK PROFIT') adviceBadge = 'badge-profit';
                  if (t.recommendation === 'EXIT') adviceBadge = 'badge-exit';

                  return (
                    <tr key={t._id || t.id}>
                      <td className="fw-bold text-white">
                        {t.symbol}
                        <span className={`badge ms-2 ${t.type === 'SELL' ? 'bg-danger' : 'bg-success'}`} style={{ fontSize: '0.62rem' }}>
                          {t.type === 'SELL' ? 'SHORT' : 'LONG'}
                        </span>
                      </td>
                      <td>{t.quantity}</td>
                      <td>₹{t.entry.toFixed(2)}</td>
                      <td>₹{(t.currentPrice || t.entry).toFixed(2)}</td>
                      <td className="text-success">₹{t.target.toFixed(2)}</td>
                      <td className="text-danger">₹{t.stoploss.toFixed(2)}</td>
                      <td className="text-muted">{t.holdingTime || 1} min</td>
                      <td className={`fw-bold ${valColor}`}>
                        {isProfit ? '+' : ''}₹{pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${adviceBadge}`} style={{ fontSize: '0.7rem' }}>
                          {t.recommendation}
                        </span>
                      </td>
                      <td className="text-center">
                        <button 
                          className="btn btn-sm btn-danger px-2.5 py-1"
                          style={{ fontSize: '0.85rem' }}
                          onClick={() => handleOpenExitModal(t)}
                        >
                          Exit Position
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exit & Auto Journal Modal */}
      {exitingTrade && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.65)', 
            zIndex: 1100, 
            backdropFilter: 'blur(4px)' 
          }}
        >
          <div className="tp-card w-100 m-3" style={{ maxWidth: '500px' }}>
            <div className="d-flex align-items-center justify-content-between pb-2 border-bottom border-secondary mb-3">
              <h5 className="mb-0 fw-bold text-white">Exit Position: {exitingTrade.symbol}</h5>
              <button 
                className="btn btn-link text-muted p-0 border-0 bg-transparent"
                onClick={() => setExitingTrade(null)}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleConfirmExit}>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>ENTRY PRICE</label>
                  <input type="text" className="form-control bg-dark border-secondary text-white" value={`₹${exitingTrade.entry.toFixed(2)}`} disabled />
                </div>
                <div className="col-6">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>EXIT PRICE</label>
                  <input 
                    type="number" 
                    step="0.05"
                    className="form-control bg-dark border-secondary text-white" 
                    value={exitPrice} 
                    onChange={(e) => setExitPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>EXIT REASON / STRATEGY</label>
                <input 
                  type="text" 
                  className="form-control bg-dark border-secondary text-white" 
                  placeholder="e.g. Pivot Resistance met, Stoploss triggered, etc."
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>EMOTION</label>
                  <select 
                    className="form-select bg-dark border-secondary text-white"
                    value={emotion}
                    onChange={(e) => setEmotion(e.target.value)}
                  >
                    <option value="Patience">Patience (Disciplined)</option>
                    <option value="FOMO">FOMO (Fear of Missing Out)</option>
                    <option value="Greed">Greed (Overstayed target)</option>
                    <option value="Fear">Fear (Exited too early)</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>MISTAKE MAPPING</label>
                  <select 
                    className="form-select bg-dark border-secondary text-white"
                    value={mistake}
                    onChange={(e) => setMistake(e.target.value)}
                  >
                    <option value="None">None (Disciplined)</option>
                    <option value="Chasing Trend">Chasing Trend</option>
                    <option value="Moved Stoploss">Moved Stoploss</option>
                    <option value="Overleveraged">Overleveraged</option>
                    <option value="Hasty Exit">Hasty Exit</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>NOTES</label>
                <textarea 
                  className="form-control bg-dark border-secondary text-white" 
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional trade logs..."
                ></textarea>
              </div>

              <button type="submit" className="btn btn-danger w-100 fw-bold py-2.5">
                Confirm Market Exit & Archive to Journal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenTrades;
