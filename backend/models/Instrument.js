const mongoose = require('mongoose');

const InstrumentSchema = new mongoose.Schema({
  instrument_token: { type: Number, required: true, index: true },
  exchange_token: { type: Number },
  tradingsymbol: { type: String, required: true, uppercase: true },
  name: { type: String },
  exchange: { type: String, default: 'NSE' },
  segment: { type: String },
  instrument_type: { type: String },
  tick_size: { type: Number, default: 0.05 },
  lot_size: { type: Number, default: 1 },
  strike: { type: Number, default: 0 },
  expiry: { type: String },
  last_price: { type: Number, default: 0 },
  // Enrichment fields (from our data, not Zerodha)
  sector: { type: String },
  industry: { type: String },
  mcap: { type: String, enum: ['Large Cap', 'Mid Cap', 'Small Cap', 'Unknown'], default: 'Unknown' },
  isin: { type: String },
  // Index memberships
  nifty50: { type: Boolean, default: false },
  niftynext50: { type: Boolean, default: false },
  banknifty: { type: Boolean, default: false },
  niftyit: { type: Boolean, default: false },
  niftyfmcg: { type: Boolean, default: false },
  niftypharma: { type: Boolean, default: false },
  niftymidcap: { type: Boolean, default: false },
  sensex: { type: Boolean, default: false },
  nifty500: { type: Boolean, default: false },
  // Timestamps
  lastRefreshed: { type: Date, default: Date.now }
});

// Compound index: instrument_token is unique per exchange
InstrumentSchema.index({ instrument_token: 1 }, { unique: true });
InstrumentSchema.index({ tradingsymbol: 1, exchange: 1 });
InstrumentSchema.index({ segment: 1 });
InstrumentSchema.index({ 'nifty50': 1 });
InstrumentSchema.index({ sector: 1 });

module.exports = mongoose.model('Instrument', InstrumentSchema);
