const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  type: { type: String, enum: ['BUY', 'SELL'], default: 'BUY' },
  entry: { type: Number, required: true },
  quantity: { type: Number, required: true },
  target: { type: Number, required: true },
  stoploss: { type: Number, required: true },
  currentPrice: { type: Number, default: 0 },
  currentProfit: { type: Number, default: 0 },
  holdingTime: { type: Number, default: 0 }, // in minutes
  recommendation: { type: String, default: 'HOLD' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trade', TradeSchema);
