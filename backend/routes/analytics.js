const express = require('express');
const router = express.Router();
const storageService = require('../services/storageService');
const stockMaster = require('../services/stockMaster');

// Map stock symbol to its sector (from stock master)
const SYMBOL_SECTORS = stockMaster.getSectorMap();

router.get('/', async (req, res) => {
  try {
    const journal = await storageService.getJournal();

    // Filter closed trades (trades with exit prices and timestamp)
    const closedTrades = journal.filter(t => t.exit !== undefined && t.exit !== null);

    if (closedTrades.length === 0) {
      return res.json({
        totalTrades: 0,
        todaysProfit: 0,
        weeklyProfit: 0,
        monthlyProfit: 0,
        winRate: 0,
        lossRate: 0,
        avgProfit: 0,
        avgLoss: 0,
        bestStrategy: 'N/A',
        worstStrategy: 'N/A',
        bestTime: 'N/A',
        worstTime: 'N/A',
        bestSector: 'N/A',
        worstSector: 'N/A'
      });
    }

    let profitCount = 0;
    let lossCount = 0;
    let totalProfitVal = 0;
    let totalLossVal = 0;

    let todaysProfit = 0;
    let weeklyProfit = 0;
    let monthlyProfit = 0;

    const sectorStats = {};
    const strategyStats = {};
    const hourStats = {};

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    closedTrades.forEach(trade => {
      const pnl = trade.profit - trade.loss;
      const tradeDate = new Date(trade.createdAt);
      const diffMs = now - tradeDate;

      // Period PnL
      if (diffMs <= oneDay) todaysProfit += pnl;
      if (diffMs <= oneWeek) weeklyProfit += pnl;
      if (diffMs <= oneMonth) monthlyProfit += pnl;

      // Win/Loss counting
      if (pnl > 0) {
        profitCount++;
        totalProfitVal += pnl;
      } else {
        lossCount++;
        totalLossVal += Math.abs(pnl);
      }

      // Sector calculation
      const sector = SYMBOL_SECTORS[trade.symbol] || 'Other';
      if (!sectorStats[sector]) sectorStats[sector] = 0;
      sectorStats[sector] += pnl;

      // Strategy (Reason) calculation
      const strategy = trade.reason || 'General';
      if (!strategyStats[strategy]) strategyStats[strategy] = 0;
      strategyStats[strategy] += pnl;

      // Time calculation (by hour)
      const hour = tradeDate.getHours();
      const hourKey = `${hour}:00 - ${hour + 1}:00`;
      if (!hourStats[hourKey]) hourStats[hourKey] = 0;
      hourStats[hourKey] += pnl;
    });

    const totalTrades = closedTrades.length;
    const winRate = Number(((profitCount / totalTrades) * 100).toFixed(1));
    const lossRate = Number(((lossCount / totalTrades) * 100).toFixed(1));
    const avgProfit = profitCount > 0 ? Number((totalProfitVal / profitCount).toFixed(2)) : 0;
    const avgLoss = lossCount > 0 ? Number((totalLossVal / lossCount).toFixed(2)) : 0;

    // Determine Best & Worst Sectors
    let bestSector = 'N/A';
    let worstSector = 'N/A';
    let maxSectorProfit = -Infinity;
    let minSectorProfit = Infinity;

    Object.keys(sectorStats).forEach(sec => {
      const pnl = sectorStats[sec];
      if (pnl > maxSectorProfit) {
        maxSectorProfit = pnl;
        bestSector = sec;
      }
      if (pnl < minSectorProfit) {
        minSectorProfit = pnl;
        worstSector = sec;
      }
    });

    // Determine Best & Worst Strategies
    let bestStrategy = 'N/A';
    let worstStrategy = 'N/A';
    let maxStratProfit = -Infinity;
    let minStratProfit = Infinity;

    Object.keys(strategyStats).forEach(strat => {
      const pnl = strategyStats[strat];
      if (pnl > maxStratProfit) {
        maxStratProfit = pnl;
        bestStrategy = strat;
      }
      if (pnl < minStratProfit) {
        minStratProfit = pnl;
        worstStrategy = strat;
      }
    });

    // Determine Best & Worst Times
    let bestTime = 'N/A';
    let worstTime = 'N/A';
    let maxTimeProfit = -Infinity;
    let minTimeProfit = Infinity;

    Object.keys(hourStats).forEach(hr => {
      const pnl = hourStats[hr];
      if (pnl > maxTimeProfit) {
        maxTimeProfit = pnl;
        bestTime = hr;
      }
      if (pnl < minTimeProfit) {
        minTimeProfit = pnl;
        worstTime = hr;
      }
    });

    res.json({
      totalTrades,
      todaysProfit: Number(todaysProfit.toFixed(2)),
      weeklyProfit: Number(weeklyProfit.toFixed(2)),
      monthlyProfit: Number(monthlyProfit.toFixed(2)),
      winRate,
      lossRate,
      avgProfit,
      avgLoss,
      bestStrategy,
      worstStrategy,
      bestTime,
      worstTime,
      bestSector,
      worstSector
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving analytics', error: error.message });
  }
});

module.exports = router;
