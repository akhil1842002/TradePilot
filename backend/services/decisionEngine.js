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
      risk
    };
  }
}

module.exports = new DecisionEngine();
