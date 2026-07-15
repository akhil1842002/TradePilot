// Indian stock market index constituent stocks
// Source: stock_master.json (comprehensive stock master)
// This file now delegates to the stock master service for all lookups.

const stockMaster = require('../services/stockMaster');

// Legacy exports for backward compatibility — populated from stock_master.json
let NIFTY_50 = [];
let NIFTY_NEXT_50 = [];
let BANKNIFTY = [];
let NIFTY_IT = [];
let NIFTY_FMCG = [];
let NIFTY_PHARMA = [];
let NIFTY_MIDCAP = [];
let SENSEX = [];
let NIFTY_500 = [];
let NIFTY_SERVICE = [];

function refreshCache() {
  const ix = stockMaster.getIndexConstituents();
  NIFTY_50       = ix.NIFTY_50;
  NIFTY_NEXT_50  = ix.NIFTY_NEXT_50;
  BANKNIFTY      = ix.BANKNIFTY;
  NIFTY_IT       = ix.NIFTY_IT;
  NIFTY_FMCG     = ix.NIFTY_FMCG;
  NIFTY_PHARMA   = ix.NIFTY_PHARMA;
  NIFTY_MIDCAP   = ix.NIFTY_MIDCAP;
  SENSEX         = ix.SENSEX;
  NIFTY_500      = ix.NIFTY_500;
  NIFTY_SERVICE  = ix.NIFTY_SERVICE;
}

// Get stocks for a given index name (delegates to stock master)
function getIndexStocks(indexName) {
  const stocks = stockMaster.getIndexStocks(indexName);
  if (stocks.length > 0) return stocks;

  // Fallback: legacy name mapping
  const legacyMap = {
    'NIFTY 100':   [...stockMaster.getIndexStocks('nifty50'), ...stockMaster.getIndexStocks('niftynext50')],
    'NIFTY100':    [...stockMaster.getIndexStocks('nifty50'), ...stockMaster.getIndexStocks('niftynext50')],
    'MIDCAP 100':  stockMaster.getIndexStocks('niftymidcap'),
    'BANK NIFTY':  stockMaster.getIndexStocks('banknifty'),
    'NIFTY IT':    stockMaster.getIndexStocks('niftyit'),
    'NIFTY FMCG':  stockMaster.getIndexStocks('niftyfmcg'),
    'NIFTY PHARMA': stockMaster.getIndexStocks('niftypharma'),
    'SERVICE SECTOR': stockMaster.getIndexStocks('niftyservice'),
  };
  return legacyMap[indexName.toUpperCase()] || [];
}

// Refresh cache on first load
refreshCache();

module.exports = {
  NIFTY_50, NIFTY_NEXT_50, BANKNIFTY, NIFTY_IT, NIFTY_FMCG,
  NIFTY_PHARMA, NIFTY_MIDCAP, SENSEX, NIFTY_500, NIFTY_SERVICE,
  getIndexStocks
};
