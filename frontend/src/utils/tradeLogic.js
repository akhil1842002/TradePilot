/**
 * tradeLogic.js
 * ─────────────────────────────────────────────────────────────────────
 * Shared utilities for BUY (long) and SELL (short) trading modes.
 *
 * BUY mode  → uses backend recommendation directly (bullish signals)
 * SELL mode → re-evaluates same live indicators for short-sell opportunities
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Compute a SHORT recommendation from a live stock tick object.
 * The backend computes bullish indicators; we invert the logic here
 * to surface bearish / short-sell signals.
 *
 * @param {object} stock  - Live stock tick from kiteService
 * @returns {object}      - { action, confidence, risk, stopLoss, target1, target2, reasons }
 */
export function getShortRecommendation(stock) {
  if (!stock) return null;

  const reasons = [];
  let score = 0; // 0–100: higher = stronger SHORT signal

  // ── 1. Price vs VWAP ────────────────────────────────────────────
  if (stock.price < stock.vwap) {
    score += 20;
    reasons.push('Price below VWAP — bearish intraday bias');
  } else {
    score -= 10;
    reasons.push('Price above VWAP — weak short setup');
  }

  // ── 2. RSI overbought (short opportunity) ───────────────────────
  if (stock.rsi >= 75) {
    score += 20;
    reasons.push(`RSI ${stock.rsi} — severely overbought, reversal likely`);
  } else if (stock.rsi >= 65) {
    score += 10;
    reasons.push(`RSI ${stock.rsi} — overbought zone`);
  } else if (stock.rsi <= 30) {
    // Oversold bounce — exit short
    score -= 15;
    reasons.push(`RSI ${stock.rsi} — oversold, short exhausted`);
  }

  // ── 3. EMA bearish cross ─────────────────────────────────────────
  if (stock.ema20 < stock.ema50) {
    score += 15;
    reasons.push('EMA20 < EMA50 — bearish crossover confirmed');
  } else {
    score -= 5;
    reasons.push('EMA still bullish — counter-trend short, risky');
  }

  // ── 4. MACD negative histogram ───────────────────────────────────
  if (stock.macd && stock.macd.hist < 0) {
    score += 15;
    reasons.push('MACD histogram negative — downward momentum');
  } else if (stock.macd && stock.macd.hist > 0) {
    score -= 10;
    reasons.push('MACD positive — momentum against short');
  }

  // ── 5. ADX trend strength ────────────────────────────────────────
  if (stock.adx >= 25) {
    score += 10;
    reasons.push(`ADX ${stock.adx} — strong directional trend`);
  } else {
    reasons.push(`ADX ${stock.adx} — weak trend, choppy conditions`);
  }

  // ── 6. Day range position (near high = short entry) ─────────────
  const dayRange = stock.high - stock.low;
  if (dayRange > 0) {
    const positionInRange = (stock.price - stock.low) / dayRange;
    if (positionInRange >= 0.80) {
      score += 15;
      reasons.push('Price near day high — potential reversal zone');
    } else if (positionInRange <= 0.20) {
      score -= 10;
      reasons.push('Price near day low — poor short entry');
    }
  }

  // ── 7. Price vs Resistance (near resistance = good short) ────────
  if (stock.resistance && stock.price >= stock.resistance * 0.98) {
    score += 5;
    reasons.push('Near resistance level — supply zone');
  }

  // Clamp score 0–100
  score = Math.max(0, Math.min(100, score));

  // ── Map score to action ──────────────────────────────────────────
  let action;
  if (score >= 70) {
    action = 'SHORT';
  } else if (score >= 55) {
    action = 'HOLD SHORT';
  } else if (score >= 40) {
    action = 'WATCH SHORT';
  } else if (score >= 25) {
    action = 'COVER PROFIT';   // start covering short
  } else {
    action = 'COVER';          // exit short — bullish reversal likely
  }

  // ── Risk level ───────────────────────────────────────────────────
  const risk = score >= 70 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH';

  // ── Stop loss / targets for SHORT position ───────────────────────
  // Short: entry at current price; stop loss ABOVE price; targets BELOW price
  const stopLoss = Number((stock.price * 1.015).toFixed(2));   // 1.5% above entry
  const target1  = Number((stock.price * 0.985).toFixed(2));   // 1.5% below entry
  const target2  = Number((stock.price * 0.970).toFixed(2));   // 3% below entry

  return {
    action,
    confidence: score,
    risk,
    stopLoss,
    target1,
    target2,
    reasons: reasons.slice(0, 5)  // top 5 reasons
  };
}

/**
 * Returns the display config (colors, label, emoji) for any action string.
 */
export function getActionStyle(action) {
  const map = {
    // Long actions
    'BUY':          { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: '#22C55E', emoji: '🟢', label: 'BUY' },
    'HOLD':         { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: '#3B82F6', emoji: '🔵', label: 'HOLD' },
    'WATCH':        { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: '#8B5CF6', emoji: '🟣', label: 'WATCH' },
    'BOOK PROFIT':  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: '#F59E0B', emoji: '🟠', label: 'BOOK PROFIT' },
    'EXIT':         { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: '#EF4444', emoji: '🔴', label: 'EXIT' },
    'IGNORE':       { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: '#6B7280', emoji: '⚪', label: 'IGNORE' },
    // Short actions
    'SHORT':        { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: '#EF4444', emoji: '🔻', label: 'SHORT' },
    'HOLD SHORT':   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: '#F59E0B', emoji: '🟠', label: 'HOLD SHORT' },
    'WATCH SHORT':  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: '#8B5CF6', emoji: '🟣', label: 'WATCH SHORT' },
    'COVER PROFIT': { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: '#22C55E', emoji: '🟢', label: 'COVER PROFIT' },
    'COVER':        { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: '#3B82F6', emoji: '🔵', label: 'COVER' },
  };
  return map[action] || map['IGNORE'];
}

/**
 * Returns the effective recommendation for a stock based on current trade mode.
 */
export function getEffectiveRec(stock, tradeMode) {
  if (tradeMode === 'SELL') {
    return getShortRecommendation(stock);
  }
  return stock.recommendation;
}
