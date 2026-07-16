import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { createChart, ColorType } from 'lightweight-charts';
import axios from 'axios';
import { FaArrowUp, FaArrowDown, FaBriefcase, FaListUl, FaExchangeAlt, FaStar, FaRegStar } from 'react-icons/fa';
import { getEffectiveRec, getActionStyle } from '../utils/tradeLogic';

export const StockDetail = () => {
  const {
    selectedStock,
    stocks,
    checklist,
    sectors,
    createTrade,
    setActiveView,
    tradeMode,
    toggleFavorite,
    isFavorite
  } = useApp();

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // Form State for Mock Trade
  const [qty, setQty] = useState(100);
  const [target, setTarget] = useState(0);
  const [stoploss, setStoploss] = useState(0);
  const [tradeStatus, setTradeStatus] = useState({ loading: false, msg: '', success: false });

  const stock = stocks.find(s => s.symbol === selectedStock);

  // Set default target & stoploss only when stock symbol or tradeMode changes.
  // NOT on every price tick — lets you manually edit target/stoploss freely.
  useEffect(() => {
    if (stock) {
      const isShort = tradeMode === 'SELL';
      const targetMultiplier = isShort ? 0.98 : 1.02;
      const slMultiplier = isShort ? 1.02 : 0.98;
      setTarget(Number((stock.price * targetMultiplier).toFixed(2)));
      setStoploss(Number((stock.price * slMultiplier).toFixed(2)));
      setTradeStatus({ loading: false, msg: '', success: false });
    }
  }, [selectedStock, tradeMode]);

  // Fetch candle data and draw TradingView chart
  useEffect(() => {
    if (!chartContainerRef.current || !stock) return;

    // Fetch historical candles
    const loadChartData = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/scanner/candles/${stock.symbol}`);
        const data = res.data;

        if (chartRef.current) {
          chartRef.current.remove();
        }

        // Initialize Lightweight chart
        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: '#1E293B' },
            textColor: '#D1D5DB',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.05)' },
            horzLines: { color: 'rgba(255,255,255,0.05)' },
          },
          width: chartContainerRef.current.clientWidth,
          height: 340,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          }
        });
        chartRef.current = chart;

        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#22C55E',
          downColor: '#EF4444',
          borderUpColor: '#22C55E',
          borderDownColor: '#EF4444',
          wickUpColor: '#22C55E',
          wickDownColor: '#EF4444',
        });
        seriesRef.current = candlestickSeries;

        candlestickSeries.setData(data);
        chart.timeScale().fitContent();

        // Responsive resize listener
        const handleResize = () => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.resize(chartContainerRef.current.clientWidth, 340);
          }
        };
        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
        };
      } catch (err) {
        console.error('Error loading candles for chart:', err);
      }
    };

    loadChartData();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [selectedStock]);

  // Update chart with live tick prices (append/modify latest candle)
  useEffect(() => {
    if (seriesRef.current && stock) {
      const timestamp = Math.floor(Date.now() / 1000);
      seriesRef.current.update({
        time: timestamp,
        open: stock.open,
        high: stock.high,
        low: stock.low,
        close: stock.price,
        volume: stock.volume
      });
    }
  }, [stock?.price]);

  if (!stock) {
    return (
      <div className="tp-card text-center text-muted py-5">
        Select a stock from the search or scanner to view analytical breakdown.
      </div>
    );
  }

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setTradeStatus({ loading: true, msg: '', success: false });

    const order = {
      symbol: stock.symbol,
      entry: stock.price,
      quantity: Number(qty),
      target: Number(target),
      stoploss: Number(stoploss),
      type: tradeMode // Pass 'BUY' or 'SELL'
    };

    const res = await createTrade(order);
    if (res.success) {
      setTradeStatus({ loading: false, msg: `Mock ${tradeMode === 'SELL' ? 'Short' : 'Long'} Position Opened Successfully!`, success: true });
      setTimeout(() => {
        setActiveView('trades'); // Redirect to Open Trades
      }, 1200);
    } else {
      setTradeStatus({ loading: false, msg: res.error || 'Failed to open position', success: false });
    }
  };

  const changeVal = stock.price - stock.close;
  const changePct = ((changeVal / stock.close) * 100).toFixed(2);
  const isUp = changeVal >= 0;

  const totalDepth = stock.depth.totalBuyQuantity + stock.depth.totalSellQuantity;
  const buyDepthPct = totalDepth > 0 ? (stock.depth.totalBuyQuantity / totalDepth) * 100 : 50;

  // Recommendation Badge style — with fallback for missing fields
  const rec = getEffectiveRec(stock, tradeMode) || {};
  const safeRec = {
    action: rec.action || 'HOLD',
    confidence: rec.confidence ?? 50,
    risk: rec.risk || 'MEDIUM',
    target1: rec.target1 || Number((stock.price * 1.015).toFixed(2)),
    target2: rec.target2 || Number((stock.price * 1.03).toFixed(2)),
    stopLoss: rec.stopLoss || Number((stock.price * 0.985).toFixed(2)),
    reasons: rec.reasons || ['Analyzing — waiting for live data...']
  };
  const terminalEmoji = safeRec.action === 'BUY' || safeRec.action === 'COVER PROFIT' ? '🟢' : (safeRec.action === 'EXIT' || safeRec.action === 'SHORT' ? '🔴' : (safeRec.action === 'BOOK PROFIT' || safeRec.action === 'HOLD SHORT' ? '🟠' : '🔵'));

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header Info Banner */}
      <div className="tp-card d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-dark p-3 rounded-3 border border-secondary text-center" style={{ minWidth: '70px' }}>
            <span className="fw-extrabold text-white fs-4">{stock.symbol}</span>
          </div>
          <div>
            <h4 className="mb-0 fw-extrabold text-white d-flex align-items-center gap-2">
              {stock.name}
              <span
                onClick={() => toggleFavorite(stock.symbol)}
                style={{ cursor: 'pointer', fontSize: '1.2rem' }}
                title={isFavorite(stock.symbol) ? 'Remove from favorites' : 'Add to favorites'}
              >
                {isFavorite(stock.symbol) ? (
                  <FaStar style={{ color: '#F59E0B' }} />
                ) : (
                  <FaRegStar style={{ color: '#6B7280' }} />
                )}
              </span>
            </h4>
            <span className="badge bg-secondary-subtle text-secondary border mt-1">{stock.sector} Sector</span>
          </div>
        </div>

        <div className="d-flex align-items-center gap-4">
          <div className="text-end">
            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>CURRENT PRICE</span>
            <span className="fs-3 fw-bold text-white">₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="text-end">
            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>TODAY'S CHANGE</span>
            <span className={`fs-4 fw-extrabold d-flex align-items-center gap-1 ${isUp ? 'text-success' : 'text-danger'}`}>
              {isUp ? <FaArrowUp /> : <FaArrowDown />}
              {isUp ? '+' : ''}{changePct}%
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          AI ACTION BANNER — prominent signal indicator
          ══════════════════════════════════════════════ */}
      {(() => {
        const actionStyles = {
          'BUY':         { border: '#22C55E', bg: 'rgba(34,197,94,0.10)',  text: '#22C55E', emoji: '🟢' },
          'HOLD':        { border: '#3B82F6', bg: 'rgba(59,130,246,0.10)', text: '#3B82F6', emoji: '🔵' },
          'WATCH':       { border: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', text: '#8B5CF6', emoji: '🟣' },
          'BOOK PROFIT': { border: '#F59E0B', bg: 'rgba(245,158,11,0.10)', text: '#F59E0B', emoji: '🟠' },
          'EXIT':        { border: '#EF4444', bg: 'rgba(239,68,68,0.10)',  text: '#EF4444', emoji: '🔴' },
          'IGNORE':      { border: '#6B7280', bg: 'rgba(107,114,128,0.1)', text: '#9CA3AF', emoji: '⚪' },
        };
        const style = actionStyles[safeRec.action] || actionStyles['HOLD'];
        const scoreColor = safeRec.confidence >= 75 ? '#22C55E' : safeRec.confidence >= 50 ? '#3B82F6' : '#EF4444';

        return (
          <div
            className="tp-card"
            style={{ border: `2px solid ${style.border}`, backgroundColor: style.bg }}
          >
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">

              {/* Left: Action pill + confidence */}
              <div className="d-flex align-items-center gap-4">
                <div className="text-center">
                  <div
                    className="fw-black d-inline-flex align-items-center gap-2 px-4 py-2 rounded-pill"
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: style.text,
                      backgroundColor: style.bg,
                      border: `2px solid ${style.border}`,
                      letterSpacing: '0.05em',
                      minWidth: '180px',
                      justifyContent: 'center'
                    }}
                  >
                    {style.emoji}  {safeRec.action}
                  </div>
                  <div className="mt-2">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <small className="text-muted" style={{ fontSize: '0.7rem' }}>CONFIDENCE</small>
                      <small className="fw-bold" style={{ color: scoreColor, fontSize: '0.8rem' }}>{safeRec.confidence}%</small>
                    </div>
                    <div className="progress" style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', width: '180px' }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${safeRec.confidence}%`, backgroundColor: scoreColor, transition: 'width 0.5s ease' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Risk badge */}
                <div className="text-center">
                  <small className="text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>RISK LEVEL</small>
                  <span
                    className="badge px-3 py-2 rounded-pill fw-bold"
                    style={{
                      fontSize: '0.85rem',
                      backgroundColor: safeRec.risk === 'LOW' ? 'rgba(34,197,94,0.15)' : safeRec.risk === 'HIGH' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: safeRec.risk === 'LOW' ? '#22C55E' : safeRec.risk === 'HIGH' ? '#EF4444' : '#F59E0B',
                      border: `1px solid ${safeRec.risk === 'LOW' ? '#22C55E' : safeRec.risk === 'HIGH' ? '#EF4444' : '#F59E0B'}`
                    }}
                  >
                    {safeRec.risk} RISK
                  </span>
                </div>
              </div>

              {/* Right: Target / Stoploss chips */}
              <div className="d-flex flex-wrap gap-3">
                <div
                  className="px-3 py-2 rounded-3 text-center"
                  style={{ backgroundColor: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', minWidth: '110px' }}
                >
                  <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>TARGET 1</small>
                  <span className="fw-bold text-success" style={{ fontSize: '1rem' }}>₹{safeRec.target1.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div
                  className="px-3 py-2 rounded-3 text-center"
                  style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', minWidth: '110px' }}
                >
                  <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>TARGET 2</small>
                  <span className="fw-bold text-success" style={{ fontSize: '1rem', opacity: 0.8 }}>₹{safeRec.target2.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div
                  className="px-3 py-2 rounded-3 text-center"
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', minWidth: '110px' }}
                >
                  <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>STOP LOSS</small>
                  <span className="fw-bold text-danger" style={{ fontSize: '1rem' }}>₹{safeRec.stopLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

            </div>

            {/* Reasons row */}
            {safeRec.reasons && safeRec.reasons.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${style.border}33` }}>
                <small className="text-muted d-block mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  ENGINE REASONING
                </small>
                <div className="d-flex flex-wrap gap-2">
                  {safeRec.reasons.map((r, i) => (
                    <span
                      key={i}
                      className="badge rounded-pill px-3 py-1"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--tp-text)',
                        fontSize: '0.75rem',
                        fontWeight: 400
                      }}
                    >
                      ✓ {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-Timeframe Confirmation */}
            {stock.multiTf && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${style.border}33` }}>
                <small className="text-muted d-block mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  🔄 MULTI-TIMEFRAME CONFIRMATION
                </small>
                <div className="d-flex gap-1 flex-wrap">
                  {Object.entries(stock.multiTf).map(([tf, signal]) => {
                    const tfColor = signal === 'BUY' ? '#22C55E' : signal === 'EXIT' ? '#EF4444' : '#F59E0B';
                    const tfBg = signal === 'BUY' ? 'rgba(34,197,94,0.12)' : signal === 'EXIT' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.08)';
                    return (
                      <span
                        key={tf}
                        className="badge rounded-pill px-2 py-1 fw-bold"
                        style={{
                          backgroundColor: tfBg,
                          color: tfColor,
                          border: `1px solid ${tfColor}44`,
                          fontSize: '0.7rem',
                          minWidth: '50px',
                          textAlign: 'center'
                        }}
                      >
                        {tf} {signal}
                      </span>
                    );
                  })}
                </div>
                {/* Composite confidence score across all timeframes */}
                {stock.multiTfConfidence != null && (
                  <div className="mt-2">
                    <div className="d-flex justify-content-between mb-1">
                      <small className="text-muted" style={{ fontSize: '0.6rem' }}>COMPOSITE SCORE</small>
                      <small className="fw-bold" style={{
                        color: stock.multiTfConfidence >= 60 ? '#22C55E' : stock.multiTfConfidence >= 40 ? '#F59E0B' : '#EF4444',
                        fontSize: '0.7rem'
                      }}>
                        {stock.multiTfConfidence}/100
                      </small>
                    </div>
                    <div className="progress" style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="progress-bar"
                        style={{
                          width: `${stock.multiTfConfidence}%`,
                          backgroundColor: stock.multiTfConfidence >= 60 ? '#22C55E' : stock.multiTfConfidence >= 40 ? '#F59E0B' : '#EF4444',
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <div className="row g-4">
        {/* Left Column - Chart, Indicators, Depth */}
        <div className="col-12 col-xl-8 d-flex flex-column gap-4">
          {/* TradingView Candlestick Chart */}
          <div className="tp-card" style={{ minHeight: '400px' }}>
            <h6 className="fw-bold text-muted uppercase mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              TradingView Lightweight Candle Feed
            </h6>
            <div ref={chartContainerRef} className="rounded border border-secondary bg-dark w-100"></div>
          </div>

          {/* Indicators details grid */}
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="tp-card h-100">
                <h6 className="fw-bold text-white border-bottom border-secondary pb-2 mb-3">Technical Metrics</h6>
                <div className="d-flex flex-column gap-2.5">
                  <div className="d-flex justify-content-between border-bottom border-dark pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">RSI (14)</span>
                    <span className={`fw-bold ${stock.rsi >= 60 ? 'text-success' : (stock.rsi <= 40 ? 'text-danger' : 'text-white')}`}>{stock.rsi}</span>
                  </div>
                  <div className="d-flex justify-content-between border-bottom border-dark pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">VWAP</span>
                    <span className="fw-bold text-white">₹{stock.vwap}</span>
                  </div>
                  <div className="d-flex justify-content-between border-bottom border-dark pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">MACD (12, 26, 9)</span>
                    <span className={`fw-bold ${stock.macd.hist >= 0 ? 'text-success' : 'text-danger'}`}>{stock.macd.macd.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between border-bottom border-dark pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">ADX (Trend Strength)</span>
                    <span className="fw-bold text-white">{stock.adx}</span>
                  </div>
                  <div className="d-flex justify-content-between pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">EMA 20 vs 50</span>
                    <span className={`fw-bold ${stock.ema20 > stock.ema50 ? 'text-success' : 'text-danger'}`}>
                      {stock.ema20 > stock.ema50 ? 'Bullish Cross' : 'Bearish Cross'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="tp-card h-100">
                <h6 className="fw-bold text-white border-bottom border-secondary pb-2 mb-3">Pivot Day Metrics</h6>
                <div className="d-flex flex-column gap-2.5">
                  <div className="d-flex justify-content-between border-bottom border-dark pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">Day High</span>
                    <span className="fw-bold text-white">₹{stock.high.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between border-bottom border-dark pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">Day Low</span>
                    <span className="fw-bold text-white">₹{stock.low.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between border-bottom border-dark pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">Open</span>
                    <span className="fw-bold text-white">₹{stock.open.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between border-bottom border-dark pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">Yesterday Close</span>
                    <span className="fw-bold text-white">₹{stock.close.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between pb-1.5" style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">Support / Resistance</span>
                    <span className="fw-bold text-info">₹{stock.support} / ₹{stock.resistance}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Market Depth Orders */}
          <div className="tp-card">
            <h6 className="fw-bold text-white border-bottom border-secondary pb-2 mb-3">Market Depth Order Book</h6>
            <div className="mb-3">
              <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.8rem' }}>
                <span className="text-success fw-bold">BUYERS (BID): {stock.depth.totalBuyQuantity}</span>
                <span className="text-danger fw-bold">(ASK) SELLERS: {stock.depth.totalSellQuantity}</span>
              </div>
              <div className="progress bg-danger" style={{ height: '8px' }}>
                <div className="progress-bar bg-success" style={{ width: `${buyDepthPct}%` }}></div>
              </div>
            </div>

            <div className="row g-3">
              {/* Bid Column */}
              <div className="col-12 col-md-6 border-end border-dark">
                <table className="table table-sm tp-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th className="text-success">Bid Price</th>
                      <th className="text-end">Quantity</th>
                      <th className="text-end">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.depth.buy.map((b, idx) => (
                      <tr key={idx}>
                        <td className="text-success fw-bold">₹{b.price.toFixed(2)}</td>
                        <td className="text-end text-light">{b.quantity}</td>
                        <td className="text-end text-muted">{b.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ask Column */}
              <div className="col-12 col-md-6">
                <table className="table table-sm tp-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th className="text-danger">Ask Price</th>
                      <th className="text-end">Quantity</th>
                      <th className="text-end">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.depth.sell.map((s, idx) => (
                      <tr key={idx}>
                        <td className="text-danger fw-bold">₹{s.price.toFixed(2)}</td>
                        <td className="text-end text-light">{s.quantity}</td>
                        <td className="text-end text-muted">{s.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Decision Engine Terminal & Mock Order placement */}
        <div className="col-12 col-xl-4 d-flex flex-column gap-4">

          {/* ═══ UNUSUAL PRICE MOVEMENT PANEL ═══ */}
          {stock.unusualMove && stock.unusualMove.opportunityScore >= 25 && (() => {
            const um = stock.unusualMove;
            const isSurge = um.type === 'SURGE';
            const borderColor = um.opportunityScore >= 70 ? (isSurge ? '#22C55E' : '#EF4444') : '#F59E0B';
            const bgColor = um.opportunityScore >= 70 ? (isSurge ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'rgba(245,158,11,0.08)';
            const sign = um.changePct >= 0 ? '+' : '';

            return (
              <div
                className="tp-card"
                style={{ border: `2px solid ${borderColor}88`, backgroundColor: bgColor }}
              >
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ fontSize: '1.6rem' }}>{um.emoji}</span>
                  <h6 className="fw-bold text-white mb-0" style={{ fontSize: '0.95rem' }}>
                    {um.label}
                  </h6>
                  <span className="ms-auto fw-bold" style={{ color: '#F59E0B', fontSize: '1.1rem' }}>{um.opportunityScore}/100</span>
                </div>

                <div className="d-flex flex-column gap-2 mt-2">
                  {/* Price change */}
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Price Change</span>
                    <span className="fw-bold" style={{ color: isSurge ? '#22C55E' : '#EF4444', fontSize: '1.1rem' }}>
                      {sign}{um.changePct}% (₹{um.moveRupees})
                    </span>
                  </div>

                  {/* ATR Ratio */}
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>vs Normal Range (ATR)</span>
                    <span className="fw-bold" style={{ color: um.atrRatio >= 2 ? '#F59E0B' : '#9CA3AF', fontSize: '0.85rem' }}>
                      {um.atrRatio}× ATR (₹{um.atr})
                    </span>
                  </div>

                  {/* Volume */}
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Volume vs Average</span>
                    <span className="fw-bold" style={{ color: um.volumeRatio >= 2 ? '#F59E0B' : '#9CA3AF', fontSize: '0.85rem' }}>
                      {um.volumeRatio}× {um.volumeRatio >= 3 ? '🔥' : ''}
                    </span>
                  </div>

                  {/* Intraday Momentum */}
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Intraday Momentum (from open)</span>
                    <span className="fw-bold" style={{ color: Math.abs(um.intradayPct) >= 0.5 ? (um.intradayPct >= 0 ? '#22C55E' : '#EF4444') : '#9CA3AF', fontSize: '0.85rem' }}>
                      {um.intradayPct >= 0 ? '+' : ''}{um.intradayPct}%
                    </span>
                  </div>

                  {/* Opportunity Score bar */}
                  <div className="mt-2">
                    <div className="d-flex justify-content-between mb-1">
                      <small className="text-muted" style={{ fontSize: '0.65rem' }}>OPPORTUNITY SCORE</small>
                      <small className="fw-bold" style={{ color: '#F59E0B', fontSize: '0.7rem' }}>{um.opportunityScore}/100</small>
                    </div>
                    <div className="progress" style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${um.opportunityScore}%`, backgroundColor: '#F59E0B', transition: 'width 0.5s ease' }}
                      />
                    </div>
                  </div>

                  {/* Factor breakdown mini-bars */}
                  <div className="mt-1 pt-2" style={{ borderTop: `1px solid ${borderColor}33` }}>
                    <small className="text-muted d-block mb-2" style={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>
                      FACTOR BREAKDOWN
                    </small>
                    {[
                      { label: 'Price % (40%)', pct: Math.min(100, (Math.abs(um.changePct) / (um.typicalDailyPct || 0.5)) * 50), color: isSurge ? '#22C55E' : '#EF4444' },
                      { label: 'Volume (25%)',  pct: Math.min(100, ((um.volumeRatio - 1) / 3) * 100), color: '#3B82F6' },
                      { label: 'ATR Ratio (20%)', pct: Math.min(100, (um.atrRatio / 2.5) * 100), color: '#8B5CF6' },
                      { label: 'Intraday (15%)', pct: Math.min(100, (Math.abs(um.intradayPct) / (um.typicalDailyPct || 0.5)) * 50), color: '#F59E0B' },
                    ].map(f => (
                      <div key={f.label} className="d-flex align-items-center gap-2 mb-1">
                        <span className="text-muted" style={{ fontSize: '0.6rem', width: '100px', flexShrink: 0 }}>{f.label}</span>
                        <div className="progress flex-grow-1" style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          <div className="progress-bar" style={{ width: `${Math.max(2, f.pct)}%`, backgroundColor: f.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* AI Decision Engine Terminal Card */}
          <div className="tp-card">
            <h6 className="fw-bold text-white mb-3">AI Decision Engine Output</h6>
            
            <div className="terminal-card mb-3">
              <div>========================</div>
              <div>MARKET: {checklist.marketTrend === 'Bullish' ? '🟢 Bullish' : (checklist.marketTrend === 'Bearish' ? '🔴 Bearish' : '🟡 Sideways')}</div>
              <div>SECTOR: ★★★★★ {stock.sector}</div>
              <div>STOCK: {stock.symbol}</div>
              <div>ENTRY: ₹{stock.price.toFixed(2)}</div>
              <div>CONFIDENCE: {rec.confidence}%</div>
              <div>ACTION: {terminalEmoji} {rec.action}</div>
              <div>STOP LOSS: ₹{rec.stopLoss}</div>
              <div>TARGET 1: ₹{rec.target1}</div>
              <div>TARGET 2: ₹{rec.target2}</div>
              <div>RISK: {rec.risk}</div>
              <div>========================</div>
            </div>

            <div>
              <small className="text-muted d-block mb-2">ENGINE ANALYSIS REASONS:</small>
              <ul className="ps-3 mb-0" style={{ fontSize: '0.85rem' }}>
                {rec.reasons.map((r, i) => (
                  <li key={i} className="text-light mb-1">{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Mock Buy/Sell Order Form */}
          <div className="tp-card">
            <h6 className="fw-bold text-white mb-3">
              {tradeMode === 'SELL' ? 'Open Mock Short Position' : 'Open Mock Long Position'}
            </h6>
            
            {tradeStatus.msg && (
              <div className={`alert py-2.5 px-3 mb-3 border text-center ${tradeStatus.success ? 'alert-success border-success text-success' : 'alert-danger border-danger text-danger'}`} style={{ fontSize: '0.85rem', backgroundColor: 'transparent' }}>
                {tradeStatus.msg}
              </div>
            )}

            <form onSubmit={handlePlaceOrder}>
              <div className="mb-3">
                <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>SYMBOL</label>
                <input type="text" className="form-control bg-dark border-secondary text-white" value={stock.symbol} disabled />
              </div>

              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>QTY</label>
                  <input
                    type="number"
                    className="form-control bg-dark border-secondary text-white"
                    value={qty}
                    min="1"
                    onChange={(e) => setQty(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="col-6">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>LIMIT ENTRY</label>
                  <input type="number" className="form-control bg-dark border-secondary text-white" value={stock.price} disabled />
                </div>
              </div>

              <div className="row g-2 mb-4">
                <div className="col-6">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>TARGET PRICE</label>
                  <input
                    type="number"
                    className="form-control bg-dark border-secondary text-white"
                    step="0.05"
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="col-6">
                  <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>STOP LOSS</label>
                  <input
                    type="number"
                    className="form-control bg-dark border-secondary text-white"
                    step="0.05"
                    value={stoploss}
                    onChange={(e) => setStoploss(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className={`btn ${tradeMode === 'SELL' ? 'btn-danger' : 'btn-success'} w-100 fw-bold py-2.5 d-flex align-items-center justify-content-center gap-2`}
                disabled={tradeStatus.loading}
              >
                <FaBriefcase />
                {tradeMode === 'SELL' ? 'Place Mock Intraday Short Trade' : 'Place Mock Intraday Trade'}
              </button>
              
              <small className="text-center d-block text-danger fw-bold mt-2" style={{ fontSize: '0.65rem' }}>
                ⚠️ REAL ORDERS ARE NEVER PLACED IN THE MARKET
              </small>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StockDetail;
