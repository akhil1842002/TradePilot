const mongoose = require('mongoose');

const WatchlistSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  stocks: { type: [String], default: [] }
});

module.exports = mongoose.model('Watchlist', WatchlistSchema);
