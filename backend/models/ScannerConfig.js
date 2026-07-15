const mongoose = require('mongoose');

const ScannerConfigSchema = new mongoose.Schema({
  vwap: { type: Boolean, default: true },
  ema20: { type: Boolean, default: true },
  ema50: { type: Boolean, default: true },
  rsi: { type: Boolean, default: true },
  macd: { type: Boolean, default: true },
  adx: { type: Boolean, default: true },
  volumeSpike: { type: Boolean, default: true },
  breakout: { type: Boolean, default: true },
  support: { type: Boolean, default: true },
  resistance: { type: Boolean, default: true },
  relativeStrength: { type: Boolean, default: true },
  sectorStrength: { type: Boolean, default: true },
  marketBreadth: { type: Boolean, default: true }
});

module.exports = mongoose.model('ScannerConfig', ScannerConfigSchema);
