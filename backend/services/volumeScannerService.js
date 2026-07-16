/**
 * Volume Scanner Service — continuously computes volume-based metrics
 * for every stock on each tick and re-ranks them live.
 *
 * Metrics computed:
 *   - RVOL (Relative Volume)      — current volume / avg volume (last 20 candles)
 *   - 1-min Volume Spike          — current 1m candle vol / avg 1m vol
 *   - 5-min Volume Spike          — current 5m candle vol / avg 5m vol
 *   - Consecutive Vol Increase    — volume rising last 3 candles
 *   - Price ↑ + Volume ↑          — price up AND volume above average
 *   - Breakout + Volume           — price above resistance + high volume
 *   - Gap Up + High Volume        — gap up from prev close + vol spike
 *   - Opening Range Breakout+Vol  — breaks opening range + volume spike
 */

class VolumeScannerService {
  constructor() {
    // Per-stock computed volume metrics
    this.metrics = {};   // symbol → { rvol, spike1m, spike5m, consecutiveVol, ... }

    // Default thresholds
    this.config = {
      rvolThreshold: 1.2,       // min RVOL to flag
      spike1mThreshold: 2.0,    // min 1-min spike ratio
      spike5mThreshold: 2.0,    // min 5-min spike ratio
      consecutiveCandles: 3,    // candles to check for rising volume
    };
  }

  /**
   * Update volume metrics for ALL stocks.
   * Called on every tick cycle from kiteService / decision engine pipeline.
   * @param {object} stocksMap  - kiteService.stocks (all tracked stocks)
   */
  updateAll(stocksMap) {
    for (const symbol of Object.keys(stocksMap)) {
      const stock = stocksMap[symbol];
      if (!stock || !stock.history || stock.history.length < 5) continue;

      const history = stock.history;
      const latest = history[history.length - 1];
      const currentPrice = stock.price || latest.close;

      // ── 1. RVOL (Relative Volume) ─────────────────────────────
      const recentCandles = history.slice(-20);
      const avgVol = recentCandles.reduce((a, c) => a + (c.volume || 0), 0) / recentCandles.length;
      const currentVol = stock.volume || latest.volume || 0;
      const rvol = avgVol > 0 ? +(currentVol / avgVol).toFixed(2) : 1.0;

      // ── 2. 1-minute Volume Spike ──────────────────────────────
      const tf1m = stock.timeframes?.['1m'];
      const spike1m = this._calcTimeframeSpike(tf1m);

      // ── 3. 5-minute Volume Spike ──────────────────────────────
      const tf5m = stock.timeframes?.['5m'];
      const spike5m = this._calcTimeframeSpike(tf5m);

      // ── 4. Consecutive Volume Increase (last 3 candles) ───────
      const consecutiveVol = this._checkConsecutiveVolIncrease(history, 3);

      // ── 5. Price ↑ + Volume ↑ ─────────────────────────────────
      const prevClose = stock.previousClose || stock.close;
      const priceUp = currentPrice > prevClose;
      const priceUpVolumeUp = priceUp && rvol >= this.config.rvolThreshold;

      // ── 6. Breakout + Volume Confirmation ─────────────────────
      const resistance = stock.resistance || currentPrice * 1.03;
      const breakoutVolume = (currentPrice >= resistance * 0.995) && rvol >= this.config.rvolThreshold;

      // ── 7. Gap Up + High Volume ───────────────────────────────
      const openPrice = stock.open || currentPrice;
      const gapUpPct = prevClose > 0 ? ((openPrice - prevClose) / prevClose) * 100 : 0;
      const gapUpVolume = gapUpPct >= 1.0 && rvol >= this.config.rvolThreshold;

      // ── 8. Opening Range Breakout + Volume ────────────────────
      const orBreakoutVolume = this._checkORBreakout(stock, rvol, this.config.rvolThreshold);

      // ── Composite Score (0-100) ───────────────────────────────
      let score = 0;
      if (rvol >= 1.2) score += 10;
      if (rvol >= 1.5) score += 10;
      if (rvol >= 2.0) score += 10;
      if (rvol >= 3.0) score += 10;
      if (rvol >= 5.0) score += 15;
      if (spike1m >= 2.0) score += 10;
      if (spike5m >= 2.0) score += 10;
      if (consecutiveVol) score += 8;
      if (priceUpVolumeUp) score += 7;
      if (breakoutVolume) score += 5;
      if (gapUpVolume) score += 5;
      if (orBreakoutVolume) score += 5;

      this.metrics[symbol] = {
        symbol,
        name: stock.name || symbol,
        price: currentPrice,
        change: stock.change || 0,
        sector: stock.sector || 'General',
        volume: currentVol,
        rvol,
        spike1m,
        spike5m,
        consecutiveVol,
        priceUpVolumeUp,
        breakoutVolume,
        gapUpVolume,
        orBreakoutVolume,
        score,
        open: openPrice,
        previousClose: prevClose,
        high: stock.high || currentPrice,
        low: stock.low || currentPrice,
      };
    }
  }

