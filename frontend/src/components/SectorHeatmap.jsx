import React from 'react';
import { useApp } from '../context/AppContext';

export const SectorHeatmap = () => {
  const { sectors, activeSectorFilter, setActiveSectorFilter } = useApp();

  if (!sectors || Object.keys(sectors).length === 0) {
    return <div className="tp-card text-center text-muted">Calculating Sector Weights...</div>;
  }

  const handleSectorClick = (name) => {
    if (activeSectorFilter === name) {
      setActiveSectorFilter(null); // Clear filter
    } else {
      setActiveSectorFilter(name); // Filter by sector
    }
  };

  return (
    <div className="tp-card h-100">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h5 className="mb-0 fw-bold text-white">Sector Heatmap</h5>
          <small className="text-muted">Click sector to filter stock list</small>
        </div>
        {activeSectorFilter && (
          <button 
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1"
            style={{ fontSize: '0.75rem' }}
            onClick={() => setActiveSectorFilter(null)}
          >
            Clear Filter ({activeSectorFilter})
          </button>
        )}
      </div>

      <div className="row g-2">
        {Object.values(sectors).map((sec) => {
          let bgClass = 'bg-primary-subtle text-primary border-primary fw-bold'; // Neutral = blue
          let badgeColor = '#3B82F6';
          if (sec.status === 'Green') {
            bgClass = 'bg-success-subtle text-success border-success fw-bold';
            badgeColor = '#22C55E';
          } else if (sec.status === 'Red') {
            bgClass = 'bg-danger-subtle text-danger border-danger fw-bold';
            badgeColor = '#EF4444';
          }

          const isSelected = activeSectorFilter === sec.name;
          const borderStyle = isSelected ? `2px solid ${badgeColor}` : '1px solid rgba(255, 255, 255, 0.05)';

          return (
            <div key={sec.name} className="col-6 col-md-4 col-lg-2">
              <button
                className={`w-100 p-3 rounded-3 text-center border d-flex flex-column align-items-center justify-content-center smooth-transition bg-transparent`}
                style={{ 
                  height: '75px', 
                  border: borderStyle,
                  boxShadow: isSelected ? `0 0 10px rgba(59, 130, 246, 0.2)` : 'none',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08) !important' : 'transparent'
                }}
                onClick={() => handleSectorClick(sec.name)}
              >
                <span className="text-white fw-bold" style={{ fontSize: '0.85rem' }}>{sec.name}</span>
                <span 
                  className={`badge mt-1 ${bgClass}`} 
                  style={{ fontSize: '0.7rem' }}
                >
                  {sec.changePercent >= 0 ? '+' : ''}
                  {sec.changePercent.toFixed(2)}%
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SectorHeatmap;
