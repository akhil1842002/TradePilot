const express = require('express');
const router = express.Router();
const volumeScannerService = require('../services/volumeScannerService');
const kiteService = require('../services/kiteService');

// Get current volume scanner config
router.get('/config', (req, res) => {
  res.json(volumeScannerService.getConfig());
});

// Update volume scanner config
router.post('/config', (req, res) => {
  const config = volumeScannerService.updateConfig(req.body);
  res.json({ message: 'Volume scanner config updated', config });
});

// Get ranked volume stocks with optional filters
router.get('/ranked', (req, res) => {
  const filters = {
    minRvol:      parseFloat(req.query.minRvol)      || 0,
    minSpike1m:   parseFloat(req.query.minSpike1m)   || 0,
    minSpike5m:   parseFloat(req.query.minSpike5m)   || 0,
    consecutiveVol: req.query.consecutiveVol === 'true',
    priceUpVolUp:   req.query.priceUpVolUp   === 'true',
    breakoutVol:    req.query.breakoutVol    === 'true',
    gapUpVol:       req.query.gapUpVol       === 'true',
    orBreakoutVol:  req.query.orBreakoutVol  === 'true',
    sector:         req.query.sector         || null,
    search:         req.query.search         || '',
  };
  const ranked = volumeScannerService.getRanked(filters);
  res.json(ranked);
});

// Get top N volume leaders (default 10)
router.get('/leaders', (req, res) => {
  const n = parseInt(req.query.n) || 10;
  const leaders = volumeScannerService.getTopLeaders(n);
  res.json(leaders);
});

// Snapshot: full volume scanner state (metrics for all stocks)
router.get('/snapshot', (req, res) => {
  const all = volumeScannerService.getRanked();
  const leaders = all.slice(0, 10);
  const summary = {
    totalTracked: all.length,
    highRvol: all.filter(m => m.rvol >= 2.0).length,
    spike1mCount: all.filter(m => m.spike1m >= 2.0).length,
    spike5mCount: all.filter(m => m.spike5m >= 2.0).length,
    consecutiveVolCount: all.filter(m => m.consecutiveVol).length,
    priceUpVolUpCount: all.filter(m => m.priceUpVolumeUp).length,
    leaders,
  };
  res.json({ all, summary });
});

module.exports = router;
