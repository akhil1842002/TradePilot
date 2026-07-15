import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FaBell, FaSearch, FaUserCircle, FaSun, FaMoon, FaBars, FaArrowUp, FaArrowDown, FaCircle } from 'react-icons/fa';

export const Navbar = () => {
  const {
    isConnected,
    isSimulation,
    lastTickTime,
    setSelectedStock,
    setActiveView,
    stocks,
    alerts,
    theme,
    toggleTheme,
    toggleSidebar,
    tradeMode,
    toggleTradeMode
  } = useApp();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchVal, setSearchVal] = useState('');
  const [showSearch, setShowSearch] = useState(false);   // mobile search toggle
  const [showNotifications, setShowNotifications] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(null);
  const isLight = theme === 'light';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update "seconds since last tick" every second
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastTickTime) {
        setSecondsAgo(Math.floor((Date.now() - lastTickTime) / 1000));
      } else {
        setSecondsAgo(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastTickTime]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchVal) return;
    const sym = searchVal.toUpperCase().trim();
    const found = stocks.find(s => s.symbol === sym);
    if (found) {
      setSelectedStock(sym);
      setActiveView('charts');
      setSearchVal('');
      setShowSearch(false);
    } else {
      alert(`"${sym}" not found. Available: ${stocks.map(s => s.symbol).join(', ')}`);
    }
  };

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <>
      <nav
        className="navbar px-3 px-md-4 py-2 sticky-top"
        style={{
          backgroundColor: 'var(--tp-sidebar)',
          borderBottom: '1px solid var(--tp-border)',
          zIndex: 999,
          minHeight: '60px'
        }}
      >
        <div className="container-fluid p-0 gap-2">

          {/* ── Left: Hamburger (mobile) + Search ── */}
          <div className="d-flex align-items-center gap-2 flex-grow-1">
            {/* Hamburger – mobile only */}
            <button
              className="btn border-0 bg-transparent d-lg-none p-1"
              style={{ color: 'var(--tp-text)', fontSize: '1.2rem' }}
              onClick={toggleSidebar}
              title="Open menu"
            >
              <FaBars />
            </button>

            {/* Brand name – mobile only when search hidden */}
            <span
              className={`fw-bold d-lg-none ${showSearch ? 'd-none' : ''}`}
              style={{ color: 'var(--tp-text)', fontSize: '1rem', whiteSpace: 'nowrap' }}
            >
              TradePilot
            </span>

            {/* Search – always visible on md+, toggle on mobile */}
            <form
              onSubmit={handleSearchSubmit}
              className={`align-items-center position-relative ${showSearch ? 'd-flex flex-grow-1' : 'd-none d-md-flex'}`}
              style={{ maxWidth: '320px', width: '100%' }}
            >
              <FaSearch
                className="position-absolute text-muted"
                style={{ left: '12px', pointerEvents: 'none', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                className="form-control border-0 ps-5 py-2 rounded-pill"
                style={{
                  backgroundColor: 'var(--tp-bg)',
                  border: '1px solid var(--tp-border)',
                  color: 'var(--tp-text)',
                  fontSize: '0.88rem'
                }}
                placeholder="Search stock…"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                autoFocus={showSearch}
              />
            </form>
          </div>

          {/* ── Right controls ── */}
          <div className="d-flex align-items-center gap-2 gap-md-3 ms-auto flex-shrink-0">

            {/* Mobile search toggle */}
            <button
              className="btn border-0 bg-transparent d-md-none p-1"
              style={{ color: 'var(--tp-text)', fontSize: '1rem' }}
              onClick={() => setShowSearch(s => !s)}
              title="Search"
            >
              <FaSearch />
            </button>

            {/* Clock – hidden on small screens */}
            <div className="text-end d-none d-xl-block">
              <div className="fw-bold" style={{ color: 'var(--tp-text)', fontSize: '0.9rem' }}>{formattedTime}</div>
              <div className="text-muted" style={{ fontSize: '0.7rem' }}>{formattedDate}</div>
            </div>

            {/* BUY / SELL mode toggle */}
            <div
              className="d-flex align-items-center rounded-pill border overflow-hidden"
              style={{ borderColor: tradeMode === 'BUY' ? '#22C55E' : '#EF4444', transition: 'border-color 0.3s' }}
            >
              <button
                onClick={() => tradeMode !== 'BUY' && toggleTradeMode()}
                className="btn border-0 px-3 py-1 fw-bold d-flex align-items-center gap-1"
                style={{
                  fontSize: '0.8rem',
                  backgroundColor: tradeMode === 'BUY' ? '#22C55E' : 'transparent',
                  color: tradeMode === 'BUY' ? '#fff' : '#6b7280',
                  borderRadius: 0,
                  transition: 'all 0.25s'
                }}
              >
                <FaArrowUp style={{ fontSize: '0.7rem' }} /> BUY
              </button>
              <button
                onClick={() => tradeMode !== 'SELL' && toggleTradeMode()}
                className="btn border-0 px-3 py-1 fw-bold d-flex align-items-center gap-1"
                style={{
                  fontSize: '0.8rem',
                  backgroundColor: tradeMode === 'SELL' ? '#EF4444' : 'transparent',
                  color: tradeMode === 'SELL' ? '#fff' : '#6b7280',
                  borderRadius: 0,
                  transition: 'all 0.25s'
                }}
              >
                <FaArrowDown style={{ fontSize: '0.7rem' }} /> SELL
              </button>
            </div>

            {/* Connect Zerodha – opens the OAuth login flow */}
            <a
              href="http://localhost:5000/api/auth/kite/login"
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm fw-bold d-none d-sm-flex align-items-center gap-1"
              style={{
                fontSize: '0.75rem',
                background: isSimulation
                  ? 'linear-gradient(135deg,#1f2937,#374151)'
                  : 'linear-gradient(135deg,#064e3b,#065f46)',
                border: `1px solid ${isSimulation ? '#6b7280' : '#10b981'}`,
                color: isSimulation ? '#9ca3af' : '#6ee7b7',
                borderRadius: '8px',
                padding: '5px 12px',
                whiteSpace: 'nowrap',
                textDecoration: 'none'
              }}
              title={isSimulation
                ? 'Click to login with Zerodha and get live market data'
                : 'Zerodha is connected — click to re-authenticate'}
            >
              {isSimulation ? '🔌 Connect Zerodha' : '✅ Zerodha Live'}
            </a>

            {/* Connection badge – with live data pulse indicator */}
            <div
              className="d-none d-sm-flex align-items-center gap-2 px-2 px-md-3 py-2 rounded-3 border"
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'var(--tp-bg)',
                borderColor: isSimulation ? 'var(--tp-border)' : '#10b981',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.3s'
              }}
            >
              {/* Pulsing dot when live data is flowing */}
              <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                <span
                  className={`d-inline-block rounded-circle ${isConnected ? 'bg-success' : 'bg-danger'}`}
                  style={{ width: '8px', height: '8px' }}
                />
                {!isSimulation && isConnected && lastTickTime && secondsAgo !== null && secondsAgo < 10 && (
                  <span
                    className="d-inline-block rounded-circle bg-success position-absolute top-0 start-0"
                    style={{
                      width: '8px',
                      height: '8px',
                      opacity: 0.6,
                      animation: 'pulse-ring 1.5s ease-out infinite'
                    }}
                  />
                )}
              </span>
              <span className="fw-semibold d-none d-md-inline" style={{ color: 'var(--tp-text)' }}>
                {isSimulation ? 'SIMULATOR' : 'ZERODHA KITE'}
              </span>
              <span className="fw-semibold d-inline d-md-none" style={{ color: 'var(--tp-text)' }}>
                {isSimulation ? 'SIM' : 'LIVE'}
              </span>
              {/* Live tick age */}
              {!isSimulation && lastTickTime && secondsAgo !== null && (
                <span
                  className="d-none d-lg-inline"
                  style={{
                    color: secondsAgo < 5 ? '#10b981' : secondsAgo < 15 ? '#f59e0b' : '#ef4444',
                    fontSize: '0.7rem',
                    fontWeight: 600
                  }}
                >
                  {secondsAgo < 60
                    ? `⏱ ${secondsAgo}s ago`
                    : `⏱ ${Math.floor(secondsAgo / 60)}m ago`}
                </span>
              )}
              {!isSimulation && !lastTickTime && (
                <span className="d-none d-lg-inline text-warning" style={{ fontSize: '0.68rem' }}>
                  awaiting data...
                </span>
              )}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isLight ? 'Dark Mode' : 'Light Mode'}
              className="btn d-flex align-items-center justify-content-center rounded-circle p-0 border smooth-transition"
              style={{
                width: '34px',
                height: '34px',
                flexShrink: 0,
                backgroundColor: isLight ? '#e5e7eb' : '#374151',
                borderColor: 'var(--tp-border)',
                color: isLight ? '#92400e' : '#facc15',
                fontSize: '0.9rem'
              }}
            >
              {isLight ? <FaSun /> : <FaMoon />}
            </button>

            {/* Notifications bell */}
            <div className="position-relative">
              <button
                className="btn p-1 border-0 bg-transparent position-relative"
                style={{ color: 'var(--tp-text)' }}
                onClick={() => setShowNotifications(s => !s)}
              >
                <FaBell className={`${unreadCount > 0 ? 'text-warning' : 'text-muted'}`} style={{ fontSize: '1.15rem' }} />
                {unreadCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{ fontSize: '0.6rem' }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="position-absolute end-0 mt-2 rounded-3 border"
                  style={{
                    width: 'min(360px, 95vw)',
                    maxHeight: '380px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--tp-card)',
                    borderColor: 'var(--tp-border)',
                    zIndex: 1050,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                  }}
                >
                  <div
                    className="p-3 border-bottom d-flex align-items-center justify-content-between"
                    style={{ borderColor: 'var(--tp-border)' }}
                  >
                    <h6 className="mb-0 fw-bold" style={{ color: 'var(--tp-text)' }}>Signal Alerts</h6>
                    <button
                      className="btn btn-sm btn-link text-muted p-0 text-decoration-none"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => alerts.forEach(a => (a.read = true))}
                    >
                      Mark all read
                    </button>
                  </div>
                  {alerts.length === 0 ? (
                    <div className="p-4 text-center text-muted" style={{ fontSize: '0.85rem' }}>No signals yet</div>
                  ) : (
                    alerts.map(a => {
                      const cls = a.type === 'BUY' ? 'badge-buy' : a.type === 'EXIT' ? 'badge-exit' : a.type === 'BOOK PROFIT' ? 'badge-profit' : 'badge-hold';
                      return (
                        <div
                          key={a.id}
                          className="p-3 border-bottom"
                          style={{ borderColor: 'var(--tp-border)', backgroundColor: a.read ? 'transparent' : 'rgba(59,130,246,0.06)' }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className={`badge ${cls}`} style={{ fontSize: '0.62rem' }}>{a.type}</span>
                            <small className="text-muted" style={{ fontSize: '0.62rem' }}>{a.timestamp}</small>
                          </div>
                          <div className="fw-semibold mb-1" style={{ fontSize: '0.8rem', color: 'var(--tp-text)' }}>{a.title}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{a.message}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Profile – hidden on small screens */}
            <div className="d-none d-lg-flex align-items-center gap-2">
              <FaUserCircle className="text-muted" style={{ fontSize: '1.5rem' }} />
              <div>
                <div className="fw-semibold" style={{ fontSize: '0.82rem', color: 'var(--tp-text)' }}>Trader</div>
                <div className="text-muted" style={{ fontSize: '0.68rem' }}>Intraday Desk</div>
              </div>
            </div>

          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
