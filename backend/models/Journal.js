const mongoose = require('mongoose');

const JournalSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  type: { type: String, enum: ['BUY', 'SELL'], default: 'BUY' },
  entry: { type: Number, required: true },
  exit: { type: Number },
  profit: { type: Number, default: 0 },
  loss: { type: Number, default: 0 },
  screenshot: { type: String }, // Base64 data or URL
  reason: { type: String },
  emotion: { type: String }, // e.g. FOMO, Greed, Patience
  mistake: { type: String }, // e.g. Chasing Trend, Overleveraged
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Journal', JournalSchema);
