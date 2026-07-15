const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const kiteService = require('../services/kiteService');

// Get all open trades
router.get('/', async (req, res) => {
  try {
    const trades = await storageService.getTrades();
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving trades', error: error.message });
  }
});

// Record a new manual buy/sell order entry
router.post('/', async (req, res) => {
  try {
    const { symbol, entry, quantity, target, stoploss, type } = req.body;
    if (!symbol || !entry || !quantity || !target || !stoploss) {
      return res.status(400).json({ message: 'Missing required trade details' });
    }

    const trade = await storageService.addTrade({
      symbol: symbol.toUpperCase(),
      type: type || 'BUY',
      entry: Number(entry),
      quantity: Number(quantity),
      target: Number(target),
      stoploss: Number(stoploss),
      currentPrice: Number(entry),
      currentProfit: 0,
      holdingTime: 0,
      recommendation: 'HOLD'
    });

    res.status(201).json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Error recording trade', error: error.message });
  }
});

// Delete/Close a trade (Exit manual position)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { exitPrice, reason, emotion, mistake, notes } = req.query;

    const trade = await storageService.deleteTrade(id);
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    // If exit details are provided, automatically write this trade to the Trade Journal!
    if (exitPrice) {
      const isShort = trade.type === 'SELL';
      const pnl = isShort
        ? (trade.entry - Number(exitPrice)) * trade.quantity
        : (Number(exitPrice) - trade.entry) * trade.quantity;
      const profit = pnl > 0 ? pnl : 0;
      const loss = pnl < 0 ? -pnl : 0;

      await storageService.addJournalEntry({
        symbol: trade.symbol,
        type: isShort ? 'SELL' : 'BUY',
        entry: trade.entry,
        exit: Number(exitPrice),
        profit,
        loss,
        reason: reason || 'Target/Stoploss hit',
        emotion: emotion || 'Neutral',
        mistake: mistake || 'None',
        notes: notes || `Auto-archived from open trades. Quantity: ${trade.quantity}. Position type: ${trade.type}`
      });
    }

    res.json({ message: 'Trade exited successfully', trade });
  } catch (error) {
    res.status(500).json({ message: 'Error exiting trade', error: error.message });
  }
});

// Sync live positions and holdings from Zerodha Kite Connect API
router.post('/sync-kite', async (req, res) => {
  try {
    const result = await kiteService.syncKitePositions(storageService);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error syncing from Kite Connect', error: error.message });
  }
});

module.exports = router;
