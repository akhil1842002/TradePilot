/**
 * Instrument Service
 * Fetches instruments from Zerodha Kite /instruments API,
 * parses the CSV, merges with local enrichment data (sector, mcap, indices),
 * and upserts into MongoDB. Runs on startup + daily refresh.
 */
const fs = require('fs');
const path = require('path');
const { KiteConnect } = require('kiteconnect');
const mongoose = require('mongoose');
const Instrument = require('../models/Instrument');
const stockMaster = require('./stockMaster');

// ── CSV Parser (lightweight, no dependency) ────────────────────
function parseCsvLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

function parseInstruments(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < header.length) continue;

    const row = {};
    header.forEach((h, idx) => { row[h] = cols[idx]; });
    rows.push(row);
  }
  return rows;
}

// ── Instrument Service ────────────────────────────────────────
class InstrumentService {
  constructor() {
    this._refreshInterval = null;
    this._isRefreshing = false;
    this._lastRefresh = null;
  }

  /**
   * Fetch instruments from Zerodha Kite /instruments API
   * @param {object} kite - KiteConnect instance (authenticated)
   * @returns {Array} Array of parsed instrument objects
   */
  async fetchFromKite(kite) {
    console.log('📡 Fetching instruments from Zerodha Kite...');
    const instruments = await kite.getInstruments();
    console.log(`✅ Fetched ${instruments.length} instruments from Zerodha`);
    return instruments;
  }

  /**
   * Try to fetch instruments. If Kite is not available (simulation mode),
   * fall back to stock_master.json data.
   */
  async fetchOrFallback() {
    const apiKey = process.env.KITE_API_KEY;
    const accessToken = process.env.KITE_ACCESS_TOKEN;

    if (apiKey && accessToken) {
      try {
        const kite = new KiteConnect({ api_key: apiKey });
        kite.setAccessToken(accessToken);
        return await this.fetchFromKite(kite);
      } catch (err) {
        console.warn('⚠️  Kite instruments fetch failed:', err.message);
      }
    }

    // Fallback: load from static stock_master.json
    console.log('🔄 Using stock_master.json as instrument source (offline/simulation)');
    return this._instrumentsFromStockMaster();
  }

  /**
   * Convert stock_master.json entries to instrument-like objects
   */
  _instrumentsFromStockMaster() {
    const symbols = stockMaster.getAllSymbols();
    return symbols.map(sym => {
      const meta = stockMaster.enrich(sym);
      return {
        instrument_token: meta.token || 0,
        exchange_token: meta.token || 0,
        tradingsymbol: sym,
        name: meta.name,
        exchange: 'NSE',
        segment: 'NSE',
        instrument_type: 'EQ',
        tick_size: 0.05,
        lot_size: 1,
        strike: 0,
        expiry: '',
        last_price: 0,
        sector: meta.sector,
        industry: meta.industry,
        mcap: meta.mcap,
        isin: meta.isin,
        nifty50: sym in (stockMaster._byIndex?.['nifty50'] || []),
        niftynext50: false,
        banknifty: false,
        niftyit: false,
        niftyfmcg: false,
        niftypharma: false,
        niftymidcap: false,
        sensex: false,
        nifty500: false
      };
    });
  }

  /**
   * Merge Kite instrument with enrichment data from stock master
   */
  _enrich(inst) {
    const sym = (inst.tradingsymbol || '').toUpperCase();
    const meta = stockMaster.enrich(sym);
    const ix = stockMaster.getIndexConstituents ? stockMaster.getIndexConstituents() : {};

    const inIndex = (arr, s) => Array.isArray(arr) && arr.includes(s);

    return {
      instrument_token: Number(inst.instrument_token) || 0,
      exchange_token: Number(inst.exchange_token) || 0,
      tradingsymbol: sym.toUpperCase(),
      name: meta.name !== `${sym} Ltd` ? meta.name : (inst.name || `${sym} Ltd`),
      exchange: inst.exchange || 'NSE',
      segment: inst.segment || inst.exchange || 'NSE',
      instrument_type: inst.instrument_type || 'EQ',
      tick_size: Number(inst.tick_size) || 0.05,
      lot_size: Number(inst.lot_size) || 1,
      strike: Number(inst.strike) || 0,
      expiry: inst.expiry || '',
      last_price: Number(inst.last_price) || 0,
      sector: meta.sector || 'General',
      industry: meta.industry || 'Unknown',
      mcap: meta.mcap || 'Unknown',
      isin: meta.isin || null,
      nifty50: inIndex(ix.NIFTY_50, sym),
      niftynext50: inIndex(ix.NIFTY_NEXT_50, sym),
      banknifty: inIndex(ix.BANKNIFTY, sym),
      niftyit: inIndex(ix.NIFTY_IT, sym),
      niftyfmcg: inIndex(ix.NIFTY_FMCG, sym),
      niftypharma: inIndex(ix.NIFTY_PHARMA, sym),
      niftymidcap: inIndex(ix.NIFTY_MIDCAP, sym),
      sensex: inIndex(ix.SENSEX, sym),
      nifty500: inIndex(ix.NIFTY_500, sym),
      lastRefreshed: new Date()
    };
  }

