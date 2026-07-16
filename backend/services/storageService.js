const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Models
const Trade = require('../models/Trade');
const Journal = require('../models/Journal');
const Watchlist = require('../models/Watchlist');
const ScannerConfig = require('../models/ScannerConfig');

const DATA_DIR = path.join(__dirname, '../data');

// Helper to ensure data directory exists and returns path to a file
const getFilePath = (fileName) => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }
  return filePath;
};

// Check if MongoDB is connected
const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

// --- FILE STORAGE IMPLEMENTATIONS ---
const readJsonFile = (fileName) => {
  const p = getFilePath(fileName);
  try {
    const data = fs.readFileSync(p, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
};

const writeJsonFile = (fileName, data) => {
  const p = getFilePath(fileName);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
};

// Default configs
const DEFAULT_SCANNER_CONFIG = {
  vwap: true,
  ema20: true,
  ema50: true,
  rsi: true,
  macd: true,
  adx: true,
  volumeSpike: true,
  breakout: true,
  support: true,
  resistance: true,
  relativeStrength: true,
  sectorStrength: true,
  marketBreadth: true
};

const DEFAULT_WATCHLISTS = [
  { name: 'Intraday', stocks: ['BEL', 'RELIANCE', 'TCS', 'INFY'] },
  { name: 'Swing', stocks: ['HDFCBANK', 'ICICIBANK', 'SBIN'] },
  { name: 'Defence', stocks: ['BEL', 'HAL', 'BDL'] },
  { name: 'Bank', stocks: ['HDFCBANK', 'ICICIBANK', 'SBIN', 'AXISBANK', 'KOTAKBANK'] },
  { name: 'IT', stocks: ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM'] },
  { name: 'Custom', stocks: [] }
];

const storageService = {
  // --- TRADES ---
  async getTrades() {
    if (isMongoConnected()) {
      return await Trade.find({});
    } else {
      return readJsonFile('trades.json');
    }
  },

  async addTrade(data) {
    if (isMongoConnected()) {
      const trade = new Trade(data);
      return await trade.save();
    } else {
      const trades = readJsonFile('trades.json');
      const newTrade = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...data,
        currentPrice: data.currentPrice || 0,
        currentProfit: data.currentProfit || 0,
        holdingTime: data.holdingTime || 0,
        recommendation: data.recommendation || 'HOLD',
        createdAt: new Date().toISOString()
      };
      trades.push(newTrade);
      writeJsonFile('trades.json', trades);
      return newTrade;
    }
  },

  async updateTrade(id, data) {
    if (isMongoConnected()) {
      return await Trade.findByIdAndUpdate(id, data, { new: true });
    } else {
      const trades = readJsonFile('trades.json');
      const index = trades.findIndex(t => t._id === id || t.id === id);
      if (index !== -1) {
        trades[index] = { ...trades[index], ...data };
        writeJsonFile('trades.json', trades);
        return trades[index];
      }
      return null;
    }
  },

  async deleteTrade(id) {
    if (isMongoConnected()) {
      return await Trade.findByIdAndDelete(id);
    } else {
      const trades = readJsonFile('trades.json');
      const index = trades.findIndex(t => t._id === id || t.id === id);
      if (index !== -1) {
        const deleted = trades.splice(index, 1);
        writeJsonFile('trades.json', trades);
        return deleted[0];
      }
      return null;
    }
  },

  // --- JOURNAL ---
  async getJournal() {
    if (isMongoConnected()) {
      return await Journal.find({}).sort({ createdAt: -1 });
    } else {
      const journal = readJsonFile('journal.json');
      return journal.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  async addJournalEntry(data) {
    if (isMongoConnected()) {
      const journal = new Journal(data);
      return await journal.save();
    } else {
      const journal = readJsonFile('journal.json');
      const newEntry = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...data,
        createdAt: new Date().toISOString()
      };
      journal.push(newEntry);
      writeJsonFile('journal.json', journal);
      return newEntry;
    }
  },

  async deleteJournalEntry(id) {
    if (isMongoConnected()) {
      const deleted = await Journal.findByIdAndDelete(id);
      return deleted;
    } else {
      const journal = readJsonFile('journal.json');
      const idx = journal.findIndex(e => e._id === id || e.id === id);
      if (idx === -1) return null;
      const removed = journal.splice(idx, 1)[0];
      writeJsonFile('journal.json', journal);
      return removed;
    }
  },

  // --- WATCHLISTS ---
  async getWatchlists() {
    if (isMongoConnected()) {
      let lists = await Watchlist.find({});
      if (lists.length === 0) {
        for (const wl of DEFAULT_WATCHLISTS) {
          const w = new Watchlist(wl);
          await w.save();
        }
        lists = await Watchlist.find({});
      }
      return lists;
    } else {
      const p = getFilePath('watchlists.json');
      let lists = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (lists.length === 0) {
        lists = DEFAULT_WATCHLISTS.map(wl => ({ _id: new mongoose.Types.ObjectId().toString(), ...wl }));
        writeJsonFile('watchlists.json', lists);
      }
      return lists;
    }
  },

  async saveWatchlist(name, stocks) {
    if (isMongoConnected()) {
      return await Watchlist.findOneAndUpdate(
        { name },
        { name, stocks },
        { new: true, upsert: true }
      );
    } else {
      const lists = this.getWatchlists(); // read or default
      const listsArray = Array.isArray(lists) ? lists : [];
      const index = listsArray.findIndex(l => l.name.toLowerCase() === name.toLowerCase());
      if (index !== -1) {
        listsArray[index].stocks = stocks;
      } else {
        listsArray.push({
          _id: new mongoose.Types.ObjectId().toString(),
          name,
          stocks
        });
      }
      writeJsonFile('watchlists.json', listsArray);
      return { name, stocks };
    }
  },

  // --- SCANNER CONFIG ---
  async getScannerConfig() {
    if (isMongoConnected()) {
      let config = await ScannerConfig.findOne({});
      if (!config) {
        config = new ScannerConfig(DEFAULT_SCANNER_CONFIG);
        await config.save();
      }
      return config;
    } else {
      const p = getFilePath('scannerConfig.json');
      let data = fs.readFileSync(p, 'utf8');
      let config = JSON.parse(data);
      if (Array.isArray(config) || Object.keys(config).length === 0) {
        config = { _id: new mongoose.Types.ObjectId().toString(), ...DEFAULT_SCANNER_CONFIG };
        fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8');
      }
      return config;
    }
  },

  async saveScannerConfig(data) {
    if (isMongoConnected()) {
      let config = await ScannerConfig.findOne({});
      if (!config) {
        config = new ScannerConfig(data);
      } else {
        Object.assign(config, data);
      }
      return await config.save();
    } else {
      const p = getFilePath('scannerConfig.json');
      let current = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(current)) current = {};
      const updated = { ...current, ...data };
      fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8');
      return updated;
    }
  },

  // --- FAVORITES ---
  async getFavorites() {
    const p = getFilePath('favorites.json');
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async saveFavorites(symbols) {
    const p = getFilePath('favorites.json');
    fs.writeFileSync(p, JSON.stringify(symbols, null, 2), 'utf8');
    return symbols;
  }
};

module.exports = storageService;
