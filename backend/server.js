require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const storageService = require('./services/storageService');
const kiteService = require('./services/kiteService');
const instrumentService = require('./services/instrumentService');

// Express App setup
const app = express();
const server = http.createServer(app);

// Enable CORS for frontend connection
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Mount Routes
app.use('/api/trades', require('./routes/trades'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/watchlist', require('./routes/watchlist'));
app.use('/api/scanner', require('./routes/scanner'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/favorites', require('./routes/favorites'));

// Instrument DB routes (refresh, status)
app.get('/api/instruments/refresh', async (req, res) => {
  const result = await instrumentService.refreshDatabase();
  res.json(result);
});

app.get('/api/instruments/status', (req, res) => {
  res.json(instrumentService.getStatus());
});

app.get('/api/instruments/search', async (req, res) => {
  try {
    const { q, sector, mcap, index: indexName, limit } = req.query;
    const results = await instrumentService.query({
      symbols: q ? [q] : null,
      sector: sector || null,
      mcap: mcap || null,
      indexName: indexName || null,
      limit: Number(limit) || 100
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set up Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket connection listener
io.on('connection', (socket) => {
  // console.log(`Client connected: ${socket.id}`);

  // Sync favorites from frontend → prioritise WebSocket slots
  socket.on('update_favorites', (favorites) => {
    kiteService.favoriteSymbols = new Set(favorites || []);
    console.log(`⭐ Favorites synced: ${kiteService.favoriteSymbols.size} stocks prioritised for WebSocket`);
  });
  
  // Send initial data to connected client
  socket.emit('init', {
    message: 'Welcome to TradePilot Real-time Engine'
  });

  // Immediately push current auth status so UI is never stale
  socket.emit('auth_status', {
    isSimulation: kiteService.isSimulation,
    isConnected: kiteService.isLiveReady && !!process.env.KITE_ACCESS_TOKEN
  });

  socket.on('disconnect', () => {
    // console.log(`Client disconnected: ${socket.id}`);
  });
});

// Connect Database & Start Server
const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect Mongoose (DB)
  const isConnected = await connectDB();
  if (!isConnected) {
    console.log('Running backend service with JSON storage fallback.');
  }

  // Refresh instrument database (from Kite API or stock_master.json fallback)
  instrumentService.refreshDatabase().then(result => {
    if (result.success) {
      console.log(`📊 Instrument DB ready: ${result.total} stocks`);
    }
  });

  // Start daily instrument refresh at 3:00 AM IST
  instrumentService.startDailyRefresh(io);

  // Initialize Kite Live/Simulated feed
  kiteService.initialize(io, storageService);

  server.listen(PORT, () => {
    console.log(`TradePilot Server running on port ${PORT}`);
    console.log(`Access the API at http://localhost:${PORT}/api/health`);
  });
};

// Handle graceful shutdowns
process.on('SIGINT', () => {
  kiteService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  kiteService.stop();
  process.exit(0);
});

start();