  /**
   * Refresh the instrument database:
   * 1. Fetch from Kite (or fallback)
   * 2. Filter to NSE equity only
   * 3. Enrich with sector/industry/mcap/index metadata
   * 4. Bulk upsert into MongoDB
   */
  async refreshDatabase() {
    if (this._isRefreshing) {
      console.log('⏳ Instrument refresh already in progress, skipping...');
      return { success: false, message: 'Refresh already in progress' };
    }

    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      console.log('⚠️  MongoDB not connected — instruments will be served from stock_master.json');
      return { success: false, message: 'MongoDB not connected' };
    }

    this._isRefreshing = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Starting instrument database refresh...');

      // 1. Fetch all instruments
      const allInstruments = await this.fetchOrFallback();

      // 2. Filter: NSE equity only (tradingsymbol with no hyphen = EQ stock)
      //    EQ stocks: simple symbol like 'RELIANCE', no expiry/strike suffix
      const equityStocks = allInstruments.filter(inst => {
        const sym = (inst.tradingsymbol || '').toUpperCase();
        return (
          (inst.segment === 'NSE' || inst.exchange === 'NSE') &&
          (inst.instrument_type === 'EQ' || !inst.instrument_type) &&
          !sym.includes('-') &&         // exclude futures (RELIANCE-JAN)
          !sym.includes('&') &&          // exclude some special symbols
          /^[A-Z0-9]+$/.test(sym)       // only alphanumeric
        );
      });

      console.log(`🔍 Filtered ${equityStocks.length} NSE equity stocks from ${allInstruments.length} total instruments`);

      // 3. Enrich & prepare for bulk upsert
      const enriched = equityStocks.map(inst => this._enrich(inst));

      // 4. Bulk upsert using instrument_token as unique key
      let inserted = 0;
      let updated = 0;

      // Process in batches of 500 to avoid memory issues
      const BATCH_SIZE = 500;
      for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
        const batch = enriched.slice(i, i + BATCH_SIZE);
        const ops = batch.map(doc => ({
          updateOne: {
            filter: { instrument_token: doc.instrument_token },
            update: { $set: doc },
            upsert: true
          }
        }));

        const result = await Instrument.bulkWrite(ops, { ordered: false });
        inserted += result.upsertedCount || 0;
        updated += result.modifiedCount || 0;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this._lastRefresh = new Date();
      this._isRefreshing = false;

      console.log(`✅ Instrument DB refreshed: ${inserted} inserted, ${updated} updated in ${elapsed}s`);
      console.log(`📊 Total NSE equity instruments in DB: ${enriched.length}`);

