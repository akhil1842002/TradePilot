const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const kiteService = require('../services/kiteService');

// Get all watchlists
router.get('/', async (req, res) => {
  try {
    const watchlists = await storageService.getWatchlists();
    res.json(watchlists);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving watchlists', error: error.message });
  }
});

// Get all available tracked stocks with live prices (for autocomplete / dynamic list)
router.get('/available', (req, res) => {
  const stocks = Object.values(kiteService.stocks).map(s => ({
    symbol: s.symbol,
    name: s.name,
    price: s.price,
    sector: s.sector,
    recommendation: s.recommendation?.action || 'HOLD'
  }));
  res.json(stocks);
});

// Sync watchlist with live Zerodha positions
router.post('/sync', async (req, res) => {
  try {
    const { watchlistName } = req.body;
    const name = watchlistName || 'Intraday';
    
    // Get tracked stock symbols (from Zerodha positions + defaults)
    const symbols = Object.keys(kiteService.stocks);
    
    // Save to watchlist
    const updated = await storageService.saveWatchlist(name, symbols);
    res.json({ message: `Synced ${symbols.length} stocks to "${name}"`, watchlist: updated, count: symbols.length });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing watchlist', error: error.message });
  }
});

// Update watchlists
router.post('/', async (req, res) => {
  try {
    const { name, stocks } = req.body;
    if (!name || !Array.isArray(stocks)) {
      return res.status(400).json({ message: 'Name and stocks list are required' });
    }

    const updated = await storageService.saveWatchlist(name, stocks.map(s => s.toUpperCase()));
    res.json({ message: 'Watchlist updated successfully', watchlist: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating watchlist', error: error.message });
  }
});

module.exports = router;
