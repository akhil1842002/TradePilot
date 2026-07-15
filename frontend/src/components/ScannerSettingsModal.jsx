import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FaTimes, FaSave } from 'react-icons/fa';

export const ScannerSettingsModal = ({ onClose }) => {
  const { scannerConfig, updateScannerConfig } = useApp();
  const [localConfig, setLocalConfig] = useState({});

  useEffect(() => {
    if (scannerConfig) {
      setLocalConfig(scannerConfig);
    }
  }, [scannerConfig]);

  const handleToggle = (key) => {
    setLocalConfig((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    updateScannerConfig(localConfig);
    onClose();
  };

  const indicatorsList = [
    { key: 'vwap', title: 'Volume Weighted Average Price (VWAP)', desc: 'Buy above VWAP, Exit/Ignore below VWAP' },
    { key: 'ema20', title: 'EMA 20 crossover', desc: 'Shorter term trend tracking' },
    { key: 'ema50', title: 'EMA 50 crossover', desc: 'Longer term trend base' },
    { key: 'rsi', title: 'Relative Strength Index (RSI)', desc: 'RSI >= 60 indicates bullish momentum, RSI <= 40 indicates weak momentum' },
    { key: 'macd', title: 'MACD Divergence', desc: 'Calculates signal and MACD line crosses' },
    { key: 'adx', title: 'Average Directional Index (ADX)', desc: 'Filters sideways trends (ADX < 20)' },
    { key: 'volumeSpike', title: 'Volume Spike Check', desc: 'Checks volume spikes > 1.8x average' },
    { key: 'breakout', title: 'Breakout Detection', desc: 'Flags resistances breakouts' },
    { key: 'support', title: 'Support Pivot Testing', desc: 'Alerts if price is testing local supports' },
    { key: 'resistance', title: 'Resistance Pivot Testing', desc: 'Alerts if near local resistance targets' },
    { key: 'relativeStrength', title: 'Relative Strength Index', desc: 'Analyzes strength relative to Nifty index' },
    { key: 'sectorStrength', title: 'Sector Strength Integration', desc: 'Correlates stock movement with parent sector strength' },
    { key: 'marketBreadth', title: 'Market Breadth Integration', desc: 'Factors in Nifty Advances/Declines trend' }
  ];

  return (
    <div 
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.65)', 
        zIndex: 1100, 
        backdropFilter: 'blur(4px)' 
      }}
    >
      <div 
        className="tp-card w-100 m-3" 
        style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="d-flex align-items-center justify-content-between pb-3 border-bottom border-secondary mb-4">
          <h5 className="mb-0 fw-bold text-white">AI Decision Engine Configuration</h5>
          <button className="btn btn-link text-muted p-0 border-0 bg-transparent" onClick={onClose}>
            <FaTimes className="fs-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Toggle indicators to adjust weighting and scores. Disabled parameters will be excluded from the 0-100 composite scoring algorithm and reasoning details.
          </p>

          <div className="d-flex flex-column gap-3">
            {indicatorsList.map((item) => (
              <div 
                key={item.key} 
                className="d-flex align-items-start justify-content-between p-2 rounded-3" 
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.03)' }}
              >
                <div>
                  <div className="fw-semibold text-white" style={{ fontSize: '0.9rem' }}>{item.title}</div>
                  <small className="text-muted" style={{ fontSize: '0.75rem' }}>{item.desc}</small>
                </div>
                <div className="form-check form-switch pt-1">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!localConfig[item.key]}
                    onChange={() => handleToggle(item.key)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 pt-3 border-top border-secondary">
          <button className="btn btn-secondary px-4 py-2" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2" onClick={handleSave}>
            <FaSave />
            Save Weightings
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScannerSettingsModal;
