const { KiteConnect, KiteTicker } = require('kiteconnect');
const decisionEngine = require('./decisionEngine');
const stockMaster = require('./stockMaster');

// Sector mapping is now derived from stock_master.json at runtime
const SYMBOL_SECTORS = stockMaster.getSectorMap();

const DEFAULT_SCANNER_CONFIG = {
  vwap: true,
  ema20: true,
  ema50: true,
  rsi: true,
  macd: true,
  adx: true,
  volumeSpike: true,
  breakout: true,
  support: true,
  resistance: true,
  relativeStrength: true,
  sectorStrength: true,
  marketBreadth: true,
  unusualMove: true
};

class KiteService {
  constructor() {
    this.io = null;
    this.isSimulation = false;
    this.isLiveReady = false;
    this.kite = null;
    this.ticker = null;
    this.stocks = {};
    this.marketIndices = {
      'NIFTY50':       { price: 0, change: 0, changePercent: 0, history: [] },
      'SENSEX':        { price: 0, change: 0, changePercent: 0, history: [] },
      'NIFTY500':      { price: 0, change: 0, changePercent: 0, history: [] },
      'BANKNIFTY':     { price: 0, change: 0, changePercent: 0, history: [] },
      'NIFTYIT':       { price: 0, change: 0, changePercent: 0, history: [] },
      'NIFTYMIDCAP':   { price: 0, change: 0, changePercent: 0, history: [] },
      'NIFTYFMCG':     { price: 0, change: 0, changePercent: 0, history: [] },
      'NIFTYPHARMA':   { price: 0, change: 0, changePercent: 0, history: [] },
      'NIFTYNEXT50':   { price: 0, change: 0, changePercent: 0, history: [] },
      'NIFTYSERVICE':  { price: 0, change: 0, changePercent: 0, history: [] },
      'INDIAVIX':      { price: 0, change: 0, changePercent: 0, history: [] },
    };
    this.sectorStrengths = {};
    this.checklist = {};
    this.socketInterval = null;
    this.restPollInterval = null;
    this.dbService = null;
    this.favoriteSymbols = new Set(); // prioritised for WebSocket subscription
    this.circuitHits = [];            // [{ symbol, type, price, changePct, time }]
    this._priceTracker = {};          // symbol → { lastPrice, lastChangeTime, frozenSince }
  }

  initialize(io, dbService) {
    this.io = io;
    this.dbService = dbService;
    
    const apiKey = process.env.KITE_API_KEY;
    const apiSecret = process.env.KITE_API_SECRET;
    const accessToken = process.env.KITE_ACCESS_TOKEN;

    if (!apiKey || !apiSecret || !accessToken) {
      console.log('╔══════════════════════════════════════╗');
      console.log('║   ⚠️  ZERODHA CREDENTIALS MISSING     ║');
      console.log('║   Click "Connect Zerodha" in the UI   ║');
      console.log('║   to authenticate and get live data.  ║');
      console.log('╚══════════════════════════════════════╝');
      return;
    }

    console.log('╔══════════════════════════════════════╗');
    console.log('║   🔗 CONNECTING TO ZERODHA LIVE      ║');
    console.log('║   API Key:', apiKey.slice(0,8) + '...');
    console.log('╚══════════════════════════════════════╝');
    this.initKiteConnect(apiKey, apiSecret, accessToken);
  }