  /**
   * Get all stocks ranked by volume score (descending), with optional filters.
   * @param {object} filters
   * @param {number} filters.minRvol      - minimum RVOL threshold
   * @param {number} filters.minSpike1m   - minimum 1-min spike
   * @param {number} filters.minSpike5m   - minimum 5-min spike
   * @param {boolean} filters.consecutiveVol - only consecutive vol up
   * @param {boolean} filters.priceUpVolUp   - only price↑+vol↑
   * @param {boolean} filters.breakoutVol    - only breakout+vol
   * @param {boolean} filters.gapUpVol       - only gap up+vol
   * @param {boolean} filters.orBreakoutVol  - only OR breakout+vol
   * @param {string} filters.sector          - filter by sector
   * @param {string} filters.search          - search by symbol/name
   * @returns {Array}
   */
  getRanked(filters = {}) {
    const {
      minRvol = 0,
      minSpike1m = 0,
      minSpike5m = 0,
      consecutiveVol = false,
      priceUpVolUp = false,
      breakoutVol = false,
      gapUpVol = false,
      orBreakoutVol = false,
      sector = null,
      search = '',
    } = filters;

    let results = Object.values(this.metrics);

    // Apply filters
    if (minRvol > 0)      results = results.filter(m => m.rvol >= minRvol);
    if (minSpike1m > 0)   results = results.filter(m => m.spike1m >= minSpike1m);
    if (minSpike5m > 0)   results = results.filter(m => m.spike5m >= minSpike5m);
    if (consecutiveVol)   results = results.filter(m => m.consecutiveVol);
    if (priceUpVolUp)     results = results.filter(m => m.priceUpVolumeUp);
    if (breakoutVol)      results = results.filter(m => m.breakoutVolume);
    if (gapUpVol)         results = results.filter(m => m.gapUpVolume);
    if (orBreakoutVol)    results = results.filter(m => m.orBreakoutVolume);
    if (sector)           results = results.filter(m => m.sector === sector);
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(m =>
        m.symbol.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q)
      );
    }

    // Sort by composite score descending, then by RVOL descending
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.rvol - a.rvol;
    });

    return results;
  }

  /**
   * Get top N volume leaders
   */
  getTopLeaders(n = 10) {
    return this.getRanked().slice(0, n);
  }

  /**
   * Get current config
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update config thresholds
   */
  updateConfig(updates) {
    Object.assign(this.config, updates);
    return this.config;
  }

  // ─── Private helpers ───────────────────────────────────────────

  _calcTimeframeSpike(tf) {
    if (!tf || !tf.candles || tf.candles.length < 5) return 1.0;
    const candles = tf.candles;
    // Current candle volume
    const current = candles[candles.length - 1];
    const currentVol = current.volume || 0;
    if (currentVol <= 0) return 1.0;

    // Average of previous candles (exclude current)
    const prevCandles = candles.slice(-11, -1); // last 10 before current
    if (prevCandles.length === 0) return 1.0;
    const avgVol = prevCandles.reduce((a, c) => a + (c.volume || 0), 0) / prevCandles.length;
    return avgVol > 0 ? +(currentVol / avgVol).toFixed(2) : 1.0;
  }

  _checkConsecutiveVolIncrease(history, n = 3) {
    if (history.length < n) return false;
    const vols = history.slice(-n).map(c => c.volume || 0);
    for (let i = 1; i < vols.length; i++) {
      if (vols[i] <= vols[i - 1]) return false;
    }
    return true;
  }

  _checkORBreakout(stock, rvol, threshold) {
    // Opening range = first 5 candles of the day
    if (!stock.history || stock.history.length < 5) return false;
    const first5 = stock.history.slice(0, 5);
    const orHigh = Math.max(...first5.map(c => c.high));
    const currentPrice = stock.price;
    const breaksOR = currentPrice > orHigh;
    return breaksOR && rvol >= threshold;
  }
}

module.exports = new VolumeScannerService();
