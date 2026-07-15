const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');

// Get all journal logs
router.get('/', async (req, res) => {
  try {
    const journal = await storageService.getJournal();
    res.json(journal);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving journal', error: error.message });
  }
});

// Save a new journal entry
router.post('/', async (req, res) => {
  try {
    const { symbol, type, entry, exit, profit, loss, screenshot, reason, emotion, mistake, notes } = req.body;
    if (!symbol || !entry) {
      return res.status(400).json({ message: 'Symbol and Entry price are required' });
    }

    const journalEntry = await storageService.addJournalEntry({
      symbol: symbol.toUpperCase(),
      type: type || 'BUY',
      entry: Number(entry),
      exit: exit ? Number(exit) : undefined,
      profit: Number(profit) || 0,
      loss: Number(loss) || 0,
      screenshot: screenshot || '',
      reason: reason || '',
      emotion: emotion || '',
      mistake: mistake || '',
      notes: notes || ''
    });

    res.status(201).json(journalEntry);
  } catch (error) {
    res.status(500).json({ message: 'Error creating journal entry', error: error.message });
  }
});

module.exports = router;
