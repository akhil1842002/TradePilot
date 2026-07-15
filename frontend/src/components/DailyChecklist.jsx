import React from 'react';
import { useApp } from '../context/AppContext';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaArrowUp, FaArrowDown, FaBalanceScale } from 'react-icons/fa';

export const DailyChecklist = () => {
  const { checklist } = useApp();

  if (!checklist || Object.keys(checklist).length === 0) {
    return <div className="tp-card text-center text-muted">Calculating Market Breadth...</div>;
  }

  const {
    marketTrend,
    bestSector,
    weakSector,
    advances,
    declines,
    highestVolumeSector,
    highestMomentumSector,
    riskLevel,
    score,
    recommendation
  } = checklist;

  // Determine colors and icons based on status
  let trendIcon = <FaBalanceScale className="text-warning fs-4" />;
  let trendColor = 'text-warning';
  if (marketTrend === 'Bullish') {
    trendIcon = <FaArrowUp className="text-success fs-4" />;
    trendColor = 'text-success';
  } else if (marketTrend === 'Bearish') {
    trendIcon = <FaArrowDown className="text-danger fs-4" />;
    trendColor = 'text-danger';
  }

  let riskColor = 'text-success';
  if (riskLevel === 'High') riskColor = 'text-danger';
  else if (riskLevel === 'Medium') riskColor = 'text-warning';

  let recIcon = <FaExclamationTriangle className="text-warning me-2" />;
  let recBadge = 'bg-warning-subtle text-warning border-warning';
  if (recommendation === 'Good Day To Trade') {
    recIcon = <FaCheckCircle className="text-success me-2" />;
    recBadge = 'bg-success-subtle text-success border-success';
  } else if (recommendation === 'Avoid Trading') {
    recIcon = <FaTimesCircle className="text-danger me-2" />;
    recBadge = 'bg-danger-subtle text-danger border-danger';
  }

  return (
    <div className="tp-card h-100 d-flex flex-column justify-content-between">
      <div>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h5 className="mb-0 fw-bold text-white">Daily Checklist & Breadth</h5>
          <span className={`badge border px-3 py-2 rounded-pill ${recBadge}`} style={{ fontSize: '0.8rem' }}>
            <span className="d-flex align-items-center">
              {recIcon}
              {recommendation}
            </span>
          </span>
        </div>

        <div className="row g-3">
          {/* Market Score Circular Gauge */}
          <div className="col-12 col-md-4 d-flex flex-column align-items-center justify-content-center border-end border-secondary pe-md-4">
            <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: '120px', height: '120px' }}>
              {/* Circular track */}
              <svg className="w-100 h-100" viewBox="0 0 36 36">
                <path
                  className="text-muted"
                  style={{ stroke: 'var(--tp-border)', fill: 'none', strokeWidth: 3 }}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={score >= 70 ? 'text-success' : (score >= 40 ? 'text-warning' : 'text-danger')}
                  style={{ 
                    stroke: score >= 70 ? 'var(--tp-success)' : (score >= 40 ? 'var(--tp-warning)' : 'var(--tp-danger)'), 
                    fill: 'none', 
                    strokeWidth: 3, 
                    strokeDasharray: `${score}, 100`,
                    strokeLinecap: 'round',
                    transition: 'stroke-dasharray 0.5s ease'
                  }}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="position-absolute text-center">
                <span className="fs-2 fw-extrabold text-white">{score}</span>
                <div className="text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>Market Score</div>
              </div>
            </div>
          </div>

          {/* Breadth details */}
          <div className="col-12 col-md-8 ps-md-4">
            <div className="row g-2">
              <div className="col-6">
                <small className="text-muted d-block">Market Trend</small>
                <span className={`fw-bold d-flex align-items-center gap-2 mt-1 ${trendColor}`}>
                  {trendIcon}
                  {marketTrend}
                </span>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Breadth (Adv/Dec)</small>
                <span className="fw-bold text-white d-block mt-1">
                  <span className="text-success">{advances} ▲</span>
                  <span className="text-muted px-2">/</span>
                  <span className="text-danger">{declines} ▼</span>
                </span>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Best Sector</small>
                <span className="fw-semibold text-success d-block mt-1">{bestSector}</span>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Weak Sector</small>
                <span className="fw-semibold text-danger d-block mt-1">{weakSector}</span>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Highest Volume</small>
                <span className="fw-semibold text-info d-block mt-1">{highestVolumeSector}</span>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Highest Momentum</small>
                <span className="fw-semibold text-purple d-block mt-1">{highestMomentumSector}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-top border-secondary d-flex align-items-center justify-content-between" style={{ fontSize: '0.8rem' }}>
        <span className="text-muted">Current Risk Rating: <strong className={riskColor}>{riskLevel}</strong></span>
        <span className="text-warning fw-semibold">⚡ Review checklist before manual ordering</span>
      </div>
    </div>
  );
};

export default DailyChecklist;