      return {
        success: true,
        total: enriched.length,
        inserted,
        updated,
        elapsed: `${elapsed}s`,
        timestamp: this._lastRefresh
      };
    } catch (err) {
      this._isRefreshing = false;
      console.error('❌ Instrument refresh failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Start automatic daily refresh (runs at 3:00 AM IST)
   */
  startDailyRefresh(io = null) {
    if (this._refreshInterval) return;

    // Calculate ms until next 3:00 AM IST (UTC+5:30 = 21:30 previous UTC)
    const scheduleNext = () => {
      const now = new Date();
      const target = new Date(now);
      target.setUTCHours(21, 30, 0, 0); // 3:00 AM IST = 21:30 UTC (previous day)

      if (target <= now) {
        target.setUTCDate(target.getUTCDate() + 1);
      }

      const delay = target.getTime() - now.getTime();
      console.log(`⏰ Next instrument refresh scheduled at ${target.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST (in ${Math.round(delay / 3600000)}h)`);

      return setTimeout(() => {
        this.refreshDatabase().then(result => {
          if (io && result.success) {
            io.emit('signal', {
              title: '🔄 Instrument Database Refreshed',
              message: `${result.total} instruments updated from Zerodha (${result.inserted} new, ${result.updated} changed)`,
              type: 'HOLD',
              confidence: 0
            });
          }
        });
        // Schedule next run
        this._refreshInterval = setTimeout(scheduleNext, 1000);
      }, delay);
    };

    this._refreshInterval = setTimeout(scheduleNext, 1000);
  }

  /**
   * Stop the daily refresh schedule
   */
  stopDailyRefresh() {
    if (this._refreshInterval) {
      clearTimeout(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  /**
   * Get instruments from MongoDB, with optional filters
   */
  async query({ segment = 'NSE', indexName = null, sector = null, mcap = null, symbols = null, limit = 5000 } = {}) {
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      return this._instrumentsFromStockMaster();
    }

    const filter = { instrument_type: 'EQ' };
    if (segment) filter.segment = segment;

    if (indexName) {
      const ixKey = indexName.toLowerCase();
      const ixMap = {
        'nifty50': 'nifty50', 'niftynext50': 'niftynext50', 'banknifty': 'banknifty',
        'niftyit': 'niftyit', 'niftyfmcg': 'niftyfmcg', 'niftypharma': 'niftypharma',
        'niftymidcap': 'niftymidcap', 'sensex': 'sensex', 'nifty500': 'nifty500'
      };
      const field = ixMap[ixKey];
      if (field) filter[field] = true;
    }

    if (sector) filter.sector = sector;
    if (mcap) filter.mcap = mcap;
    if (symbols && symbols.length > 0) {
      filter.tradingsymbol = { $in: symbols.map(s => s.toUpperCase()) };
    }

    return await Instrument.find(filter).limit(limit).lean();
  }

  /**
   * Get a single instrument by symbol or token
   */
  async getOne(identifier) {
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      const meta = stockMaster.enrich(identifier);
      return { tradingsymbol: identifier, ...meta };
    }

    if (typeof identifier === 'number') {
      return await Instrument.findOne({ instrument_token: identifier }).lean();
    }
    return await Instrument.findOne({ tradingsymbol: identifier.toUpperCase() }).lean();
  }

  /**
   * Get token → symbol map (for Kite ticker)
   */
  async getTokenToSymbolMap() {
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      return stockMaster.getTokenToSymbolMap();
    }

    const instruments = await Instrument.find(
      { segment: 'NSE', instrument_type: 'EQ' },
      { instrument_token: 1, tradingsymbol: 1, _id: 0 }
    ).lean();

    const map = {};
    instruments.forEach(inst => {
      map[inst.instrument_token] = inst.tradingsymbol;
    });
    return map;
  }

  /**
   * Get symbol → token map
   */
  async getTokenMap() {
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      return stockMaster.getTokenMap();
    }

    const instruments = await Instrument.find(
      { segment: 'NSE', instrument_type: 'EQ' },
      { instrument_token: 1, tradingsymbol: 1, _id: 0 }
    ).lean();

    const map = {};
    instruments.forEach(inst => {
      map[inst.tradingsymbol] = inst.instrument_token;
    });
    return map;
  }

  /**
   * Get sector → symbol map
   */
  async getSectorMap() {
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      return stockMaster.getSectorMap();
    }

    const instruments = await Instrument.find(
      { segment: 'NSE', instrument_type: 'EQ' },
      { tradingsymbol: 1, sector: 1, _id: 0 }
    ).lean();

    const map = {};
    instruments.forEach(inst => {
      map[inst.tradingsymbol] = inst.sector || 'General';
    });
    return map;
  }

  /**
   * Get instruments belonging to a specific index
   */
  async getIndexStocks(indexName) {
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      return stockMaster.getIndexStocks(indexName);
    }

    const ixKey = indexName.toLowerCase();
    const ixMap = {
      'nifty50': 'nifty50', 'niftynext50': 'niftynext50', 'banknifty': 'banknifty',
      'niftyit': 'niftyit', 'niftyfmcg': 'niftyfmcg', 'niftypharma': 'niftypharma',
      'niftymidcap': 'niftymidcap', 'sensex': 'sensex', 'nifty500': 'nifty500'
    };
    const field = ixMap[ixKey];
    if (!field) return [];

    const instruments = await Instrument.find(
      { [field]: true, segment: 'NSE' },
      { tradingsymbol: 1, _id: 0 }
    ).lean();

    return instruments.map(i => i.tradingsymbol);
  }

  /**
   * Get refresh status
   */
  getStatus() {
    return {
      lastRefresh: this._lastRefresh,
      isRefreshing: this._isRefreshing,
      mongoConnected: mongoose.connection.readyState === 1
    };
  }
}

// Singleton
module.exports = new InstrumentService();
