import React from 'react';
import { useApp } from '../context/AppContext';
import {
  FaThLarge, FaGlobe, FaSearchDollar, FaListUl, FaChartLine,
  FaBriefcase, FaBookOpen, FaChartBar, FaFolder, FaCog, FaTimes, FaBan
} from 'react-icons/fa';

export const Sidebar = () => {
  const { activeView, setActiveView, theme, sidebarOpen, setSidebarOpen } = useApp();
  const isLight = theme === 'light';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard',    icon: <FaThLarge /> },
    { id: 'market',    label: 'Market',        icon: <FaGlobe /> },
    { id: 'scanner',   label: 'Scanner',       icon: <FaSearchDollar /> },
    { id: 'watchlist', label: 'Watchlists',    icon: <FaListUl /> },
    { id: 'charts',    label: 'Charts',        icon: <FaChartLine /> },
    { id: 'trades',    label: 'Open Trades',   icon: <FaBriefcase /> },
    { id: 'journal',   label: 'Trade Journal', icon: <FaBookOpen /> },
    { id: 'analytics', label: 'Analytics',     icon: <FaChartBar /> },
    { id: 'circuit-hits', label: 'Circuit Hits', icon: <FaBan /> },
    { id: 'portfolio', label: 'Portfolio',     icon: <FaFolder /> },
    { id: 'settings',  label: 'Settings',      icon: <FaCog /> },
  ];

  const handleNav = (id) => {
    setActiveView(id);
    setSidebarOpen(false); // close on mobile after selection
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="d-lg-none position-fixed top-0 start-0 w-100 h-100"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1040 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className="position-fixed top-0 start-0 h-100 d-flex flex-column"
        style={{
          width: '260px',
          backgroundColor: 'var(--tp-sidebar)',
          borderRight: '1px solid var(--tp-border)',
          color: 'var(--tp-text)',
          zIndex: 1050,
          // Mobile: slide in/out; Desktop: always visible
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        }}
        // Override slide-out on lg+ via inline media query simulation (CSS class handles it)
      >
        {/* Brand header */}
        <div
          className="d-flex align-items-center justify-content-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--tp-border)' }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center bg-primary rounded-circle"
              style={{ width: '38px', height: '38px', flexShrink: 0 }}
            >
              <FaSearchDollar className="text-white" style={{ fontSize: '1rem' }} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold" style={{ color: 'var(--tp-text)', fontSize: '1rem' }}>TradePilot</h5>
              <small className="text-muted" style={{ fontSize: '0.65rem' }}>DECISION ENGINE v1.0</small>
            </div>
          </div>

          {/* Close button — visible on mobile only */}
          <button
            className="btn btn-link p-1 d-lg-none border-0 bg-transparent"
            style={{ color: 'var(--tp-text)' }}
            onClick={() => setSidebarOpen(false)}
          >
            <FaTimes />
          </button>
        </div>

        {/* Nav links */}
        <div className="flex-grow-1 overflow-y-auto px-3 py-3">
          <ul className="nav nav-pills flex-column gap-1 mb-0">
            {menuItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <li key={item.id} className="nav-item">
                  <button
                    onClick={() => handleNav(item.id)}
                    className="w-100 border-0 text-start d-flex align-items-center gap-3 px-3 py-2 rounded-3 smooth-transition"
                    style={{
                      backgroundColor: isActive ? 'var(--tp-hover)' : 'transparent',
                      borderLeft: isActive ? '3px solid #3B82F6' : '3px solid transparent',
                      color: isActive ? 'var(--tp-text)' : (isLight ? '#6b7280' : '#9CA3AF'),
                      fontWeight: 500,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', width: '16px', flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div
          className="p-3 text-center"
          style={{ borderTop: '1px solid var(--tp-border)', fontSize: '0.72rem' }}
        >
          <span className="text-muted">Intraday Analysis Only</span>
          <div className="text-danger fw-bold mt-1" style={{ fontSize: '0.62rem' }}>
            ⚠️ NO AUTO ORDER PLACEMENT
          </div>
        </div>
      </div>

      {/* Desktop: always-visible spacer so content doesn't hide behind sidebar */}
      <div className="d-none d-lg-block flex-shrink-0" style={{ width: '260px' }} />
    </>
  );
};

export default Sidebar;
