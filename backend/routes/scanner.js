const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const kiteService = require('../services/kiteService');

// Get scanner active indicators config
router.get('/config', async (req, res) => {
  try {
    const config = await storageService.getScannerConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching scanner config', error: error.message });
  }
});

// Update scanner config
router.post('/config', async (req, res) => {
  try {
    const config = await storageService.saveScannerConfig(req.body);
    res.json({ message: 'Scanner settings updated successfully', config });
  } catch (error) {
    res.status(500).json({ message: 'Error updating scanner config', error: error.message });
  }
});

// Get NIFTY index constituent stocks
router.get('/index/:name', (req, res) => {
  try {
    const { getIndexStocks } = require('../config/indices');
    const stocks = getIndexStocks(req.params.name);
    if (stocks.length === 0) {
      return res.status(404).json({ message: `Index '${req.params.name}' not found. Try NIFTY50, NIFTYNEXT50, or NIFTY100.` });
    }
    res.json({ index: req.params.name.toUpperCase(), count: stocks.length, stocks });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

// Get historical stock candles for TradingView Lightweight Charts
router.get('/candles/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const history = kiteService.getHistory(symbol.toUpperCase());
    
    // TradingView lightweight charts format: { time: 'YYYY-MM-DD', open, high, low, close, volume }
    const tvFormat = history.map(h => {
      // Convert ISO timestamp to epoch seconds or string
      const epochSeconds = Math.floor(new Date(h.time).getTime() / 1000);
      return {
        time: epochSeconds,
        open: h.open,
        high: h.high,
        low: s = h.low,
        close: h.close,
        volume: h.volume
      };
    });

    res.json(tvFormat);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching historical data', error: error.message });
  }
});

module.exports = router;
