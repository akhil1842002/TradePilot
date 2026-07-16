import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FaBook, FaPlusCircle, FaHeart, FaExclamationTriangle, FaFileImage, FaTrash } from 'react-icons/fa';
import ConfirmModal from './ConfirmModal';

export const TradeJournal = () => {
  const { journalEntries, createJournalEntry, deleteJournalEntry } = useApp();

  // Manual Logger Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState('BUY');
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [pnlVal, setPnlVal] = useState('');
  const [pnlType, setPnlType] = useState('PROFIT');
  const [reason, setReason] = useState('');
  const [emotion, setEmotion] = useState('Patience');
  const [mistake, setMistake] = useState('None');
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState(''); // Simple base64/url mock
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Custom confirm modal state
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null });

  // Reset page when entries change
  useEffect(() => { setCurrentPage(1); }, [journalEntries.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!symbol || !entry) return;

    const val = Number(pnlVal) || 0;
    const profit = pnlType === 'PROFIT' ? val : 0;
    const loss = pnlType === 'LOSS' ? val : 0;

    const entryData = {
      symbol: symbol.toUpperCase(),
      type,
      entry: Number(entry),
      exit: exit ? Number(exit) : undefined,
      profit,
      loss,
      reason,
      emotion,
      mistake,
      notes,
      screenshot
    };

    const res = await createJournalEntry(entryData);
    if (res.success) {
      setSymbol('');
      setEntry('');
      setExit('');
      setPnlVal('');
      setReason('');
      setNotes('');
      setScreenshot('');
      setShowAddForm(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmModal({ show: true, id });
  };

  const handleDeleteConfirm = async () => {
    const id = confirmModal.id;
    setConfirmModal({ show: false, id: null });
    if (!id) return;
    const res = await deleteJournalEntry(id);
    if (!res.success) {
      alert('Failed to delete journal entry. Please try again.');
    }
  };

  const handleDeleteCancel = () => {
    setConfirmModal({ show: false, id: null });
  };

  // Pagination
  const totalPages = Math.ceil(journalEntries.length / ITEMS_PER_PAGE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEntries = journalEntries.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex align-items-center justify-content-between">
        <div>
          <h4 className="fw-bold text-white mb-1">Trade Journal</h4>
          <small className="text-muted">Maintain emotional discipline and record trading mistakes</small>
        </div>
        <button 
          className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <FaPlusCircle />
          {showAddForm ? 'Hide Form' : 'Log Manual Trade'}
        </button>
      </div>

      {/* Manual Logger Form */}
      {showAddForm && (
        <div className="tp-card">
          <h6 className="fw-bold text-white mb-3">Add Offline / Manual Journal Log</h6>
          <form onSubmit={handleSubmit}>
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>STOCK SYMBOL</label>
                <input 
                  type="text" 
                  className="form-control bg-dark border-secondary text-white" 
                  placeholder="e.g. BEL"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  required 
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>TYPE</label>
                <select className="form-select bg-dark border-secondary text-white" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>ENTRY PRICE</label>
                <input 
                  type="number" 
                  step="0.05"
                  className="form-control bg-dark border-secondary text-white" 
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  required 
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>EXIT PRICE</label>
                <input 
                  type="number" 
                  step="0.05"
                  className="form-control bg-dark border-secondary text-white" 
                  value={exit}
                  onChange={(e) => setExit(e.target.value)}
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-6 col-md-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>PnL DIRECTION</label>
                <select className="form-select bg-dark border-secondary text-white" value={pnlType} onChange={(e) => setPnlType(e.target.value)}>
                  <option value="PROFIT">PROFIT (₹)</option>
                  <option value="LOSS">LOSS (₹)</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>P&L AMOUNT</label>
                <input 
                  type="number" 
                  className="form-control bg-dark border-secondary text-white" 
                  value={pnlVal}
                  onChange={(e) => setPnlVal(e.target.value)}
                  required 
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>EMOTION</label>
                <select className="form-select bg-dark border-secondary text-white" value={emotion} onChange={(e) => setEmotion(e.target.value)}>
                  <option value="Patience">Patience (Disciplined)</option>
                  <option value="FOMO">FOMO (Fear of Missing Out)</option>
                  <option value="Greed">Greed (Overstayed target)</option>
                  <option value="Fear">Fear (Exited too early)</option>
                  <option value="Neutral">Neutral</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>MISTAKE</label>
                <select className="form-select bg-dark border-secondary text-white" value={mistake} onChange={(e) => setMistake(e.target.value)}>
                  <option value="None">None (Disciplined)</option>
                  <option value="Chasing Trend">Chasing Trend</option>
                  <option value="Moved Stoploss">Moved Stoploss</option>
                  <option value="Overleveraged">Overleveraged</option>
                  <option value="Hasty Exit">Hasty Exit</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>STRATEGY / SIGNAL REASON</label>
              <input 
                type="text" 
                className="form-control bg-dark border-secondary text-white" 
                placeholder="e.g. Above VWAP + Volume Spike breakout"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>DETAILED NOTES</label>
              <textarea 
                className="form-control bg-dark border-secondary text-white" 
                rows="2"
                placeholder="Document trading notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>

            <button type="submit" className="btn btn-success px-4 py-2 fw-bold">
              Save Journal Entry
            </button>
          </form>
        </div>
      )}

      {/* Historical List Card */}
      <div className="tp-card">
        <h5 className="fw-bold text-white mb-3">Historical Logs</h5>
        
        <div className="table-responsive">
          <table className="table tp-table table-hover">
            <thead>
              <tr>
                <th>Date</th>
                <th>Stock</th>
                <th>Action</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>P&L Result</th>
                <th>Strategy / Reason</th>
                <th>Emotion</th>
                <th>Mistake</th>
                <th>Notes</th>
                <th className="text-center">Del</th>
              </tr>
            </thead>
            <tbody>
              {journalEntries.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center text-muted py-5">
                    No logs found. Exit open trades or click 'Log Manual Trade' to create logs.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => {
                  const pnl = entry.profit - entry.loss;
                  const isProfit = pnl >= 0;
                  const pnlColor = isProfit ? 'text-success' : 'text-danger';
                  const dateStr = new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const entryId = entry._id || entry.id;

                  return (
                    <tr key={entryId}>
                      <td className="text-muted" style={{ fontSize: '0.8rem' }}>{dateStr}</td>
                      <td className="fw-bold text-white">{entry.symbol}</td>
                      <td>
                        <span className={`badge ${entry.type === 'BUY' ? 'badge-buy' : 'badge-exit'}`} style={{ fontSize: '0.65rem' }}>
                          {entry.type}
                        </span>
                      </td>
                      <td>₹{entry.entry.toFixed(2)}</td>
                      <td>{entry.exit ? `₹${entry.exit.toFixed(2)}` : '--'}</td>
                      <td className={`fw-bold ${pnlColor}`}>
                        {isProfit ? '+' : ''}₹{pnl.toFixed(2)}
                      </td>
                      <td>
                        <span className="text-white" style={{ fontSize: '0.85rem' }}>{entry.reason || 'General'}</span>
                      </td>
                      <td>
                        <span className="badge badge-emotion" style={{ fontSize: '0.7rem' }}>
                          <FaHeart className="me-1" />
                          {entry.emotion || 'Neutral'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-mistake" style={{ fontSize: '0.7rem' }}>
                          <FaExclamationTriangle className="me-1" />
                          {entry.mistake || 'None'}
                        </span>
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.notes}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-outline-danger border-0"
                          style={{ padding: '2px 6px' }}
                          title="Delete entry"
                          onClick={() => handleDeleteClick(entryId)}
                        >
                          <FaTrash style={{ fontSize: '0.7rem' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {journalEntries.length > 0 && (
          <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top gap-2" style={{ borderColor: 'var(--tp-border)' }}>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
              Showing <strong style={{ color: 'var(--tp-text)' }}>{paginatedEntries.length}</strong> of <strong style={{ color: 'var(--tp-text)' }}>{journalEntries.length}</strong> entries
              {totalPages > 1 && <span> — Page <strong>{safePage}</strong> of <strong>{totalPages}</strong></span>}
            </span>
            {totalPages > 1 && (
              <div className="d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>««</button>
                <button className="btn btn-sm btn-outline-secondary" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>« Prev</button>
                <span className="text-muted px-2" style={{ fontSize: '0.8rem' }}>{safePage} / {totalPages}</span>
                <button className="btn btn-sm btn-outline-secondary" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next »</button>
                <button className="btn btn-sm btn-outline-secondary" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»»</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Confirm Modal */}
      <ConfirmModal
        show={confirmModal.show}
        title="Delete Journal Entry"
        message="Are you sure you want to delete this journal entry? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default TradeJournal;
