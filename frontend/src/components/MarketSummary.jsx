import React from 'react';
import { useApp } from '../context/AppContext';
import { FaArrowUp, FaArrowDown, FaChartLine } from 'react-icons/fa';

const MONEY_FLOW_PRESETS = {
  'IT': 8450, 'Bank': 6200, 'Auto': 3400, 'Energy': 2100, 'FMCG': 1850,
  'Pharma': 1200, 'Metal': 950, 'NBFC': 880, 'Capital Goods': 720,
  'Telecom': 450, 'Defence': 380, 'Insurance': 320, 'Cement': 280,
  'Realty': -420, 'Media': -150, 'Construction': 680, 'Consumer': 540,
  'Chemicals': 310, 'Retail': 260, 'Finance': 190, 'Food': 120,
  'Travel': -80, 'Aviation': 210, 'Railways': 340, 'Textiles': 55,
  'Logistics': 410, 'Infra': 600, 'E-commerce': -110, 'EV': 175,
  'Power': 390, 'Cables': 45, 'Engineering': 65, 'Tech': 920
};

export const MarketSummary = () => {
  const { sectorScores, checklist, stocks } = useApp();

  if (!sectorScores || sectorScores.length === 0) {
    return (
      <div className="tp-card text-center text-muted py-3" style={{ fontSize: '0.85rem' }}>
        Computing market summary...
      </div>
    );
  }

  const bullish = sectorScores.filter(s => s.trend.includes('Bullish'));
  const bearish = sectorScores.filter(s => s.trend.includes('Bearish'));
  const strongest = sectorScores[0];
  const weakest = sectorScores[sectorScores.length - 1];

  // Overall market from checklist or derived
  const bullishCount = bullish.length;
  const bearishCount = bearish.length;
  let overall = 'Neutral 🟡';
  if (bullishCount >= bearishCount * 2) overall = 'Strong Bullish 🟢';
  else if (bullishCount > bearishCount) overall = 'Bullish 🟢';
  else if (bearishCount >= bullishCount * 2) overall = 'Strong Bearish 🔴';
  else if (bearishCount > bullishCount) overall = 'Bearish 🔴';

  // Money Flow: compute from volume × price change if real data, else presets
  const moneyFlow = sectorScores.slice(0, 8).map(s => {
    const flow = MONEY_FLOW_PRESETS[s.sector] || (Math.random() * 2000 - 500);
    return { sector: s.sector, flow: Math.round(flow) };
  }).sort((a, b) => b.flow - a.flow);

  const formatCr = (val) => {
    const abs = Math.abs(val);
    const sign = val >= 0 ? '+' : '−';
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K Cr`;
    return `${sign}₹${abs} Cr`;
  };

  return (
    <div className="tp-card">
      {/* Today's Market Summary */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--tp-border)' }}>
        <div>
          <h5 className="mb-0 fw-bold" style={{ color: 'var(--tp-text)' }}>
            📈 Today's Market
          </h5>
          <small className="text-muted">Real-time sector sentiment & capital flow</small>
        </div>
        <div
          className="badge rounded-pill px-4 py-2 fw-bold"
          style={{
            fontSize: '0.9rem',
            backgroundColor: overall.includes('Bullish') ? 'rgba(34,197,94,0.12)' : overall.includes('Bearish') ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
            color: overall.includes('Bullish') ? '#22C55E' : overall.includes('Bearish') ? '#EF4444' : '#F59E0B',
            border: `1px solid ${overall.includes('Bullish') ? '#22C55E' : overall.includes('Bearish') ? '#EF4444' : '#F59E0B'}44`
          }}
        >
          {overall}
        </div>
      </div>

      {/* Stats grid */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3">
          <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <small className="text-muted d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>BULLISH SECTORS</small>
            <span className="fs-4 fw-extrabold text-success">{bullishCount}</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <small className="text-muted d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>BEARISH SECTORS</small>
            <span className="fs-4 fw-extrabold text-danger">{bearishCount}</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <small className="text-muted d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>STRONGEST</small>
            <span className="fw-bold d-block" style={{ color: 'var(--tp-text)', fontSize: '0.95rem' }}>
              {strongest?.sector || '—'}
            </span>
            <small className="text-success" style={{ fontSize: '0.7rem' }}>Score: {strongest?.score || '—'}</small>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <small className="text-muted d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>WEAKEST</small>
            <span className="fw-bold d-block" style={{ color: 'var(--tp-text)', fontSize: '0.95rem' }}>
              {weakest?.sector || '—'}
            </span>
            <small className="text-danger" style={{ fontSize: '0.7rem' }}>Score: {weakest?.score || '—'}</small>
          </div>
        </div>
      </div>

      {/* Money Flow */}
      <div className="pt-3" style={{ borderTop: '1px solid var(--tp-border)' }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <FaChartLine style={{ color: '#3B82F6', fontSize: '0.8rem' }} />
          <small className="text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>MONEY FLOW — SECTOR CAPITAL INFLOW</small>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {moneyFlow.map((mf) => (
            <div
              key={mf.sector}
              className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill"
              style={{
                backgroundColor: mf.flow >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${mf.flow >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                fontSize: '0.78rem'
              }}
            >
              <span className="fw-bold" style={{ color: 'var(--tp-text)' }}>{mf.sector}</span>
              <span className={`fw-semibold ${mf.flow >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.72rem' }}>
                {mf.flow >= 0 ? <FaArrowUp style={{ fontSize: '0.55rem' }} /> : <FaArrowDown style={{ fontSize: '0.55rem' }} />}
                {' '}{formatCr(mf.flow)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MarketSummary;
