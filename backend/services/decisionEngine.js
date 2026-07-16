class DecisionEngine {
  evaluate(stock, marketTrend, sectorChange, config = {}, source = 'SIM') {
    const reasons = [];
    let score = 50; // Neutral starting score
    let maxBullishScore = 50;
    let maxBearishScore = 50;

    // 1. VWAP
    if (config.vwap !== false) {
      maxBullishScore += 10;
      maxBearishScore += 10;
      if (stock.price > stock.vwap) {
        score += 10;
        reasons.push('Price Above VWAP');
      } else {
        score -= 10;
        reasons.push('Lost VWAP');
      }
    }

    // 2. EMA Cross (EMA20 vs EMA50)
    if (config.ema20 !== false && config.ema50 !== false) {
      maxBullishScore += 15;
      maxBearishScore += 15;
      const diff = stock.ema20 - stock.ema50;
      if (Math.abs(diff) < stock.price * 0.001) {
        reasons.push('EMA20 ≈ EMA50 (Flat)');
      } else if (stock.ema20 > stock.ema50) {
        score += 15;
        reasons.push('EMA20 > EMA50');
      } else {
        score -= 15;
        reasons.push('EMA20 < EMA50');
      }
    }

    // 3. RSI
    if (config.rsi !== false) {
      maxBullishScore += 15;
      maxBearishScore += 15;
      if (stock.rsi >= 60) {
        score += 15;
        reasons.push('RSI 60+ (Strong Momentum)');
      } else if (stock.rsi <= 40) {
        score -= 15;
        reasons.push('RSI Falling / Oversold');
      } else {
        reasons.push('RSI Stable (Mid-range)');
      }
    }

    // 4. MACD
    if (config.macd !== false) {
      maxBullishScore += 10;
      maxBearishScore += 10;
      if (stock.macd && stock.macd.macd > stock.macd.signal) {
        score += 10;
        reasons.push('MACD Bullish Cross');
      } else if (stock.macd && stock.macd.macd < stock.macd.signal) {
        score -= 10;
        reasons.push('MACD Bearish Crossover');
      } else {
        reasons.push('MACD Flat');
      }
    }

    // 5. ADX (Trend Strength)
    if (config.adx !== false) {
      maxBullishScore += 10;
      if (stock.adx > 25) {
        score += 10;
        reasons.push(`Strong Trend (ADX: ${Math.round(stock.adx)})`);
      } else if (stock.adx < 20) {
        score -= 5;
        reasons.push('Weak Trend / Sideways');
      }
    }

    // 6. Volume Spike
    if (config.volumeSpike !== false) {
      const recentCandles = stock.history.slice(-10);
      const avgVol = recentCandles.reduce((a, b) => a + b.volume, 0) / recentCandles.length;
      const currentVol = stock.history[stock.history.length - 1]?.volume || 0;
      
      if (currentVol > avgVol * 1.8) {
        maxBullishScore += 10;
        if (stock.price > stock.history[stock.history.length - 2]?.close) {
          score += 10;
          reasons.push('Volume Spike (Buying Pressure)');
        } else {
          score -= 10;
          reasons.push('Heavy Selling / High Volume');
        }
      }
    }

    // 7. Breakout (Near High/Resistance)
    if (config.breakout !== false && config.resistance !== false) {
      const nearResistance = stock.resistance - stock.price < stock.price * 0.005;
      if (nearResistance) {
        maxBullishScore += 15;
        if (stock.price >= stock.resistance) {
          score += 15;
          reasons.push('Resistance Breakout');
        } else {
          reasons.push('Near Resistance (Potential Pullback)');
        }
      }
    }

    // 8. Sector Strength
    if (config.sectorStrength !== false) {
      maxBullishScore += 15;
      maxBearishScore += 10;
      if (sectorChange > 0.4) {
        score += 15;
        reasons.push(`Strong Sector (${stock.sector})`);
      } else if (sectorChange < -0.4) {
        score -= 10;
        reasons.push(`Weak Sector (${stock.sector})`);
      }
    }

    // 9. Market Breadth / Trend
    if (config.marketBreadth !== false) {
      maxBullishScore += 10;
      maxBearishScore += 10;
      if (marketTrend === 'Bullish') {
        score += 10;
        reasons.push('Market Bullish');
      } else if (marketTrend === 'Bearish') {
        score -= 10;
        reasons.push('Weak Market');
      }
    }

    // 10. Unusual Price Movement (bonus/penalty)
    const unusualMove = this.detectUnusualMovement(stock);
    if (config.unusualMove !== false && unusualMove && unusualMove.stars >= 2) {
      maxBullishScore += 15;
      maxBearishScore += 15;
      if (unusualMove.type === 'SURGE') {
        score += 15;
        reasons.push(`🚀 Unusual Surge: ${unusualMove.changePct >= 0 ? '+' : ''}${unusualMove.changePct}% (ATR ${unusualMove.atrRatio}×)`);
      } else {
        score -= 15;
        reasons.push(`🔻 Unusual Drop: ${unusualMove.changePct}% (ATR ${unusualMove.atrRatio}×)`);
      }
      if (unusualMove.volumeRatio >= 3) {
        reasons.push(`Vol ${unusualMove.volumeRatio}× avg confirms move`);
      }
    }

    // Normalize score to percentage 0 - 100
    // If score is high, it scales to maxBullish. If low, it scales to maxBearish.
    let confidence = 50;
    let action = 'HOLD';

    if (score >= 50) {
      const range = maxBullishScore - 50;
      const pct = range > 0 ? (score - 50) / range : 0;
      confidence = Math.round(50 + pct * 50);
    } else {
      const range = 50 - (50 - maxBearishScore); // range below 50
      const pct = range > 0 ? (50 - score) / range : 0;
      confidence = Math.round(50 + pct * 50);
    }

    // Bounds check
    confidence = Math.max(50, Math.min(98, confidence));

    // Determine Action
    if (score >= 75) {
      action = 'BUY';
    } else if (score >= 60) {
      action = 'HOLD';
    } else if (score >= 45) {
      action = 'WATCH';
    } else if (score >= 35) {
      // Check if near resistance with falling volume for BOOK PROFIT
      const nearResistance = stock.resistance - stock.price < stock.price * 0.008;
      if (nearResistance) {
        action = 'BOOK PROFIT';
        reasons.push('Near Resistance / Momentum Weakening');
      } else {
        action = 'IGNORE';
        reasons.push('Low Volume / Sideways');
      }
    } else {
      action = 'EXIT';
    }

    // Stop Loss & Target calculations (intraday basis)
    const sl = Number((stock.price * 0.985).toFixed(2));
    const t1 = Number((stock.price * 1.015).toFixed(2));
    const t2 = Number((stock.price * 1.03).toFixed(2));
    const risk = confidence > 85 ? 'LOW' : (confidence > 70 ? 'MEDIUM' : 'HIGH');

    // Terminal Logging Style Output for Console
    const terminalEmoji = action === 'BUY' ? '🟢' : (action === 'EXIT' ? '🔴' : (action === 'BOOK PROFIT' ? '🟠' : '🔵'));
    const sourceLabel = source === 'LIVE-WS' ? '🔗 LIVE WebSocket' : (source === 'LIVE-REST' ? '📡 LIVE REST' : '🖥️ SIMULATED');
    console.log(`[${sourceLabel}]\n========================\nMARKET: ${marketTrend === 'Bullish' ? '🟢 Bullish' : (marketTrend === 'Bearish' ? '🔴 Bearish' : '🟡 Sideways')}\nSECTOR: ★★★★★ ${stock.sector}\nSTOCK: ${stock.symbol}\nENTRY: ₹${stock.price}\nCONFIDENCE: ${confidence}%\nACTION: ${terminalEmoji} ${action}\nSTOP LOSS: ₹${sl}\nTARGET 1: ₹${t1}\nTARGET 2: ₹${t2}\nRISK: ${risk}\n========================`);

    return {
      action,
      confidence,
      reasons: reasons.slice(0, 5), // return top 5 reasons
      stopLoss: sl,
      target1: t1,
      target2: t2,
      risk,
      unusualMove
    };
  }

  /**
   * Multi-factor Opportunity Score — detects genuinely unusual moves.
   *
   * Combines 4 metrics into a single 0–100 score:
   *   40%  Price % Change (vs previous close)
   *   25%  Volume Spike   (current vs avg volume)
   *   20%  ATR Ratio      (move size vs normal daily range)
   *   15%  Intraday Momentum (move from open)
   *
   * @param {object} stock - Live stock object with .history array
   * @returns {object|null} - { type, changePct, atrRatio, volumeRatio, intradayPct, opportunityScore, stars, reason }
   */
  detectUnusualMovement(stock) {
    const history = stock.history;
    if (!history || history.length < 30) return null;

    const now = history[history.length - 1];
    const currentPrice = now.close;
    const prevClose = stock.previousClose || stock.close; // yesterday's close

    // Need at least a previous close to compare
    if (!prevClose || prevClose <= 0) return null;

    // ── 1. Price Change % (vs previous close) ─────────────────────
    const changePct = ((currentPrice - prevClose) / prevClose) * 100;
    const absChangePct = Math.abs(changePct);
    const isSurge = changePct > 0;

    // If barely moved (less than 0.05%), skip — not meaningful
    if (absChangePct < 0.05) return null;

    // ── 2. ATR Ratio — how big is this move vs normal daily range? ─
    // Calculate ATR from recent candles (last 14 periods)
    const atrPeriod = 14;
    const trueRanges = [];
    for (let i = Math.max(1, history.length - atrPeriod); i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      if (tr > 0) trueRanges.push(tr);
    }
    const atr = trueRanges.length > 0
      ? trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length
      : (stock.high - stock.low) || currentPrice * 0.01;

    // Current move magnitude in rupees
    const moveRupees = Math.abs(currentPrice - prevClose);
    const atrRatio = atr > 0 ? moveRupees / atr : 1;

    // ── 3. Volume Ratio ───────────────────────────────────────────
    const recentCandles = history.slice(-20);
    const avgVol = recentCandles.reduce((a, b) => a + (b.volume || 0), 0) / recentCandles.length;
    const currentVol = now.volume || stock.volume || 0;
    const volumeRatio = avgVol > 0 ? currentVol / avgVol : 1;

    // ── 4. Intraday Momentum % (from today's open) ────────────────
    const openPrice = stock.open;
    const intradayPct = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;

    // ── 5. Opportunity Score (0–100) ──────────────────────────────
    // Each factor contributes a sub-score, then weighted average

    // Factor 1: Price % Change (40% weight)
    // Score based on how many multiples of "typical daily %" this move is
    // Typical daily % ≈ ATR / price * 100
    const typicalDailyPct = (atr / currentPrice) * 100;
    const pctMultiplier = typicalDailyPct > 0 ? absChangePct / typicalDailyPct : 1;
    let priceScore = Math.min(100, (pctMultiplier / 3) * 100); // 3× ATR = 100 score

    // Factor 2: Volume Spike (25% weight)
    let volumeScore = Math.min(100, ((volumeRatio - 1) / 3) * 100); // 4× avg = 100 score
    if (volumeRatio <= 1) volumeScore = 0;

    // Factor 3: ATR Ratio (20% weight)
    let atrScore = Math.min(100, (atrRatio / 2.5) * 100); // 2.5× ATR = 100 score

    // Factor 4: Intraday Momentum (15% weight)
    const absIntraday = Math.abs(intradayPct);
    let intradayScore = typicalDailyPct > 0
      ? Math.min(100, (absIntraday / typicalDailyPct) * 100)
      : Math.min(100, (absIntraday / 0.5) * 100);

    const opportunityScore = Math.round(
      priceScore * 0.40 +
      volumeScore * 0.25 +
      atrScore * 0.20 +
      intradayScore * 0.15
    );

    // Only flag meaningful opportunities
    if (opportunityScore < 25) return null;

    // ── 6. Star rating from opportunity score ─────────────────────
    let stars = 1;
    if (opportunityScore >= 85) stars = 5;
    else if (opportunityScore >= 70) stars = 4;
    else if (opportunityScore >= 55) stars = 3;
    else if (opportunityScore >= 40) stars = 2;

    // ── 7. Build alert label ──────────────────────────────────────
    const type = isSurge ? 'SURGE' : 'DROP';
    const emoji = isSurge ? '🚀' : '🔻';

    let label = 'Normal';
    if (opportunityScore >= 80) label = '🚀 Unexpected';
    else if (opportunityScore >= 60) label = '🔥 Strong';
    else if (opportunityScore >= 40) label = '⚡ Noticeable';
    else if (opportunityScore >= 25) label = '📊 Minor';

    // Build detailed reason string
    const sign = changePct >= 0 ? '+' : '';
    let reason = `${emoji} ${label} Move: ${sign}${changePct.toFixed(2)}%`;
    const details = [];
    if (volumeRatio >= 1.5) details.push(`Vol ${volumeRatio.toFixed(1)}×`);
    if (atrRatio >= 1.5) details.push(`ATR ${atrRatio.toFixed(1)}×`);
    if (Math.abs(intradayPct) >= 0.5) details.push(`Intraday ${intradayPct >= 0 ? '+' : ''}${intradayPct.toFixed(2)}%`);
    if (details.length > 0) reason += ` — ${details.join(' | ')}`;

    return {
      type,
      changePct: Number(changePct.toFixed(2)),
      atrRatio: Number(atrRatio.toFixed(1)),
      volumeRatio: Number(volumeRatio.toFixed(1)),
      intradayPct: Number(intradayPct.toFixed(2)),
      opportunityScore,
      stars,
      label,
      reason,
      emoji,
      // Raw values for UI display
      moveRupees: Number(moveRupees.toFixed(2)),
      typicalDailyPct: Number(typicalDailyPct.toFixed(2)),
      atr: Number(atr.toFixed(2))
    };
  }
}

module.exports = new DecisionEngine();