  // Emit a signal/notification to all connected frontend clients
  emitSignal(title, message, type = 'HOLD', confidence = 0) {
    if (this.io) {
      this.io.emit('signal', {
        title,
        message,
        type,
        confidence,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Emit auth status change to all connected frontend clients
  emitAuthStatus() {
    if (this.io) {
      this.io.emit('auth_status', {
        isSimulation: this.isSimulation,
        isConnected: this.isLiveReady && !!process.env.KITE_ACCESS_TOKEN
      });
    }
  }

  // Initialize a single stock entry from live data
  initStock(symbol, price) {
    const meta = stockMaster.enrich(symbol);
    const now = new Date().toISOString();
    this.stocks[symbol] = {
      symbol,
      name: meta.name,
      price,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
      vwap: price,
      sector: meta.sector,
      industry: meta.industry,
      isin: meta.isin,
      mcap: meta.mcap,
      token: meta.token,
      history: [{ time: now, open: price, high: price, low: price, close: price, volume: 0, vwap: price }],
      rsi: 50,
      ema20: price,
      ema50: price,
      macd: { macd: 0, signal: 0, hist: 0 },
      adx: 20,
      support: price * 0.97,
      resistance: price * 1.03,
      depth: { buy: [], sell: [], totalBuyQuantity: 0, totalSellQuantity: 0 },
      recommendation: { action: 'HOLD', confidence: 50, reasons: ['Waiting for live data...'] },
      // Multi-timeframe tracking
      timeframes: {
        '1m':  { candles: [{ time: now, open: price, high: price, low: price, close: price }], ema50: price, signal: 'HOLD' },
        '5m':  { candles: [{ time: now, open: price, high: price, low: price, close: price }], ema50: price, signal: 'HOLD' },
        '15m': { candles: [{ time: now, open: price, high: price, low: price, close: price }], ema50: price, signal: 'HOLD' },
        '1h':  { candles: [{ time: now, open: price, high: price, low: price, close: price }], ema50: price, signal: 'HOLD' },
        '1d':  { candles: [{ time: now, open: price, high: price, low: price, close: price }], ema50: price, signal: 'HOLD' },
        '1w':  { candles: [{ time: now, open: price, high: price, low: price, close: price }], ema50: price, signal: 'HOLD' }
      }
    };
  }

  recalculateIndicators(symbol) {
    const stock = this.stocks[symbol];
    const history = stock.history;
    const closes = history.map(h => h.close);
    const len = closes.length;

    if (len < 50) return;

    // 1. Calculate EMAs
    stock.ema20 = this.calculateEMA(closes, 20);
    stock.ema50 = this.calculateEMA(closes, 50);

    // 2. Calculate RSI (14)
    stock.rsi = this.calculateRSI(closes, 14);

    // 3. Calculate MACD (12, 26, 9)
    stock.macd = this.calculateMACD(closes);

    // 4. Calculate ADX (14)
    stock.adx = this.calculateADX(history, 14);

    // 5. VWAP
    let cumVol = 0;
    let cumPV = 0;
    // Calculate cumulative VWAP of the day (simulated by last 30 candles)
    const dayCandles = history.slice(-30);
    dayCandles.forEach(c => {
      cumVol += c.volume;
      cumPV += ((c.high + c.low + c.close) / 3) * c.volume;
    });
    stock.vwap = cumVol > 0 ? cumPV / cumVol : stock.price;

    // 6. Support & Resistance (Pivot points from recent high/low)
    const recentHistory = history.slice(-15);
    const highs = recentHistory.map(h => h.high);
    const lows = recentHistory.map(h => h.low);
    const ppHigh = Math.max(...highs);
    const ppLow = Math.min(...lows);
    stock.support = ppLow;
    stock.resistance = ppHigh;
  }

  calculateEMA(data, period) {
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  calculateRSI(closes, period = 14) {
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = closes[closes.length - period - 1 + i] - closes[closes.length - period - 2 + i];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - diff) / period;
      }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  calculateMACD(closes) {
    const ema12History = [];
    const ema26History = [];
    const macdHistory = [];

    // Calculate EMA12 & EMA26 histories
    let ema12 = closes[0];
    let ema26 = closes[0];
    const k12 = 2 / 13;
    const k26 = 2 / 27;

    for (let i = 0; i < closes.length; i++) {
      ema12 = closes[i] * k12 + ema12 * (1 - k12);
      ema26 = closes[i] * k26 + ema26 * (1 - k26);
      ema12History.push(ema12);
      ema26History.push(ema26);
      macdHistory.push(ema12 - ema26);
    }

    // Signal (9 EMA of MACD)
    let signal = macdHistory[0];
    const kSignal = 2 / 10;
    for (let i = 1; i < macdHistory.length; i++) {
      signal = macdHistory[i] * kSignal + signal * (1 - kSignal);
    }

    const currentMacd = macdHistory[macdHistory.length - 1];
    return {
      macd: currentMacd,
      signal: signal,
      hist: currentMacd - signal
    };
  }

  calculateADX(history, period = 14) {
    let trs = [];
    let plusDMs = [];
    let minusDMs = [];

    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      const prev = history[i - 1];

      // True Range
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close)
      );
      trs.push(tr);

      // +DM & -DM
      const upMove = current.high - prev.high;
      const downMove = prev.low - current.low;

      let plusDM = 0;
      let minusDM = 0;

      if (upMove > downMove && upMove > 0) plusDM = upMove;
      if (downMove > upMove && downMove > 0) minusDM = downMove;

      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    // Smooth averages
    let trSmooth = trs.slice(0, period).reduce((a, b) => a + b, 0);
    let plusDmSmooth = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
    let minusDmSmooth = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

    const dxHistory = [];

    for (let i = period; i < trs.length; i++) {
      trSmooth = trSmooth - trSmooth / period + trs[i];
      plusDmSmooth = plusDmSmooth - plusDmSmooth / period + plusDMs[i];
      minusDmSmooth = minusDmSmooth - minusDmSmooth / period + minusDMs[i];

      const plusDI = trSmooth > 0 ? 100 * (plusDmSmooth / trSmooth) : 0;
      const minusDI = trSmooth > 0 ? 100 * (minusDmSmooth / trSmooth) : 0;

      const sum = plusDI + minusDI;
      const diff = Math.abs(plusDI - minusDI);
      const dx = sum > 0 ? 100 * (diff / sum) : 0;
      dxHistory.push(dx);
    }

    if (dxHistory.length === 0) return 20;

    // Smooth DX to get ADX
    let adx = dxHistory.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dxHistory.length; i++) {
      adx = (adx * (period - 1) + dxHistory[i]) / period;
    }

    return adx;
  }

  recalculateSectors() {
    // Seed all known sectors with 0% so they always appear in heatmap
    const allSectors = new Set(Object.values(SYMBOL_SECTORS));
    allSectors.forEach(sector => {
      if (!this.sectorStrengths[sector]) {
        this.sectorStrengths[sector] = { name: sector, changePercent: 0, status: 'Neutral' };
      }
    });

    const sectors = {};
    // Group stocks by sector (use live stock list, not hardcoded map)
    Object.keys(this.stocks).forEach(symbol => {
      const stock = this.stocks[symbol];
      if (!stock || !stock.close) return;
      const sector = stock.sector || 'General';
      if (!sectors[sector]) sectors[sector] = { totalChange: 0, count: 0 };
      
      const changePercent = ((stock.price - stock.close) / stock.close) * 100;
      sectors[sector].totalChange += changePercent;
      sectors[sector].count += 1;
    });

    // Update sector strengths with live data
    Object.keys(sectors).forEach(sector => {
      const avgChange = sectors[sector].totalChange / sectors[sector].count;
      let status = 'Neutral';
      if (avgChange > 0.3) status = 'Green';
      else if (avgChange < -0.3) status = 'Red';
      
      this.sectorStrengths[sector] = {
        name: sector,
        changePercent: avgChange,
        status: status
      };
    });
  }

  recalculateChecklist() {
    let advances = 0;
    let declines = 0;
    
    Object.keys(this.stocks).forEach(sym => {
      const s = this.stocks[sym];
      if (s.price >= s.close) advances++;
      else declines++;
    });

    const total = advances + declines;
    const advancePercent = (advances / total) * 100;

    let marketTrend = 'Sideways';
    if (advancePercent > 60) marketTrend = 'Bullish';
    else if (advancePercent < 40) marketTrend = 'Bearish';

    // Sector strengths
    const sortedSectors = Object.values(this.sectorStrengths).sort((a, b) => b.changePercent - a.changePercent);
    const bestSector = sortedSectors[0]?.name || 'N/A';
    const weakSector = sortedSectors[sortedSectors.length - 1]?.name || 'N/A';

    // Find highest momentum stock & sector
    let maxMomentumStock = '';
    let maxMomentum = -Infinity;
    Object.keys(this.stocks).forEach(sym => {
      const change = Math.abs(((this.stocks[sym].price - this.stocks[sym].close) / this.stocks[sym].close) * 100);
      if (change > maxMomentum) {
        maxMomentum = change;
        maxMomentumStock = sym;
      }
    });

    // Overall market score
    let score = Math.floor(advancePercent);
    if (marketTrend === 'Bullish') score += 10;
    if (marketTrend === 'Bearish') score -= 10;
    score = Math.max(0, Math.min(100, score));

    let recommendation = 'Trade Carefully';
    if (score > 75) recommendation = 'Good Day To Trade';
    else if (score < 35) recommendation = 'Avoid Trading';

    let riskLevel = 'Medium';
    if (score > 80 || score < 20) riskLevel = 'High'; // volatility high
    else if (score > 40 && score < 70) riskLevel = 'Low';

    this.checklist = {
      marketTrend,
      bestSector,
      weakSector,
      advances,
      declines,
      highestVolumeSector: bestSector,
      highestMomentumSector: SYMBOL_SECTORS[maxMomentumStock] || 'IT',
      riskLevel,
      score,
      recommendation
    };
  }

  // ── MARKET BREADTH ──────────────────────────────────────────
  calculateMarketBreadth() {
    const sectors = {};
    const stocks = Object.values(this.stocks);

    stocks.forEach(s => {
      const sec = s.sector || 'General';
      if (!sectors[sec]) {
        sectors[sec] = {
          sector: sec,
          total: 0, rising: 0, falling: 0, unchanged: 0,
          aboveEMA50: 0, rsiSum: 0,
          priceChangeSum: 0,
          stocks: []
        };
      }
      const b = sectors[sec];
      b.total++;
      b.stocks.push(s.symbol);

      // Rising / Falling
      const change = s.price - s.close;
      if (change > 0) b.rising++;
      else if (change < 0) b.falling++;
      else b.unchanged++;

      // Above EMA50
      if (s.ema50 && s.price > s.ema50) b.aboveEMA50++;

      // RSI sum for average
      b.rsiSum += (s.rsi || 50);

      // Price change % for sector momentum
      b.priceChangeSum += s.close > 0 ? ((s.price - s.close) / s.close) * 100 : 0;
    });

    // Calculate derived stats & trend per sector
    const breadth = Object.values(sectors).map(b => {
      const avgRSI = Math.round(b.rsiSum / b.total);
      const aboveEMAPct = Math.round((b.aboveEMA50 / b.total) * 100);
      const avgChange = +(b.priceChangeSum / b.total).toFixed(2);
      const advancePct = Math.round((b.rising / b.total) * 100);

      let trend = 'Neutral';
      if (advancePct >= 65 && aboveEMAPct >= 65 && avgRSI >= 55) trend = 'Bullish';
      else if (advancePct >= 55 && aboveEMAPct >= 50) trend = 'Moderately Bullish';
      else if (advancePct <= 30 && aboveEMAPct <= 35 && avgRSI <= 45) trend = 'Bearish';
      else if (advancePct <= 40 && aboveEMAPct <= 45) trend = 'Moderately Bearish';

      return {
        sector: b.sector,
        total: b.total,
        rising: b.rising,
        falling: b.falling,
        unchanged: b.unchanged,
        advancePct,
        aboveEMA50: b.aboveEMA50,
        aboveEMA50Pct: aboveEMAPct,
        avgRSI,
        avgChange,
        trend
      };
    });

    // Sort: Bullish first, then by advance %
    breadth.sort((a, b) => {
      const trendOrder = { 'Bullish': 0, 'Moderately Bullish': 1, 'Neutral': 2, 'Moderately Bearish': 3, 'Bearish': 4 };
      const tDiff = (trendOrder[a.trend] || 2) - (trendOrder[b.trend] || 2);
      if (tDiff !== 0) return tDiff;
      return b.advancePct - a.advancePct;
    });

    this.breadth = breadth;
  }

  // ── MULTI-TIMEFRAME SIGNALS ──────────────────────────────────
  updateMultiTimeframe(symbol) {
    const stock = this.stocks[symbol];
    if (!stock) return;

    const tfs = stock.timeframes;
    const now = new Date().toISOString();
    const p = stock.price;

    // Timeframe config: [key, candleDurationMs, maxCandles]
    const configs = [
      ['1m',  60_000,   120],
      ['5m',  300_000,  100],
      ['15m', 900_000,  80],
      ['1h',  3_600_000, 60],
      ['1d',  86_400_000, 90],
      ['1w',  604_800_000, 52]
    ];

    for (const [tf, duration, max] of configs) {
      const tfData = tfs[tf];
      if (!tfData) continue;

      const candles = tfData.candles;
      const lastCandle = candles[candles.length - 1];
      const lastTime = new Date(lastCandle.time).getTime();

      if (now - lastTime >= duration) {
        // New candle
        candles.push({ time: now, open: p, high: p, low: p, close: p });
      } else {
        // Update current candle
        lastCandle.high = Math.max(lastCandle.high, p);
        lastCandle.low = Math.min(lastCandle.low, p);
        lastCandle.close = p;
      }

      // Trim to max
      if (candles.length > max) tfData.candles = candles.slice(-max);

      // Recalculate EMA50 for this timeframe
      if (candles.length >= 5) {
        const closes = candles.map(c => c.close);
        tfData.ema50 = this.calculateEMA(closes, Math.min(50, closes.length));
      }

      // Determine signal based on price vs EMA50
      if (tfData.ema50 && tfData.ema50 > 0) {
        const pctAbove = ((p - tfData.ema50) / tfData.ema50) * 100;
        if (pctAbove > 1) tfData.signal = 'BUY';
        else if (pctAbove > 0.3) tfData.signal = 'HOLD';
        else if (pctAbove > -0.3) tfData.signal = 'HOLD';
        else if (pctAbove > -1) tfData.signal = 'EXIT';
        else tfData.signal = 'EXIT';
      }
    }
  }

  /**
   * Multi-timeframe confirmation score (0-100)
   * Higher = more timeframes agree on bullish
   */
  getMultiTimeframeConfidence(symbol) {
    const stock = this.stocks[symbol];
    if (!stock?.timeframes) return 50;

    const tfs = stock.timeframes;
    const signals = Object.values(tfs).map(t => t.signal || 'HOLD');
    const buyCount = signals.filter(s => s === 'BUY').length;
    const holdCount = signals.filter(s => s === 'HOLD').length;
    const exitCount = signals.filter(s => s === 'EXIT').length;

    // Weight: BUY=+1, HOLD=0, EXIT=-1
    const score = buyCount - exitCount;
    const maxPossible = signals.length; // 6 timeframes

    // Normalize to 0-100
    const normalized = Math.round(50 + (score / maxPossible) * 50);
    return Math.max(5, Math.min(95, normalized));
  }

  // ── SECTOR STRENGTH SCORES ───────────────────────────────────
  calculateSectorScores() {
    const sectors = {};
    const stocks = Object.values(this.stocks);

    stocks.forEach(s => {
      const sec = s.sector || 'General';
      if (!sectors[sec]) {
        sectors[sec] = {
          sector: sec,
          total: 0,
          aboveEMA50: 0,
          rsiSum: 0,
          advancers: 0,
          decliners: 0,
          mtfBullish: 0,
          changeSum: 0
        };
      }
      const b = sectors[sec];
      b.total++;
      if (s.ema50 && s.price > s.ema50) b.aboveEMA50++;
      b.rsiSum += (s.rsi || 50);
      if (s.price > s.close) b.advancers++;
      else if (s.price < s.close) b.decliners++;
      b.changeSum += s.close > 0 ? ((s.price - s.close) / s.close) * 100 : 0;

      // Count multi-timeframe bullish confirmations
      if (s.timeframes) {
        const tfSignals = Object.values(s.timeframes).map(t => t.signal);
        if (tfSignals.filter(x => x === 'BUY').length >= 4) b.mtfBullish++;
      }
    });

    const scores = Object.values(sectors).map(b => {
      const emaPct = Math.round((b.aboveEMA50 / b.total) * 100);
      const avgRSI = Math.round(b.rsiSum / b.total);
      const advPct = Math.round((b.advancers / b.total) * 100);
      const avgChange = +(b.changeSum / b.total).toFixed(2);
      const mtfPct = Math.round((b.mtfBullish / b.total) * 100);

      // Composite score: 35% EMA, 25% RSI, 20% Advance, 10% MTF, 10% Change
      let emaScore = 0;
      if (emaPct >= 80) emaScore = 100;
      else if (emaPct >= 60) emaScore = 75;
      else if (emaPct >= 40) emaScore = 50;
      else if (emaPct >= 20) emaScore = 25;
      else emaScore = 5;

      const rsiScore = Math.min(100, Math.max(0, ((avgRSI - 30) / 50) * 100));
      const advScore = Math.min(100, Math.max(0, (advPct / 100) * 100));
      const mtfScore = Math.min(100, mtfPct * 2);
      const chgScore = Math.min(100, Math.max(0, 50 + avgChange * 10));

      const composite = Math.round(
        emaScore * 0.35 + rsiScore * 0.25 + advScore * 0.20 + mtfScore * 0.10 + chgScore * 0.10
      );

      // Trend from emaPct rules
      let trend;
      if (emaPct >= 80) trend = 'Strong Bullish 🟢';
      else if (emaPct >= 60) trend = 'Bullish 🟢';
      else if (emaPct >= 40) trend = 'Neutral 🟡';
      else if (emaPct >= 20) trend = 'Bearish 🔴';
      else trend = 'Strong Bearish 🔴';

      return {
        sector: b.sector,
        total: b.total,
        score: composite,
        emaPct,
        avgRSI,
        advPct,
        avgChange,
        mtfBullishPct: mtfPct,
        trend
      };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    this.sectorScores = scores;
  }

  // --- ZERODHA KITE CONNECT INTEGRATION ---
  initKiteConnect(apiKey, apiSecret, accessToken) {
    try {
      // Stop simulation loop and switch to live mode
      if (this.socketInterval) {
        clearInterval(this.socketInterval);
        this.socketInterval = null;
      }
      this.isSimulation = false;
      console.log('Switched to LIVE mode. Connecting to Zerodha Kite...');
      this.emitAuthStatus();

      this.kite = new KiteConnect({ api_key: apiKey });
      this.kite.setAccessToken(accessToken);

      this.ticker = new KiteTicker({
        api_key: apiKey,
        access_token: accessToken
      });

      // Enable auto-reconnect so network blips don't permanently kill live mode
      this.ticker.autoReconnect(true);

      // Pre-initialize index token map so ticks are handled immediately
      this._indexTokenMap = {
        256265: 'NIFTY50', 260105: 'BANKNIFTY', 265: 'SENSEX', 264969: 'INDIAVIX',
        256266: 'NIFTY500', 259873: 'NIFTYIT', 260201: 'NIFTYMIDCAP',
        260045: 'NIFTYFMCG', 259493: 'NIFTYPHARMA', 260605: 'NIFTYNEXT50',
        256267: 'NIFTYSERVICE'
      };

      this.ticker.connect();

      this.ticker.on('connect', () => {
        console.log('Zerodha Kite Ticker connected.');
        
        // Ensure simulation and REST polling are stopped (in case started by prior error/disconnect)
        if (this.socketInterval) {
          clearInterval(this.socketInterval);
          this.socketInterval = null;
        }
        if (this.restPollInterval) {
          clearInterval(this.restPollInterval);
          this.restPollInterval = null;
        }
        this.isSimulation = false;

        // Fetch positions and build stock list first, then subscribe
        this.fetchPositionsAndBuildStockList().then(async () => {
          await this._initIndexPrevClose();
          // Stock instrument tokens — from instrument DB + stock master
          let instrumentTokens = stockMaster.getTokenMap();

          // Augment with instrument DB tokens if MongoDB is connected
          try {
            const instrumentService = require('./instrumentService');
            const dbTokens = await instrumentService.getTokenMap();
            instrumentTokens = { ...instrumentTokens, ...dbTokens };
          } catch (e) { /* use stockMaster tokens only */ }

          const stockTokens = Object.entries(instrumentTokens)
            .filter(([sym]) => this.stocks[sym])
            .map(([sym, tok]) => ({ sym, tok }));

          // Prioritize favorites for WebSocket slots (Kite limit: ~200)
          const favSet = this.favoriteSymbols;
          stockTokens.sort((a, b) => {
            const aFav = favSet.has(a.sym) ? 0 : 1;
            const bFav = favSet.has(b.sym) ? 0 : 1;
            return aFav - bFav; // favorites first
          });

          const wsTokens = stockTokens.slice(0, 200).map(s => s.tok);
          const favInWS = stockTokens.slice(0, 200).filter(s => favSet.has(s.sym)).length;
          console.log(`⭐ ${favInWS} favorites prioritized in WebSocket (${wsTokens.length} total slots)`);

          // Index instrument tokens (always subscribe)
          const indexTokens = {
            'NIFTY50': 256265, 'BANKNIFTY': 260105, 'SENSEX': 265, 'INDIAVIX': 264969,
            'NIFTY500': 256266, 'NIFTYIT': 259873, 'NIFTYMIDCAP': 260201,
            'NIFTYFMCG': 260045, 'NIFTYPHARMA': 259493, 'NIFTYNEXT50': 260605,
            'NIFTYSERVICE': 256267
          };
          const idxToks = Object.values(indexTokens);
          
          const tokens = [...wsTokens, ...idxToks];
          if (tokens.length > 0) {
            this.ticker.setMode(this.ticker.modeFull, tokens);
            this.ticker.subscribe(tokens);
            console.log(`Subscribed to ${tokens.length} instruments (${wsTokens.length} stocks + ${idxToks.length} indices) for live ticks.`);
          }

          // Build reverse map for index tokens too
          this._indexTokenMap = {};
          Object.entries(indexTokens).forEach(([name, tok]) => { this._indexTokenMap[tok] = name; });

          // Notify frontend: ticker is live
          this.emitAuthStatus();
          this.emitSignal(
            '📡 Live Ticker Connected',
            `Successfully subscribed to ${tokens.length} instruments. Live prices incoming.`,
            'BUY'
          );

          // Immediately notify all clients that live mode is active
          if (this.io) {
            this.io.emit('ticks', {
              stocks: Object.values(this.stocks).map(s => ({
                symbol: s.symbol, name: s.name, price: s.price,
                open: s.open, high: s.high, low: s.low, close: s.close,
                volume: s.volume, vwap: Number(s.vwap.toFixed(2)),
                sector: s.sector, industry: s.industry, isin: s.isin, mcap: s.mcap, token: s.token,
                rsi: Number(s.rsi.toFixed(2)),
                ema20: Number(s.ema20.toFixed(2)), ema50: Number(s.ema50.toFixed(2)),
                macd: s.macd, adx: Number(s.adx.toFixed(2)),
                support: Number(s.support.toFixed(2)),
                resistance: Number(s.resistance.toFixed(2)),
                depth: s.depth, recommendation: s.recommendation,
                multiTf: s.timeframes ? {
                  '1m': s.timeframes['1m']?.signal || 'HOLD',
                  '5m': s.timeframes['5m']?.signal || 'HOLD',
                  '15m': s.timeframes['15m']?.signal || 'HOLD',
                  '1h': s.timeframes['1h']?.signal || 'HOLD',
                  '1d': s.timeframes['1d']?.signal || 'HOLD',
                  '1w': s.timeframes['1w']?.signal || 'HOLD'
                } : null
              })),
              indices: this.marketIndices,
              sectors: this.sectorStrengths,
              checklist: this.checklist,
              breadth: this.breadth,
              sectorScores: this.sectorScores,
              circuitHits: this.circuitHits,
              isSimulation: false
            });
          }

          // Also start REST polling immediately as parallel data source
          // (guarantees data even when WebSocket is silent — after hours, etc.)
          if (!this.restPollInterval) {
            this.startRestPolling();
          }
        });
      });

      this.ticker.on('ticks', (ticks) => {
        this.processKiteTicks(ticks);
      });

      this.ticker.on('error', (err) => {
        console.error('Kite Ticker error:', err.message || err);
        // Try REST API polling as fallback instead of simulation
        if (!this.isSimulation) {
          console.log('WebSocket ticker failed. Falling back to REST API polling for live data.');
          this.emitSignal(
            '⚠️ WebSocket Unavailable',
            'Live ticker connection failed. Using REST API polling for price updates.',
            'HOLD'
          );
          this.startRestPolling();
        }
      });

      this.ticker.on('close', () => {
        console.log('Kite Ticker connection closed.');
        if (!this.isSimulation) {
          console.log('WebSocket closed. Falling back to REST API polling.');
          this.emitSignal(
            '🔌 Ticker Disconnected',
            'Kite WebSocket closed. Switching to REST API polling.',
            'HOLD'
          );
          this.startRestPolling();
        }
      });
    } catch (e) {
      console.error('Error initializing Kite Connect:', e.message);
      // Try REST API polling instead of simulation
      if (this.kite) {
        console.log('Falling back to REST API polling for live data.');
        this.emitSignal(
          '⚠️ Ticker Init Failed',
          `Could not start WebSocket: ${e.message}. Using REST API polling.`,
          'HOLD'
        );
        this.startRestPolling();
      } else {
        this.emitSignal(
          '❌ Kite Initialization Failed',
          `Could not connect to Zerodha: ${e.message}. Check credentials and network.`,
          'EXIT'
        );
        console.error('All connection methods failed. App will display empty state until credentials are fixed.');
      }
    }
  }

  // Fetch live positions from Zerodha and build stock tracking list
  async fetchPositionsAndBuildStockList() {
    if (!this.kite) return;
    try {
      console.log('📋 Fetching live positions & holdings from Zerodha...');
      
      // Get positions and holdings
      let positions, holdings;
      try {
        [positions, holdings] = await Promise.all([
          this.kite.getPositions(),
          this.kite.getHoldings()
        ]);
      } catch (e) {
        console.log('⚠️  Could not fetch positions/holdings:', e.message);
        positions = { day: [], net: [] };
        holdings = [];
      }

      const trackedSymbols = new Set();
      
      // Add from positions (both day and net)
      if (positions?.day) {
        positions.day.forEach(p => { if (p.tradingsymbol) trackedSymbols.add(p.tradingsymbol); });
      }
      if (positions?.net) {
        positions.net.forEach(p => { if (p.tradingsymbol) trackedSymbols.add(p.tradingsymbol); });
      }
      
      // Add from holdings
      if (holdings) {
        holdings.forEach(h => { if (h.tradingsymbol) trackedSymbols.add(h.tradingsymbol); });
      }

      // ── Load tracked symbols from instrument database ─────────────
      // Try MongoDB first (instrumentService), fall back to stock_master.json
      let dbSymbols = [];
      try {
        const instrumentService = require('./instrumentService');
        // Get NIFTY 500 + any stocks in the DB that have enrichment data
        const instruments = await instrumentService.query({ limit: 2000 });
        dbSymbols = instruments.map(i => i.tradingsymbol);
        console.log(`📊 Loaded ${dbSymbols.length} symbols from instrument database`);
      } catch (e) {
        // MongoDB not connected or no instruments — use stock master
        dbSymbols = stockMaster.getAllSymbols();
        console.log(`📊 Loaded ${dbSymbols.length} symbols from stock_master.json (DB fallback)`);
      }

      // Add DB symbols to tracked set
      dbSymbols.forEach(s => trackedSymbols.add(s.toUpperCase()));

      console.log(`📋 Tracking ${trackedSymbols.size} unique symbols`);

      // Fetch initial prices in batches (Kite LTP limit: ~200 symbols per call)
      const allSymbols = [...trackedSymbols];
      const BATCH = 180;
      
      for (let i = 0; i < allSymbols.length; i += BATCH) {
        const batch = allSymbols.slice(i, i + BATCH);
        try {
          const instruments = batch.map(s => `NSE:${s}`);
          const ltpData = await this.kite.getLTP(instruments);
          
          batch.forEach(symbol => {
            const key = `NSE:${symbol}`;
            const price = ltpData[key]?.last_price || 0;
            if (price > 0) {
              this.initStock(symbol, price);
            }
          });
        } catch (e) {
          console.warn(`⚠️  LTP batch ${i / BATCH + 1} failed:`, e.message);
        }
      }

      console.log(`✅ Initialized ${Object.keys(this.stocks).length} stocks with live prices`);
      this.isLiveReady = true;
      this.emitAuthStatus();
      
    } catch (err) {
      console.error('Error building stock list:', err.message);
      // Last-resort fallback: stock master JSON
      console.log('⚠️  Using stock_master.json as last-resort fallback');
      const defaults = stockMaster.getAllSymbols();
      try {
        // Batch LTP calls
        const BATCH = 180;
        for (let i = 0; i < defaults.length; i += BATCH) {
          const batch = defaults.slice(i, i + BATCH);
          const instruments = batch.map(s => `NSE:${s}`);
          const ltpData = await this.kite.getLTP(instruments);
          batch.forEach(symbol => {
            const key = `NSE:${symbol}`;
            const price = ltpData[key]?.last_price || 0;
            if (price > 0) this.initStock(symbol, price);
          });
        }
        this.isLiveReady = true;
        this.emitAuthStatus();
        console.log(`✅ Initialized ${Object.keys(this.stocks).length} stocks from stock_master.json`);
      } catch (e2) {
        console.error('❌ Could not fetch any stock data:', e2.message);
      }
    }
  }

  // ── Initialize index OHLC (one-time at startup) ────────────
  async _initIndexPrevClose() {
    if (!this.kite || this._indexPrevCloseInited) return;
    this._indexPrevCloseInited = true;
    try {
      const idxInstruments = [
        'NSE:NIFTY 50', 'BSE:SENSEX', 'NSE:NIFTY 500', 'NSE:NIFTY BANK',
        'NSE:NIFTY IT', 'NSE:NIFTY MIDCAP 100', 'NSE:NIFTY FMCG',
        'NSE:NIFTY PHARMA', 'NSE:NIFTY NEXT 50', 'NSE:NIFTY SERV SECTOR',
        'NSE:INDIA VIX'
      ];
      const quotes = await this.kite.getQuote(idxInstruments);
      const idxMap = {
        'NSE:NIFTY 50': 'NIFTY50', 'BSE:SENSEX': 'SENSEX', 'NSE:NIFTY 500': 'NIFTY500',
        'NSE:NIFTY BANK': 'BANKNIFTY', 'NSE:NIFTY IT': 'NIFTYIT',
        'NSE:NIFTY MIDCAP 100': 'NIFTYMIDCAP', 'NSE:NIFTY FMCG': 'NIFTYFMCG',
        'NSE:NIFTY PHARMA': 'NIFTYPHARMA', 'NSE:NIFTY NEXT 50': 'NIFTYNEXT50',
        'NSE:NIFTY SERV SECTOR': 'NIFTYSERVICE', 'NSE:INDIA VIX': 'INDIAVIX'
      };
      Object.entries(quotes).forEach(([key, q]) => {
        const name = idxMap[key];
        if (name && this.marketIndices[name] && q?.ohlc?.close) {
          this.marketIndices[name]._prevClose = q.ohlc.close;
          this.marketIndices[name].price = q.last_price || q.ohlc.close;
          this.marketIndices[name].change = this.marketIndices[name].price - q.ohlc.close;
          this.marketIndices[name].changePercent = q.ohlc.close > 0
            ? Number(((this.marketIndices[name].change / q.ohlc.close) * 100).toFixed(2)) : 0;
        }
      });
      console.log('✅ Index previous close initialized from OHLC quotes');
    } catch (e) {
      console.warn('⚠️  Could not fetch index OHLC quotes:', e.message);
      this._indexPrevCloseInited = false; // retry on next tick
    }
  }

  // ── Shared Circuit Detection (used by both WS and REST) ──────
  _detectCircuitHit(symbol, stock, price) {
    const trk = this._priceTracker[symbol] || { lastPrice: price, lastChangeTime: Date.now(), frozenSince: null };
    const nowTs = Date.now();
    if (price !== trk.lastPrice) {
      trk.lastPrice = price;
      trk.lastChangeTime = nowTs;
      trk.frozenSince = null;
    } else if (!trk.frozenSince) {
      trk.frozenSince = nowTs;
    }
    this._priceTracker[symbol] = trk;

    // Real circuit detection: price frozen with zero volume at circuit limit
    const frozenMs = trk.frozenSince ? (nowTs - trk.frozenSince) : 0;
    const minFreezeMs = this.restPollInterval ? 30000 : 60000; // 30s REST, 60s WS
    // Only flag if previous close is different from current price (stock has real OHLC data)
    if (frozenMs > minFreezeMs && stock.close > 0 && Math.abs(price - stock.close) > 0.01) {
      const chgPct = ((price - stock.close) / stock.close) * 100;
      const absChg = Math.abs(chgPct);
      // Common Indian circuit limits: 2%, 5%, 10%, 20% — detect ≥ 4.5%
      const nearCircuit = absChg >= 4.5;
      // Real circuit = no trading volume (frozen!)
      const volumeIsZero = !stock.volume || stock.volume <= 10;
      const alreadyRecorded = this.circuitHits.find(h => h.symbol === symbol && (nowTs - new Date(h.time).getTime() < 900000));

      if (nearCircuit && volumeIsZero && !alreadyRecorded) {
        const type = chgPct > 0 ? 'UPPER' : 'LOWER';
        const hit = {
          symbol,
          name: stock.name,
          type,
          price,
          changePct: Number(chgPct.toFixed(2)),
          time: new Date().toISOString(),
          sector: stock.sector
        };
        const today = new Date().toDateString();
        if (this._circuitDate !== today) {
          this.circuitHits = [];
          this._circuitDate = today;
        }
        this.circuitHits.unshift(hit);
        if (this.circuitHits.length > 100) this.circuitHits = this.circuitHits.slice(0, 100);
        console.log(`🔒 CIRCUIT ${type}: ${symbol} @ ₹${price} (${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%) — frozen ${Math.round(frozenMs/1000)}s, vol=${stock.volume}`);
        if (this.io) {
          this.io.emit('circuit_hit', hit);
        }
      }
    }
  }

  processKiteTicks(ticks) {
    // Map instrument tokens back to symbols (from stock master)
    const tokenToSymbol = stockMaster.getTokenToSymbolMap();

    const priceLog = [];
    ticks.forEach(tick => {
      // Handle index ticks first
      if (this._indexTokenMap && this._indexTokenMap[tick.instrument_token]) {
        const idxName = this._indexTokenMap[tick.instrument_token];
        if (tick.last_price && this.marketIndices[idxName]) {
          const idx = this.marketIndices[idxName];
          // Use OHLC close (yesterday's close) if available from tick
          if (tick.ohlc && tick.ohlc.close && tick.ohlc.close > 0) {
            idx._prevClose = tick.ohlc.close;
          } else if (!idx._prevClose || idx._prevClose === 0) {
            idx._prevClose = tick.last_price;
          }
          idx.price = tick.last_price;
          idx.change = idx.price - idx._prevClose;
          idx.changePercent = idx._prevClose > 0 ? Number(((idx.change / idx._prevClose) * 100).toFixed(2)) : 0;
          priceLog.push(`${idxName}:₹${tick.last_price}`);
        }
        return;
      }

      // Handle stock ticks
      const symbol = tokenToSymbol[tick.instrument_token];
      if (!symbol) return;

      // Auto-init stock from live tick if not yet tracked
      if (!this.stocks[symbol]) {
        const price = tick.last_price || 0;
        if (price > 0) {
          this.initStock(symbol, price);
          console.log(`📋 Auto-added ${symbol} from live tick: ₹${price}`);
        } else {
          return;
        }
      }

      const stock = this.stocks[symbol];
      const oldPrice = stock.price;

      // Update from live tick
      if (tick.last_price) {
        stock.price = tick.last_price;
        const arrow = tick.last_price > oldPrice ? '↑' : (tick.last_price < oldPrice ? '↓' : '·');
        priceLog.push(`${symbol}:₹${tick.last_price}${arrow}`);

        // ── Circuit Hit Detection ──────────────────────────────
        this._detectCircuitHit(symbol, stock, tick.last_price);
      }
      if (tick.ohlc) {
        stock.open = tick.ohlc.open;
        stock.high = tick.ohlc.high;
        stock.low = tick.ohlc.low;
        stock.close = tick.ohlc.close;
      }
      if (tick.volume_traded) stock.volume = tick.volume_traded;

      // Push to history
      stock.history.push({
        time: new Date().toISOString(),
        open: stock.open,
        high: stock.high,
        low: stock.low,
        close: stock.price,
        volume: tick.volume_traded || stock.volume,
        vwap: stock.vwap
      });

      // Keep only last 200 candles
      if (stock.history.length > 200) {
        stock.history = stock.history.slice(-200);
      }

      // Recalculate indicators
      this.recalculateIndicators(symbol);
    });

    // Log live WebSocket ticks
    if (priceLog.length > 0) {
      console.log(`[🔗 LIVE WS] ${priceLog.join(' | ')}`);
    }

    // Regenerate sectors and checklist after processing all ticks
    this.recalculateSectors();
    this.recalculateChecklist();
    this.calculateMarketBreadth();
    this.calculateSectorScores();

    // Update open trade P&L with live prices
    this.updateOpenTradesPnL();

    // Run decision engine on updated stocks (async wrapper for live WS ticks)
    (async () => {
      let activeConfig = DEFAULT_SCANNER_CONFIG;
      try { activeConfig = await this.dbService.getScannerConfig(); } catch (e) {}
      Object.keys(this.stocks).forEach(symbol => {
        this.updateMultiTimeframe(symbol);
        const stock = this.stocks[symbol];
        const dec = decisionEngine.evaluate(stock, this.checklist.marketTrend, this.sectorStrengths[stock.sector]?.changePercent || 0, activeConfig, 'LIVE-WS');
        stock.recommendation = { action: dec.action, confidence: dec.confidence, reasons: dec.reasons, risk: dec.risk, stopLoss: dec.stopLoss, target1: dec.target1, target2: dec.target2, unusualMove: dec.unusualMove };
      });
    })();

    // Emit live data to all connected frontend clients
    if (this.io) {
      this.io.emit('ticks', {
        stocks: Object.values(this.stocks).map(s => ({
          symbol: s.symbol,
          name: s.name,
          price: s.price,
          open: s.open,
          high: s.high,
          low: s.low,
          close: s.close,
          volume: s.volume,
          vwap: Number(s.vwap.toFixed(2)),
          sector: s.sector,
          industry: s.industry,
          isin: s.isin,
          mcap: s.mcap,
          token: s.token,
          rsi: Number(s.rsi.toFixed(2)),
          ema20: Number(s.ema20.toFixed(2)),
          ema50: Number(s.ema50.toFixed(2)),
          macd: s.macd,
          adx: Number(s.adx.toFixed(2)),
          support: Number(s.support.toFixed(2)),
          resistance: Number(s.resistance.toFixed(2)),
          depth: s.depth,
          recommendation: s.recommendation,
          unusualMove: s.recommendation?.unusualMove || null,
          multiTf: s.timeframes ? {
            '1m': s.timeframes['1m']?.signal || 'HOLD',
            '5m': s.timeframes['5m']?.signal || 'HOLD',
            '15m': s.timeframes['15m']?.signal || 'HOLD',
            '1h': s.timeframes['1h']?.signal || 'HOLD',
            '1d': s.timeframes['1d']?.signal || 'HOLD',
            '1w': s.timeframes['1w']?.signal || 'HOLD'
          } : null
        })),
        indices: this.marketIndices,
        sectors: this.sectorStrengths,
        checklist: this.checklist,
        breadth: this.breadth,
        sectorScores: this.sectorScores,
        circuitHits: this.circuitHits,
        isSimulation: this.isSimulation
      });
    }
  }

  // --- REST API POLLING FALLBACK (when WebSocket ticker fails) ---
  startRestPolling() {
    if (this.restPollInterval) return;
    console.log('╔══════════════════════════════════════╗');
    console.log('║   📡 LIVE DATA via REST POLLING      ║');
    console.log('║   Polling every 2.5s from Kite API   ║');
    console.log('╚══════════════════════════════════════╝');
    this.isSimulation = false;
    this.emitAuthStatus();

    // Fetch positions and build stock list first
    this.fetchPositionsAndBuildStockList().then(async () => {
      await this._initIndexPrevClose();
      if (this.restPollInterval) return; // already cancelled
      this.startPollingLoop();
    });
  }

  startPollingLoop() {
    let pollCount = 0;
    this.restPollInterval = setInterval(async () => {
      try {
        pollCount++;
        // Build instrument list: stocks + indices
        const symbols = Object.keys(this.stocks);
        const stockInstruments = symbols.map(s => `NSE:${s}`);
        const indexInstruments = [
          'NSE:NIFTY 50',         // NIFTY50
          'BSE:SENSEX',           // SENSEX
          'NSE:NIFTY 500',        // NIFTY500
          'NSE:NIFTY BANK',       // BANKNIFTY
          'NSE:NIFTY IT',         // NIFTYIT
          'NSE:NIFTY MIDCAP 100', // NIFTYMIDCAP
          'NSE:NIFTY FMCG',       // NIFTYFMCG
          'NSE:NIFTY PHARMA',     // NIFTYPHARMA
          'NSE:NIFTY NEXT 50',    // NIFTYNEXT50
          'NSE:NIFTY SERV SECTOR',// NIFTYSERVICE
          'NSE:INDIA VIX'         // INDIAVIX
        ];
        const allInstruments = [...stockInstruments, ...indexInstruments];
        
        // Kite LTP API limit: ~200 instruments per call — batch if needed
        const LTP_BATCH = 180;
        let ltpData = {};
        for (let i = 0; i < allInstruments.length; i += LTP_BATCH) {
          const batch = allInstruments.slice(i, i + LTP_BATCH);
          try {
            const batchData = await this.kite.getLTP(batch);
            ltpData = { ...ltpData, ...batchData };
          } catch (e) {
            console.warn(`⚠️  LTP batch ${Math.floor(i / LTP_BATCH) + 1} failed:`, e.message);
          }
        }
        
        // Build price log line
        const priceLog = [];
        // ltpData format: { "NSE:BEL": { last_price: 250.5, ... }, ... }
        Object.keys(ltpData).forEach(key => {
          const data = ltpData[key];
          
          // Check if it's an index
          const idxMap = {
            'NSE:NIFTY 50': 'NIFTY50', 'BSE:SENSEX': 'SENSEX',
            'NSE:NIFTY 500': 'NIFTY500', 'NSE:NIFTY BANK': 'BANKNIFTY',
            'NSE:NIFTY IT': 'NIFTYIT', 'NSE:NIFTY MIDCAP 100': 'NIFTYMIDCAP',
            'NSE:NIFTY FMCG': 'NIFTYFMCG', 'NSE:NIFTY PHARMA': 'NIFTYPHARMA',
            'NSE:NIFTY NEXT 50': 'NIFTYNEXT50', 'NSE:NIFTY SERV SECTOR': 'NIFTYSERVICE',
            'NSE:INDIA VIX': 'INDIAVIX'
          };
          if (idxMap[key] && data?.last_price) {
            const idx = this.marketIndices[idxMap[key]];
            // Only set prevClose if not already initialized from OHLC
            if (!idx._prevClose || idx._prevClose === 0) {
              idx._prevClose = data.last_price;
            }
            idx.price = data.last_price;
            idx.change = idx.price - idx._prevClose;
            idx.changePercent = idx._prevClose > 0 ? Number(((idx.change / idx._prevClose) * 100).toFixed(2)) : 0;
            if (['NIFTY50', 'BANKNIFTY', 'SENSEX'].includes(idxMap[key])) {
              priceLog.push(`${idxMap[key]}:₹${data.last_price}`);
            }
            return;
          }

          // Regular stock
          const symbol = key.replace('NSE:', '');
          if (data && this.stocks[symbol]) {
            const stock = this.stocks[symbol];
            const oldPrice = stock.price;
            if (data.last_price) {
              stock.price = data.last_price;
              const arrow = data.last_price > oldPrice ? '↑' : (data.last_price < oldPrice ? '↓' : '·');
              priceLog.push(`${symbol}:₹${data.last_price}${arrow}`);

              // ── Circuit Detection (REST polling) ──────────────
              this._detectCircuitHit(symbol, stock, data.last_price);

              // Update latest candle
              const latest = stock.history[stock.history.length - 1];
              if (latest) {
                latest.close = data.last_price;
                latest.high = Math.max(latest.high, data.last_price);
                latest.low = Math.min(latest.low, data.last_price);
              }
            }
          }
        });

        // Log actual live prices to terminal
        if (priceLog.length > 0) {
          console.log(`[📡 LIVE REST #${pollCount}] ${priceLog.join(' | ')}`);
        }

        this.recalculateSectors();
        this.recalculateChecklist();
        this.calculateMarketBreadth();
        this.calculateSectorScores();

        // Update open trade P&L with live prices
        this.updateOpenTradesPnL();

        // Run decision engine on each stock for scanner signals
        let activeConfig = DEFAULT_SCANNER_CONFIG;
        try { activeConfig = await this.dbService.getScannerConfig(); } catch (e) {}
        const updatedSignals = [];
        Object.keys(this.stocks).forEach(symbol => {
          this.updateMultiTimeframe(symbol);
          const stock = this.stocks[symbol];
          const oldRec = stock.recommendation?.action;
          const dec = decisionEngine.evaluate(stock, this.checklist.marketTrend, this.sectorStrengths[stock.sector]?.changePercent || 0, activeConfig, 'LIVE-REST');
          stock.recommendation = { action: dec.action, confidence: dec.confidence, reasons: dec.reasons, risk: dec.risk, stopLoss: dec.stopLoss, target1: dec.target1, target2: dec.target2, unusualMove: dec.unusualMove };
          if (dec.action !== oldRec) {
            updatedSignals.push({ symbol, old: oldRec, new: dec.action, confidence: dec.confidence, reason: dec.reasons[0] });
          }
        });

        // Emit to frontend
        if (this.io) {
          this.io.emit('ticks', {
            stocks: Object.values(this.stocks).map(s => ({
              symbol: s.symbol, name: s.name, price: s.price,
              open: s.open, high: s.high, low: s.low, close: s.close,
              volume: s.volume, vwap: Number(s.vwap.toFixed(2)),
              sector: s.sector, rsi: Number(s.rsi.toFixed(2)),
              ema20: Number(s.ema20.toFixed(2)), ema50: Number(s.ema50.toFixed(2)),
              macd: s.macd, adx: Number(s.adx.toFixed(2)),
              support: Number(s.support.toFixed(2)),
              resistance: Number(s.resistance.toFixed(2)),
              depth: s.depth, recommendation: s.recommendation,
              unusualMove: s.recommendation?.unusualMove || null,
              multiTf: s.timeframes ? {
                '1m': s.timeframes['1m']?.signal || 'HOLD',
                '5m': s.timeframes['5m']?.signal || 'HOLD',
                '15m': s.timeframes['15m']?.signal || 'HOLD',
                '1h': s.timeframes['1h']?.signal || 'HOLD',
                '1d': s.timeframes['1d']?.signal || 'HOLD',
                '1w': s.timeframes['1w']?.signal || 'HOLD'
              } : null
            })),
            indices: this.marketIndices,
            sectors: this.sectorStrengths,
            checklist: this.checklist,
            breadth: this.breadth,
            sectorScores: this.sectorScores,
            circuitHits: this.circuitHits,
            isSimulation: false
          });
        }

        // Emit signal notifications for recommendation changes
        updatedSignals.forEach(sig => {
          if (this.io) {
            this.io.emit('signal', {
              title: `${sig.symbol} Recommendation Update`,
              message: `${sig.symbol} signal shifted to ${sig.new} (${sig.confidence}% confidence). Reason: ${sig.reason}`,
              type: sig.new,
              confidence: sig.confidence,
              timestamp: new Date().toISOString()
            });
          }
        });
      } catch (err) {
        console.error('REST polling error:', err.message);
        this.emitSignal(
          '❌ Live Data Error',
          `REST API error: ${err.message}. Retrying in 5 seconds...`,
          'EXIT'
        );
        // Keep retrying — don't give up on live data
      }
    }, 2500); // Poll every 2.5 seconds
  }

  stopRestPolling() {
    if (this.restPollInterval) {
      clearInterval(this.restPollInterval);
      this.restPollInterval = null;
    }
  }

  // Update open trades P&L with current prices
  async updateOpenTradesPnL() {
    if (!this.dbService) return;
    try {
      const openTrades = await this.dbService.getTrades();
      for (const t of openTrades) {
        const currentStock = this.stocks[t.symbol];
        if (!currentStock) continue;
        
        const isShort = t.type === 'SELL';
        const diffPrice = isShort ? (t.entry - currentStock.price) : (currentStock.price - t.entry);
        const currentProfit = Number((diffPrice * t.quantity).toFixed(2));
        const holdingMs = Date.now() - new Date(t.createdAt).getTime();
        const holdingTime = Math.max(1, Math.floor(holdingMs / 60000));

        let actionAdvice = 'HOLD';
        if (isShort) {
          if (currentStock.price <= t.target) actionAdvice = 'BOOK PROFIT';
          else if (currentStock.price >= t.stoploss) actionAdvice = 'EXIT';
          else actionAdvice = 'HOLD SHORT';
        } else {
          if (currentStock.price >= t.target) actionAdvice = 'BOOK PROFIT';
          else if (currentStock.price <= t.stoploss) actionAdvice = 'EXIT';
          else actionAdvice = currentStock.recommendation?.action || 'HOLD';
        }

        await this.dbService.updateTrade(t._id || t.id, {
          currentPrice: currentStock.price,
          currentProfit,
          holdingTime,
          recommendation: actionAdvice
        });
      }
    } catch (e) { /* DB not connected yet */ }
  }

  getHistory(symbol) {
    const stock = this.stocks[symbol];
    if (!stock) return [];
    return stock.history;
  }

  async syncKitePositions(dbService) {
    if (this.isSimulation || !this.kite) {
      throw new Error('Zerodha Kite integration is in simulation mode or not initialized. Please fill in KITE_API_SECRET and KITE_ACCESS_TOKEN in .env and set SIMULATION_MODE=false.');
    }

    try {
      const holdings = await this.kite.getHoldings();
      const positionsObj = await this.kite.getPositions();
      const netPositions = positionsObj.net || [];

      const existingTrades = await dbService.getTrades();
      const syncedTrades = [];

      // Process holdings (Always Long/BUY)
      for (const h of holdings) {
        if (h.quantity > 0) {
          const symbol = h.tradingsymbol.toUpperCase();
          const entry = h.average_price;
          const quantity = h.quantity;
          
          let found = existingTrades.find(t => t.symbol === symbol && t.type === 'BUY');
          if (!found) {
            const target = Number((entry * 1.02).toFixed(2));
            const stoploss = Number((entry * 0.98).toFixed(2));
            
            const newTrade = await dbService.addTrade({
              symbol,
              type: 'BUY',
              entry: Number(entry),
              quantity: Number(quantity),
              target,
              stoploss,
              currentPrice: Number(entry),
              currentProfit: 0,
              holdingTime: 0,
              recommendation: 'HOLD'
            });
            syncedTrades.push(newTrade);
          } else {
            syncedTrades.push(found);
          }
        }
      }

      // Process positions (Can be BUY or SELL)
      for (const pos of netPositions) {
        if (pos.quantity !== 0) {
          const symbol = pos.tradingsymbol.toUpperCase();
          const entry = pos.average_price || pos.buy_price || pos.sell_price;
          const quantity = Math.abs(pos.quantity);
          const type = pos.quantity > 0 ? 'BUY' : 'SELL';

          let found = existingTrades.find(t => t.symbol === symbol && t.type === type);
          if (!found) {
            const isShort = type === 'SELL';
            const target = Number((entry * (isShort ? 0.98 : 1.02)).toFixed(2));
            const stoploss = Number((entry * (isShort ? 1.02 : 0.98)).toFixed(2));

            const newTrade = await dbService.addTrade({
              symbol,
              type,
              entry: Number(entry),
              quantity: Number(quantity),
              target,
              stoploss,
              currentPrice: Number(entry),
              currentProfit: 0,
              holdingTime: 0,
              recommendation: 'HOLD'
            });
            syncedTrades.push(newTrade);
          } else {
            syncedTrades.push(found);
          }
        }
      }

      return { success: true, count: syncedTrades.length, trades: syncedTrades };
    } catch (err) {
      console.error('Error syncing positions from Kite API:', err);
      throw err;
    }
  }

  stop() {
    if (this.socketInterval) {
      clearInterval(this.socketInterval);
    }
    if (this.restPollInterval) {
      clearInterval(this.restPollInterval);
    }
    if (this.ticker) {
      this.ticker.disconnect();
    }
  }
}

module.exports = new KiteService();
