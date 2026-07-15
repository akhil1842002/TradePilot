import React from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import MarketCards from './components/MarketCards';
import DailyChecklist from './components/DailyChecklist';
import SectorHeatmap from './components/SectorHeatmap';
import MarketScanner from './components/MarketScanner';
import MarketBreadth from './components/MarketBreadth';
import MarketSummary from './components/MarketSummary';
import StockDetail from './components/StockDetail';
import OpenTrades from './components/OpenTrades';
import TradeJournal from './components/TradeJournal';
import WatchlistManager from './components/WatchlistManager';
import AnalyticsDashboard from './components/AnalyticsDashboard';

import { useApp } from './context/AppContext';
import { useSocket } from './hooks/useSocket';

export const App = () => {
  useSocket();
  const { activeView, isSimulation, connectionError } = useApp();

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <div className="d-flex flex-column gap-4">
            <MarketCards />
            <div className="row g-4">
              <div className="col-12 col-xl-6"><DailyChecklist /></div>
              <div className="col-12 col-xl-6"><SectorHeatmap /></div>
            </div>
            <MarketSummary />
            <MarketBreadth />
            <MarketScanner />
          </div>
        );
      case 'market':
        return (
          <div className="d-flex flex-column gap-4">
            <MarketCards />
            <SectorHeatmap />
          </div>
        );
      case 'scanner': return <MarketScanner />;
      case 'watchlist': return <WatchlistManager />;
      case 'charts': return <StockDetail />;
      case 'trades': return <OpenTrades />;
      case 'journal': return <TradeJournal />;
      case 'analytics': return <AnalyticsDashboard />;
      case 'portfolio':
        return (
          <div className="d-flex flex-column gap-4">
            <h4 className="fw-bold" style={{ color: 'var(--tp-text)' }}>Mock Portfolio Summary</h4>
            <OpenTrades />
          </div>
        );
      case 'settings':
        return (
          <div className="tp-card">
            <h4 className="fw-bold border-bottom pb-2 mb-4" style={{ color: 'var(--tp-text)', borderColor: 'var(--tp-border)' }}>
              System Settings
            </h4>

            <div className="mb-4">
              <h6 className="fw-bold mb-3" style={{ color: 'var(--tp-text)' }}>Zerodha Kite API Details</h6>
              <div className="row g-3 mb-2">
                <div className="col-12 col-md-4">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>API KEY</label>
                  <input type="text" className="form-control" style={{ backgroundColor: 'var(--tp-bg)', borderColor: 'var(--tp-border)', color: 'var(--tp-text)' }} value="MockApiKey123" disabled />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>API SECRET</label>
                  <input type="password" className="form-control" style={{ backgroundColor: 'var(--tp-bg)', borderColor: 'var(--tp-border)', color: 'var(--tp-text)' }} value="••••••••••••••••" disabled />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>ACCESS TOKEN</label>
                  <input type="password" className="form-control" style={{ backgroundColor: 'var(--tp-bg)', borderColor: 'var(--tp-border)', color: 'var(--tp-text)' }} value="••••••••••••••••" disabled />
                </div>
              </div>
              <small className="text-muted">Modify backend <code>.env</code> to enter live Kite credentials.</small>
            </div>

            <div className="border-top pt-4" style={{ borderColor: 'var(--tp-border)' }}>
              <h6 className="fw-bold mb-3" style={{ color: 'var(--tp-text)' }}>Decision Engine Thresholds</h6>
              <div className="d-flex flex-column gap-2" style={{ maxWidth: '420px' }}>
                {[
                  { label: 'BUY Trigger', value: '75+', color: 'bg-success' },
                  { label: 'HOLD Trigger', value: '60+', color: 'bg-info' },
                  { label: 'WATCH Trigger', value: '45+', color: 'bg-primary' },
                  { label: 'BOOK PROFIT', value: 'Near resistance + 35+', color: 'bg-warning' },
                  { label: 'EXIT Trigger', value: '< 35', color: 'bg-danger' },
                ].map(item => (
                  <div key={item.label} className="d-flex align-items-center justify-content-between">
                    <span className="text-muted" style={{ fontSize: '0.88rem' }}>{item.label}</span>
                    <span className={`badge ${item.color} text-white px-3 py-1 rounded-pill fw-bold`} style={{ fontSize: '0.78rem' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return <div className="tp-card text-center text-muted">View not found</div>;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--tp-bg)' }}>
      <Sidebar />

      {/* Main content — takes remaining width next to the desktop spacer */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main className="p-3 p-md-4" style={{ flex: 1 }}>
          {isSimulation && connectionError && (
            <div
              className="alert alert-warning border rounded-3 mb-4 p-3 d-flex align-items-center justify-content-between flex-wrap gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
                color: 'var(--tp-warning)',
                borderColor: 'rgba(245, 158, 11, 0.25)',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <div>
                  <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.92rem' }}>
                    Simulation Mode Active (Kite API Blocked)
                  </h6>
                  <p className="mb-0 text-muted" style={{ fontSize: '0.82rem', color: '#AEB7C2' }}>
                    Zerodha returned: <code className="bg-dark text-warning px-2 py-0.5 rounded" style={{ fontSize: '0.78rem', border: '1px solid rgba(245, 158, 11, 0.15)' }}>{connectionError}</code>
                  </p>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <a
                  href="https://kite.trade"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-warning fw-bold text-dark px-3 py-1.5 rounded-3 smooth-transition"
                  style={{ fontSize: '0.76rem', background: '#F59E0B', border: 'none' }}
                >
                  Developer Console ↗
                </a>
              </div>
            </div>
          )}
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
