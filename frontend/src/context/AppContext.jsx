import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';

const AppContext = createContext();

const API_BASE = 'http://localhost:5000/api';

export const AppProvider = ({ children }) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedStock, setSelectedStock] = useState('BEL');
  const [stocks, setStocks] = useState([]);
  const [indices, setIndices] = useState({});
  const [sectors, setSectors] = useState({});
  const [checklist, setChecklist] = useState({});
  const [breadth, setBreadth] = useState([]);
  const [sectorScores, setSectorScores] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulation, setIsSimulation] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [watchlists, setWatchlists] = useState([]);
  const [activeWatchlist, setActiveWatchlist] = useState('Intraday');
  const [scannerConfig, setScannerConfig] = useState({});
  const [openTrades, setOpenTrades] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectorFilter, setActiveSectorFilter] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedIndexStocks, setSelectedIndexStocks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  // Circuit Hits
  const [circuitHits, setCircuitHits] = useState([]);

  // Live data tracking
  const [lastTickTime, setLastTickTime] = useState(null);

  // Trade Mode: 'BUY' (long) or 'SELL' (short)
  const [tradeMode, setTradeMode] = useState('BUY');
  const toggleTradeMode = () => setTradeMode(prev => prev === 'BUY' ? 'SELL' : 'BUY');

  // Theme Management
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('tp-theme') || 'dark';
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('tp-theme', next);
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Favorites — persisted to backend + localStorage cache
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('tp-favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Fetch favorites from backend on mount (source of truth)
  const fetchFavorites = async () => {
    try {
      const res = await axios.get(`${API_BASE}/favorites`);
      if (res.data && Array.isArray(res.data)) {
        setFavorites(res.data);
        localStorage.setItem('tp-favorites', JSON.stringify(res.data));
      }
    } catch (e) {
      console.error('Error fetching favorites from backend, using localStorage:', e.message);
    }
  };

  // Save favorites to backend + localStorage
  const saveFavoritesToBackend = async (symbols) => {
    try {
      await axios.post(`${API_BASE}/favorites`, { symbols });
    } catch (e) {
      console.error('Error saving favorites to backend:', e.message);
    }
  };

  // Cache favorites to localStorage on every change
  useEffect(() => {
    localStorage.setItem('tp-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = useCallback((symbol) => {
    setFavorites(prev => {
      const next = prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol];
      // Save to backend (fire-and-forget)
      saveFavoritesToBackend(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((symbol) => favorites.includes(symbol), [favorites]);

  // Fetch initial REST data
  const fetchWatchlists = async () => {
    try {
      const res = await axios.get(`${API_BASE}/watchlist`);
      setWatchlists(res.data);
    } catch (e) {
      console.error('Error fetching watchlists:', e);
    }
  };

  const fetchScannerConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/scanner/config`);
      setScannerConfig(res.data);
    } catch (e) {
      console.error('Error fetching scanner config:', e);
    }
  };

  const fetchOpenTrades = async () => {
    try {
      const res = await axios.get(`${API_BASE}/trades`);
      setOpenTrades(res.data);
    } catch (e) {
      console.error('Error fetching open trades:', e);
    }
  };

  const fetchJournalEntries = async () => {
    try {
      const res = await axios.get(`${API_BASE}/journal`);
      setJournalEntries(res.data);
    } catch (e) {
      console.error('Error fetching journal entries:', e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE}/analytics`);
      setAnalytics(res.data);
    } catch (e) {
      console.error('Error fetching analytics:', e);
    }
  };

  // Fetch auth status (simulation vs live)
  const fetchAuthStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/status`);
      setIsSimulation(res.data.isSimulation);
      setIsConnected(res.data.isConnected);
      setConnectionError(res.data.error || null);
    } catch (e) {
      console.error('Error fetching auth status:', e);
    }
  };

  // Fetch index constituent stocks from backend
  const fetchIndexStocks = async (indexKey, indexName) => {
    try {
      const res = await axios.get(`${API_BASE}/scanner/index/${encodeURIComponent(indexKey)}`);
      if (res.data && res.data.stocks && res.data.stocks.length > 0) {
        setSelectedIndexStocks(res.data.stocks);
        setSelectedIndex(indexName);
        setActiveSectorFilter(null); // clear sector filter when viewing by index
        setActiveView('scanner');
        return;
      }
    } catch (e) {
      console.error('Error fetching index stocks:', e);
    }
    // Fallback: if backend returns empty or errors (e.g., INDIA VIX), just navigate
    setSelectedIndexStocks([]);
    setSelectedIndex(null);
    setActiveSectorFilter(null);
    setActiveView('scanner');
  };

  // Clear index filter and return to sector-based view
  const clearIndexFilter = () => {
    setSelectedIndex(null);
    setSelectedIndexStocks([]);
  };

  // Run on mount
  useEffect(() => {
    fetchAuthStatus();
    fetchWatchlists();
    fetchScannerConfig();
    fetchOpenTrades();
    fetchJournalEntries();
    fetchAnalytics();
    fetchFavorites();
  }, []);

  // Update specific elements periodically
  useEffect(() => {
    if (activeView === 'trades') {
      fetchOpenTrades();
    }
    if (activeView === 'journal') {
      fetchJournalEntries();
    }
    if (activeView === 'analytics') {
      fetchAnalytics();
    }
  }, [activeView]);

  // Listen for postMessage from Zerodha OAuth callback popup
  useEffect(() => {
    const handleMessage = (event) => {
      // Only accept messages from our backend
      if (event.origin !== 'http://localhost:5000') return;
      if (!event.data || event.data.type !== 'ZERODHA_AUTH') return;

      const { status, message } = event.data;
      addAlert({
        title: status === 'success' ? '✅ Zerodha Connected' : '❌ Zerodha Auth Failed',
        message: message || (status === 'success' ? 'Live market data is now active.' : 'Authentication failed.'),
        type: status === 'success' ? 'BUY' : 'EXIT'
      });

      // Refresh auth status
      fetchAuthStatus();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Request browser notification permissions on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Dispatch desktop notification
  const addAlert = useCallback((alert) => {
    const newAlert = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      read: false,
      ...alert
    };

    setAlerts((prev) => [newAlert, ...prev].slice(0, 50)); // Keep last 50 alerts

    // Desktop Notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(alert.title, {
        body: alert.message,
        icon: '/favicon.ico'
      });
    }
  }, []);

  // Add a manual open trade
  const createTrade = async (tradeData) => {
    try {
      const res = await axios.post(`${API_BASE}/trades`, tradeData);
      setOpenTrades((prev) => [...prev, res.data]);
      addAlert({
        title: 'New Position Opened',
        message: `Opened ${tradeData.quantity} shares of ${tradeData.symbol} at ₹${tradeData.entry}`,
        type: 'BUY'
      });
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.response?.data?.message || 'Error creating trade' };
    }
  };

  // Exit a manual open trade
  const closeTrade = async (id, exitDetails = {}) => {
    try {
      // Pass details as query params for auto-journaling
      const query = new URLSearchParams(exitDetails).toString();
      const res = await axios.delete(`${API_BASE}/trades/${id}?${query}`);
      
      setOpenTrades((prev) => prev.filter(t => t._id !== id && t.id !== id));
      fetchJournalEntries();
      fetchAnalytics();

      addAlert({
        title: 'Position Closed',
        message: `Exited trade for ${res.data.trade.symbol}. Profit/Loss logged to Journal.`,
        type: 'EXIT'
      });
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error exiting trade' };
    }
  };

  // Save manual journal entry
  const createJournalEntry = async (entryData) => {
    try {
      const res = await axios.post(`${API_BASE}/journal`, entryData);
      setJournalEntries((prev) => [res.data, ...prev]);
      fetchAnalytics();
      addAlert({
        title: 'Journal Log Saved',
        message: `Logged journal entry for ${entryData.symbol} (${entryData.profit - entryData.loss >= 0 ? '+' : ''}₹${(entryData.profit - entryData.loss).toFixed(2)})`,
        type: 'HOLD'
      });
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error saving journal entry' };
    }
  };
  // Sync live positions from Zerodha Kite Connect
  const syncKitePositions = async () => {
    try {
      const res = await axios.post(`${API_BASE}/trades/sync-kite`);
      const tradesRes = await axios.get(`${API_BASE}/trades`);
      setOpenTrades(tradesRes.data);
      addAlert({
        title: 'Kite Sync Complete',
        message: `Imported ${res.data.count} live position(s) from your Zerodha account into TradePilot.`,
        type: 'BUY'
      });
      return { success: true, count: res.data.count };
    } catch (e) {
      const errMsg = e.response?.data?.message || 'Failed to sync from Kite Connect';
      addAlert({
        title: 'Kite Sync Failed',
        message: errMsg,
        type: 'EXIT'
      });
      return { success: false, error: errMsg };
    }
  };

  // Update watchlist
  const updateWatchlist = async (name, stocksList) => {
    try {
      const res = await axios.post(`${API_BASE}/watchlist`, { name, stocks: stocksList });
      setWatchlists((prev) => 
        prev.map(wl => wl.name === name ? { ...wl, stocks: stocksList } : wl)
      );
      addAlert({
        title: 'Watchlist Saved',
        message: `Watchlist '${name}' updated. Total items: ${stocksList.length}`,
        type: 'HOLD'
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Update scanner configuration toggles
  const updateScannerConfig = async (newConfig) => {
    try {
      const res = await axios.post(`${API_BASE}/scanner/config`, newConfig);
      setScannerConfig(res.data.config);
      addAlert({
        title: 'Scanner Configuration Updated',
        message: 'Intelligent decision support weights and indicators updated successfully.',
        type: 'HOLD'
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppContext.Provider value={{
      activeView,
      setActiveView,
      selectedStock,
      setSelectedStock,
      stocks,
      setStocks,
      indices,
      setIndices,
      sectors,
      setSectors,
      checklist,
      setChecklist,
      breadth,
      setBreadth,
      sectorScores,
      setSectorScores,
      isConnected,
      setIsConnected,
      isSimulation,
      setIsSimulation,
      connectionError,
      setConnectionError,
      watchlists,
      activeWatchlist,
      setActiveWatchlist,
      scannerConfig,
      updateScannerConfig,
      openTrades,
      createTrade,
      closeTrade,
      syncKitePositions,
      journalEntries,
      createJournalEntry,
      analytics,
      fetchAnalytics,
      searchQuery,
      setSearchQuery,
      activeSectorFilter,
      setActiveSectorFilter,
      selectedIndex,
      setSelectedIndex,
      selectedIndexStocks,
      fetchIndexStocks,
      clearIndexFilter,
      alerts,
      addAlert,
      theme,
      toggleTheme,
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      tradeMode,
      toggleTradeMode,
      favorites,
      toggleFavorite,
      isFavorite,
      lastTickTime,
      setLastTickTime,
      circuitHits,
      setCircuitHits
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
export default AppContext;
