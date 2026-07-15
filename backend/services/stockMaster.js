/**
 * Stock Master Service
 * Primary: MongoDB Instrument collection (populated by instrumentService from Zerodha)
 * Fallback: stock_master.json (125 pre-configured stocks)
 *
 * All lookups automatically use the best available source.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const MASTER_PATH = path.join(__dirname, '../data/stock_master.json');

const _isMongoReady = () => mongoose.connection.readyState === 1;

class StockMaster {
  constructor() {
    this._bySymbol = {};      // symbol → stock entry
    this._byToken = {};       // token → stock entry
    this._bySector = {};      // sector → [symbols]
    this._byMcap = {};        // mcap → [symbols]
    this._byIndex = {};       // indexKey → [symbols]
    this._allSymbols = [];
    this._loaded = false;
  }

  load() {
    if (this._loaded) return;
    try {
      const raw = fs.readFileSync(MASTER_PATH, 'utf8');
      const stocks = JSON.parse(raw);

      this._bySymbol = {};
      this._byToken = {};
      this._bySector = {};
      this._byMcap = {};
      const indexKeys = ['nifty50', 'niftynext50', 'banknifty', 'niftyit', 'niftyfmcg', 'niftypharma', 'niftymidcap', 'sensex', 'nifty500'];
      indexKeys.forEach(k => { this._byIndex[k] = []; });

      for (const s of stocks) {
        const sym = s.symbol;
        this._bySymbol[sym] = s;
        this._allSymbols.push(sym);

        if (s.token) this._byToken[s.token] = s;

        // Sector index
        if (!this._bySector[s.sector]) this._bySector[s.sector] = [];
        this._bySector[s.sector].push(sym);

        // Market cap index
        if (!this._byMcap[s.mcap]) this._byMcap[s.mcap] = [];
        this._byMcap[s.mcap].push(sym);

        // Index membership index
        for (const k of indexKeys) {
          if (s[k] === true) this._byIndex[k].push(sym);
        }
      }

      this._loaded = true;
      console.log(`✅ Stock Master loaded: ${stocks.length} stocks, ${Object.keys(this._bySector).length} sectors`);
    } catch (err) {
      console.error('❌ Failed to load stock_master.json:', err.message);
      throw err;
    }
  }

  // ── Lookups ──────────────────────────────────────────────

  /** Get full entry by symbol (case-insensitive) */
  getBySymbol(symbol) {
    this.load();
    return this._bySymbol[symbol.toUpperCase()] || null;
  }

  /** Get full entry by instrument token */
  getByToken(token) {
    this.load();
    return this._byToken[token] || null;
  }

  /** Get symbol → token map (for Kite ticker subscription) */
  async getTokenMapAsync() {
    if (_isMongoReady()) {
      try {
        const Instrument = require('../models/Instrument');
        const docs = await Instrument.find(
          { segment: 'NSE', instrument_type: 'EQ' },
          { tradingsymbol: 1, instrument_token: 1, _id: 0 }
        ).lean();
        const map = {};
        docs.forEach(d => { map[d.tradingsymbol] = d.instrument_token; });
        if (Object.keys(map).length > 0) return map;
      } catch (e) { /* fall through to JSON */ }
    }
    return this.getTokenMap(); // JSON fallback
  }

  getTokenMap() {
    this.load();
    const map = {};
    for (const [sym, entry] of Object.entries(this._bySymbol)) {
      if (entry.token) map[sym] = entry.token;
    }
    return map;
  }

  /** Get reverse token → symbol map */
  async getTokenToSymbolMapAsync() {
    if (_isMongoReady()) {
      try {
        const Instrument = require('../models/Instrument');
        const docs = await Instrument.find(
          { segment: 'NSE', instrument_type: 'EQ' },
          { tradingsymbol: 1, instrument_token: 1, _id: 0 }
        ).lean();
        const map = {};
        docs.forEach(d => { map[d.instrument_token] = d.tradingsymbol; });
        if (Object.keys(map).length > 0) return map;
      } catch (e) { /* fall through to JSON */ }
    }
    return this.getTokenToSymbolMap(); // JSON fallback
  }

  getTokenToSymbolMap() {
    this.load();
    const map = {};
    for (const [sym, entry] of Object.entries(this._bySymbol)) {
      if (entry.token) map[entry.token] = sym;
    }
    return map;
  }

  /** Get sector → symbol map (mirrors old SYMBOL_SECTORS) */
  async getSectorMapAsync() {
    if (_isMongoReady()) {
      try {
        const Instrument = require('../models/Instrument');
        const docs = await Instrument.find(
          { segment: 'NSE', instrument_type: 'EQ' },
          { tradingsymbol: 1, sector: 1, _id: 0 }
        ).lean();
        const map = {};
        docs.forEach(d => { map[d.tradingsymbol] = d.sector || 'General'; });
        if (Object.keys(map).length > 0) return map;
      } catch (e) { /* fall through */ }
    }
    return this.getSectorMap();
  }

  getSectorMap() {
    this.load();
    const map = {};
    for (const [sym, entry] of Object.entries(this._bySymbol)) {
      map[sym] = entry.sector;
    }
    return map;
  }

  /** Get all symbols in a sector */
  getSectorStocks(sector) {
    this.load();
    return this._bySector[sector] || [];
  }

  /** Get index constituent symbols by index key */
  getIndexStocks(indexKey) {
    this.load();
    return this._byIndex[indexKey.toLowerCase()] || [];
  }

  /** Get all index constituent lists (mirrors old indices.js) */
  getIndexConstituents() {
    this.load();
    return {
      NIFTY_50: this._byIndex['nifty50'] || [],
      NIFTY_NEXT_50: this._byIndex['niftynext50'] || [],
      BANKNIFTY: this._byIndex['banknifty'] || [],
      NIFTY_IT: this._byIndex['niftyit'] || [],
      NIFTY_FMCG: this._byIndex['niftyfmcg'] || [],
      NIFTY_PHARMA: this._byIndex['niftypharma'] || [],
      NIFTY_MIDCAP: this._byIndex['niftymidcap'] || [],
      SENSEX: this._byIndex['sensex'] || [],
      NIFTY_500: this._byIndex['nifty500'] || [],
      NIFTY_SERVICE: this._byIndex['niftyservice'] || []
    };
  }

  /** Get stocks by market cap classification */
  getByMarketCap(mcap) {
    this.load();
    return this._byMcap[mcap] || [];
  }

  /** Get all symbols */
  getAllSymbols() {
    this.load();
    return [...this._allSymbols];
  }

  /** Get sector name for a symbol */
  getSector(symbol) {
    const entry = this.getBySymbol(symbol);
    return entry ? entry.sector : 'General';
  }

  /** Get industry for a symbol */
  getIndustry(symbol) {
    const entry = this.getBySymbol(symbol);
    return entry ? entry.industry : 'Unknown';
  }

  /** Get ISIN for a symbol */
  getISIN(symbol) {
    const entry = this.getBySymbol(symbol);
    return entry ? entry.isin : null;
  }

  /** Get market cap classification */
  getMarketCap(symbol) {
    const entry = this.getBySymbol(symbol);
    return entry ? entry.mcap : 'Unknown';
  }

  /** Get full company name */
  getName(symbol) {
    const entry = this.getBySymbol(symbol);
    return entry ? entry.name : `${symbol} Ltd`;
  }

  /** Get instrument token */
  getToken(symbol) {
    const entry = this.getBySymbol(symbol);
    return entry ? entry.token : null;
  }

  /** Bulk enrich: given a symbol, return { sector, industry, name, isin, mcap, token } */
  async enrichAsync(symbol) {
    if (_isMongoReady()) {
      try {
        const Instrument = require('../models/Instrument');
        const doc = await Instrument.findOne(
          { tradingsymbol: symbol.toUpperCase() },
          { sector: 1, industry: 1, name: 1, isin: 1, mcap: 1, instrument_token: 1, _id: 0 }
        ).lean();
        if (doc) {
          return {
            sector: doc.sector || 'General',
            industry: doc.industry || 'Unknown',
            name: doc.name || `${symbol} Ltd`,
            isin: doc.isin || null,
            mcap: doc.mcap || 'Unknown',
            token: doc.instrument_token || null
          };
        }
      } catch (e) { /* fall through */ }
    }
    return this.enrich(symbol);
  }

  enrich(symbol) {
    const entry = this.getBySymbol(symbol);
    if (!entry) return { sector: 'General', industry: 'Unknown', name: `${symbol} Ltd`, isin: null, mcap: 'Unknown', token: null };
    return {
      sector: entry.sector,
      industry: entry.industry,
      name: entry.name,
      isin: entry.isin,
      mcap: entry.mcap,
      token: entry.token
    };
  }
}

// Singleton
module.exports = new StockMaster();
