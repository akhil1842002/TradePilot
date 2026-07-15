const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');

// GET /api/favorites — get current favorites list
router.get('/', async (req, res) => {
  try {
    const favorites = await storageService.getFavorites();
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching favorites', error: error.message });
  }
});

// POST /api/favorites — save favorites list (full replace)
router.post('/', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!Array.isArray(symbols)) {
      return res.status(400).json({ message: 'symbols must be an array' });
    }
    await storageService.saveFavorites(symbols);
    res.json({ success: true, count: symbols.length });
  } catch (error) {
    res.status(500).json({ message: 'Error saving favorites', error: error.message });
  }
});

module.exports = router;
