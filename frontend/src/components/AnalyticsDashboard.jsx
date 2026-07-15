import React from 'react';
import { useApp } from '../context/AppContext';
import { FaChartLine, FaCheckDouble, FaTimesCircle, FaHourglassHalf, FaFolderOpen, FaLightbulb } from 'react-icons/fa';

export const AnalyticsDashboard = () => {
  const { analytics } = useApp();

  if (!analytics || Object.keys(analytics).length === 0) {
    return <div className="tp-card text-center text-muted py-5">Computing analytics aggregates...</div>;
  }

  const {
    totalTrades,
    todaysProfit,
    weeklyProfit,
    monthlyProfit,
    winRate,
    lossRate,
    avgProfit,
    avgLoss,
    bestStrategy,
    worstStrategy,
    bestTime,
    worstTime,
    bestSector,
    worstSector
  } = analytics;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Profit metrics grid */}
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <div className="tp-card text-center">
            <small className="text-muted d-block uppercase mb-1" style={{ fontSize: '0.7rem' }}>TODAY'S NET PROFIT</small>
            <span className={`fs-2 fw-extrabold ${todaysProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              {todaysProfit >= 0 ? '+' : ''}₹{todaysProfit.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="tp-card text-center">
            <small className="text-muted d-block uppercase mb-1" style={{ fontSize: '0.7rem' }}>WEEKLY NET PROFIT</small>
            <span className={`fs-2 fw-extrabold ${weeklyProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              {weeklyProfit >= 0 ? '+' : ''}₹{weeklyProfit.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="tp-card text-center">
            <small className="text-muted d-block uppercase mb-1" style={{ fontSize: '0.7rem' }}>MONTHLY NET PROFIT</small>
            <span className={`fs-2 fw-extrabold ${monthlyProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              {monthlyProfit >= 0 ? '+' : ''}₹{monthlyProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Win Rate Progress Gauges */}
        <div className="col-12 col-lg-6">
          <div className="tp-card h-100 d-flex flex-column justify-content-between">
            <div>
              <h5 className="fw-bold text-white mb-3">Win / Loss Statistics</h5>
              <div className="d-flex justify-content-between text-muted mb-1" style={{ fontSize: '0.85rem' }}>
                <span>WIN RATE: {winRate}%</span>
                <span>LOSS RATE: {lossRate}%</span>
              </div>
              <div className="progress bg-danger mb-4" style={{ height: '14px', borderRadius: '7px' }}>
                <div className="progress-bar bg-success" style={{ width: `${winRate}%` }}></div>
              </div>

              <div className="row g-3">
                <div className="col-6 text-center border-end border-secondary">
                  <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>TOTAL COMPLETED TRADES</span>
                  <span className="fs-3 fw-bold text-white mt-1">{totalTrades}</span>
                </div>
                <div className="col-6 text-center">
                  <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>WIN / LOSS RATIO</span>
                  <span className="fs-3 fw-bold text-info mt-1">
                    {lossRate > 0 ? (winRate / lossRate).toFixed(1) : winRate > 0 ? 'Infinite' : '0.0'}
                  </span>
                </div>
              </div>
            </div>

            <div className="row g-3 border-top border-secondary pt-3 mt-3">
              <div className="col-6">
                <div className="d-flex align-items-center gap-2">
                  <FaCheckDouble className="text-success fs-5" />
                  <div>
                    <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>AVG WIN VALUE</small>
                    <span className="fw-bold text-success" style={{ fontSize: '0.95rem' }}>+₹{avgProfit.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="d-flex align-items-center gap-2">
                  <FaTimesCircle className="text-danger fs-5" />
                  <div>
                    <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>AVG LOSS VALUE</small>
                    <span className="fw-bold text-danger" style={{ fontSize: '0.95rem' }}>-₹{avgLoss.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Best / Worst categories details */}
        <div className="col-12 col-lg-6">
          <div className="tp-card h-100">
            <h5 className="fw-bold text-white mb-4">Performance Aggregates</h5>
            
            <div className="d-flex flex-column gap-3.5">
              <div className="d-flex align-items-center justify-content-between border-bottom border-dark pb-2">
                <div className="d-flex align-items-center gap-2.5">
                  <FaLightbulb className="text-warning fs-5" />
                  <div>
                    <div className="fw-bold text-white" style={{ fontSize: '0.85rem' }}>Best Trading Strategy</div>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>Highest yielding entry reason</small>
                  </div>
                </div>
                <span className="badge bg-success-subtle text-success border border-success fw-bold px-3 py-1.5 rounded-pill" style={{ fontSize: '0.8rem' }}>
                  {bestStrategy}
                </span>
              </div>

              <div className="d-flex align-items-center justify-content-between border-bottom border-dark pb-2">
                <div className="d-flex align-items-center gap-2.5">
                  <FaLightbulb className="text-danger fs-5" />
                  <div>
                    <div className="fw-bold text-white" style={{ fontSize: '0.85rem' }}>Worst Trading Strategy</div>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>Lowest yielding entry reason</small>
                  </div>
                </div>
                <span className="badge bg-danger-subtle text-danger border border-danger fw-bold px-3 py-1.5 rounded-pill" style={{ fontSize: '0.8rem' }}>
                  {worstStrategy}
                </span>
              </div>

              <div className="d-flex align-items-center justify-content-between border-bottom border-dark pb-2">
                <div className="d-flex align-items-center gap-2.5">
                  <FaFolderOpen className="text-info fs-5" />
                  <div>
                    <div className="fw-bold text-white" style={{ fontSize: '0.85rem' }}>Top Sector Performance</div>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>Most profitable sector</small>
                  </div>
                </div>
                <span className="badge bg-info-subtle text-info border border-info fw-bold px-3 py-1.5 rounded-pill" style={{ fontSize: '0.8rem' }}>
                  {bestSector}
                </span>
              </div>

              <div className="d-flex align-items-center justify-content-between border-bottom border-dark pb-2">
                <div className="d-flex align-items-center gap-2.5">
                  <FaFolderOpen className="text-danger fs-5" />
                  <div>
                    <div className="fw-bold text-white" style={{ fontSize: '0.85rem' }}>Weakest Sector Performance</div>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>Least profitable sector</small>
                  </div>
                </div>
                <span className="badge bg-danger-subtle text-danger border border-danger fw-bold px-3 py-1.5 rounded-pill" style={{ fontSize: '0.8rem' }}>
                  {worstSector}
                </span>
              </div>

              <div className="d-flex align-items-center justify-content-between pb-1">
                <div className="d-flex align-items-center gap-2.5">
                  <FaHourglassHalf className="text-purple fs-5" />
                  <div>
                    <div className="fw-bold text-white" style={{ fontSize: '0.85rem' }}>Optimal Trading Hours</div>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>Best performing intraday slot</small>
                  </div>
                </div>
                <span className="badge bg-primary-subtle text-primary border border-primary fw-bold px-3 py-1.5 rounded-pill" style={{ fontSize: '0.8rem' }}>
                  {bestTime}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
