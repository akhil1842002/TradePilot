import React from 'react';
import { useApp } from '../context/AppContext';
import { FaArrowUp, FaArrowDown } from 'react-icons/fa';

export const MarketCards = () => {
  const { indices, fetchIndexStocks } = useApp();

  if (!indices || Object.keys(indices).length === 0) {
    return (
      <div className="row g-3 mb-4">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="col-12 col-md-4 col-lg-3">
            <div className="tp-card text-center text-muted">Loading Indices...</div>
          </div>
        ))}
      </div>
    );
  }

  const indicesList = [
    { name: 'Nifty 50', key: 'NIFTY50' },
    { name: 'Sensex', key: 'SENSEX' },
    { name: 'Nifty 500', key: 'NIFTY500' },
    { name: 'Bank Nifty', key: 'BANKNIFTY' },
    { name: 'Nifty IT', key: 'NIFTYIT' },
    { name: 'Midcap 100', key: 'NIFTYMIDCAP' },
    { name: 'Nifty FMCG', key: 'NIFTYFMCG' },
    { name: 'Nifty Pharma', key: 'NIFTYPHARMA' },
    { name: 'Nifty Next 50', key: 'NIFTYNEXT50' },
    { name: 'Service Sector', key: 'NIFTYSERVICE' },
    { name: 'India VIX', key: 'INDIAVIX' }
  ];

  return (
    <div className="row g-3 mb-4">
      {indicesList.map((item) => {
        const data = indices[item.key];
        if (!data) return null;

        const isPositive = item.key === 'INDIAVIX' ? data.changePercent < 0 : data.changePercent >= 0; // standard indicator color rules
        const textClass = isPositive ? 'text-success' : 'text-danger';
        const arrow = isPositive ? <FaArrowUp /> : <FaArrowDown />;

        // Inject flash classes
        let flashClass = '';
        if (data.flash === 'up') flashClass = 'flash-up';
        if (data.flash === 'down') flashClass = 'flash-down';

        return (
          <div
            key={item.key}
            className="col-6 col-md-4 col-lg-3"
            onClick={() => fetchIndexStocks(item.key, item.name)}
            style={{ cursor: 'pointer' }}
            title={`Click to see ${item.name} constituent stocks`}
          >
            <div className={`tp-card h-100 smooth-transition ${flashClass}`}>
              <div className="text-muted fw-bold uppercase mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                {item.name}
              </div>
              <div className="ticker-value text-white mb-1">
                ₹{Number(data.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`d-flex align-items-center gap-1 fw-bold ${textClass}`} style={{ fontSize: '0.85rem' }}>
                {arrow}
                <span>
                  {data.changePercent >= 0 ? '+' : ''}
                  {data.changePercent}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MarketCards;
