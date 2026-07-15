import React from 'react';
import { useApp } from '../context/AppContext';
import { FaArrowUp, FaArrowDown, FaMinus } from 'react-icons/fa';

const TREND_CONFIG = {
  'Bullish':              { color: '#22C55E', bg: 'rgba(34,197,94,0.1)',  emoji: '🟢' },
  'Moderately Bullish':   { color: '#4ADE80', bg: 'rgba(74,222,128,0.08)', emoji: '🟩' },
  'Neutral':              { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', emoji: '🟡' },
  'Moderately Bearish':   { color: '#F87171', bg: 'rgba(248,113,113,0.08)', emoji: '🟠' },
  'Bearish':              { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',  emoji: '🔴' }
};

export const MarketBreadth = () => {
  const { breadth, sectorScores } = useApp();

  // Merge sector scores into breadth for display
  const enrichedBreadth = breadth.map(b => {
    const score = sectorScores?.find(s => s.sector === b.sector);
    return { ...b, score: score?.score ?? null, trend: score?.trend || b.trend };
  });

  if (!enrichedBreadth || enrichedBreadth.length === 0) {
    return (
      <div className="tp-card text-center text-muted py-4">
        Computing market breadth data...
      </div>
    );
  }

  return (
    <div className="tp-card">
      <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--tp-border)' }}>
        <div>
          <h5 className="mb-0 fw-bold" style={{ color: 'var(--tp-text)' }}>
            📊 Market Breadth
          </h5>
          <small className="text-muted">Sector-level advance/decline & technical health</small>
        </div>
        <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: '0.7rem' }}>
          {enrichedBreadth.length} SECTORS
        </span>
      </div>

      <div className="table-responsive" style={{ maxHeight: '420px' }}>
        <table className="table tp-table table-hover mb-0">
          <thead>
            <tr>
              <th>Sector</th>
              <th className="text-center">Stocks</th>
              <th className="text-center">Rising</th>
              <th className="text-center">Falling</th>
              <th className="text-center">% Above 50 EMA</th>
              <th className="text-center">RSI Avg</th>
              <th className="text-center">Chg %</th>
              <th className="text-center">Score</th>
              <th className="text-center">Trend</th>
            </tr>
          </thead>
          <tbody>
            {enrichedBreadth.map((b) => {
              const trend = TREND_CONFIG[b.trend?.replace(/[🟢🔴🟡]/g, '').trim()] || TREND_CONFIG['Neutral'];
              const emaColor = b.aboveEMA50Pct >= 80 ? 'text-success fw-bold' : b.aboveEMA50Pct >= 60 ? 'text-success' : b.aboveEMA50Pct >= 40 ? 'text-warning' : b.aboveEMA50Pct >= 20 ? 'text-danger' : 'text-danger fw-bold';
              const rsiColor = b.avgRSI >= 60 ? 'text-success' : b.avgRSI <= 40 ? 'text-danger' : '';
              const chgColor = b.avgChange >= 0 ? 'text-success' : 'text-danger';
              const advanceBarColor = b.advancePct >= 60 ? '#22C55E' : b.advancePct >= 40 ? '#F59E0B' : '#EF4444';

              return (
                <tr
                  key={b.sector}
                  className="tp-table-row-hover"
                  style={{ borderLeft: `3px solid ${trend.color}` }}
                >
                  <td className="fw-bold" style={{ color: 'var(--tp-text)' }}>
                    {b.sector}
                  </td>
                  <td className="text-center text-muted" style={{ fontSize: '0.85rem' }}>
                    {b.total}
                  </td>
                  <td className="text-center text-success fw-semibold" style={{ fontSize: '0.85rem' }}>
                    <FaArrowUp style={{ fontSize: '0.6rem' }} /> {b.rising}
                  </td>
                  <td className="text-center text-danger fw-semibold" style={{ fontSize: '0.85rem' }}>
                    <FaArrowDown style={{ fontSize: '0.6rem' }} /> {b.falling}
                  </td>
                  <td className="text-center">
                    <div className="d-flex flex-column align-items-center" style={{ minWidth: '80px' }}>
                      <span className={`fw-bold ${emaColor}`} style={{ fontSize: '0.85rem' }}>
                        {b.aboveEMA50Pct}%
                      </span>
                      <div className="progress w-100 bg-dark mt-1" style={{ height: '3px' }}>
                        <div
                          className="progress-bar"
                          style={{ width: `${b.aboveEMA50Pct}%`, backgroundColor: emaColor === 'text-success' ? '#22C55E' : emaColor === 'text-warning' ? '#F59E0B' : '#EF4444' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={`text-center fw-bold ${rsiColor}`} style={{ fontSize: '0.85rem' }}>
                    {b.avgRSI}
                  </td>
                  <td className={`text-center fw-semibold ${chgColor}`} style={{ fontSize: '0.85rem' }}>
                    {b.avgChange >= 0 ? '+' : ''}{b.avgChange}%
                  </td>
                  <td className="text-center fw-bold" style={{ fontSize: '0.85rem', color: 'var(--tp-text)' }}>
                    {b.score != null ? (
                      <span
                        className="badge rounded-pill px-2 py-1 fw-bold"
                        style={{
                          backgroundColor: b.score >= 75 ? 'rgba(34,197,94,0.15)' : b.score >= 50 ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)',
                          color: b.score >= 75 ? '#22C55E' : b.score >= 50 ? '#3B82F6' : '#EF4444',
                          fontSize: '0.75rem'
                        }}
                      >
                        {b.score}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span
                      className="badge rounded-pill px-3 py-1 fw-bold"
                      style={{
                        backgroundColor: trend.bg,
                        color: trend.color,
                        border: `1px solid ${trend.color}44`,
                        fontSize: '0.72rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {trend.emoji} {b.trend}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MarketBreadth;
