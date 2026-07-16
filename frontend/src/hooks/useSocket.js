import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useApp } from '../context/AppContext';

const SOCKET_URL = 'http://localhost:5000';

export const useSocket = () => {
  const {
    setStocks,
    setIndices,
    setSectors,
    setChecklist,
    setBreadth,
    setSectorScores,
    setIsConnected,
    setIsSimulation,
    setConnectionError,
    setLastTickTime,
    addAlert,
    favorites,
    setCircuitHits,
    setOpenTrades
  } = useApp();

  const socketRef = useRef(null);
  const prevPricesRef = useRef({});

  // Use refs to hold latest callbacks so the socket effect doesn't
  // need them in its dependency array — prevents disconnect/reconnect
  // on every render when callback identities change.
  const addAlertRef = useRef(addAlert);
  const setStocksRef = useRef(setStocks);
  const setIndicesRef = useRef(setIndices);
  const setSectorsRef = useRef(setSectors);
  const setChecklistRef = useRef(setChecklist);
  const setBreadthRef = useRef(setBreadth);
  const setSectorScoresRef = useRef(setSectorScores);
  const setIsConnectedRef = useRef(setIsConnected);
  const setIsSimulationRef = useRef(setIsSimulation);
  const setConnectionErrorRef = useRef(setConnectionError);
  const setLastTickTimeRef = useRef(setLastTickTime);
  const setCircuitHitsRef = useRef(setCircuitHits);
  const setOpenTradesRef = useRef(setOpenTrades);

  // Keep refs in sync with latest callbacks on every render
  useEffect(() => { addAlertRef.current = addAlert; });
  useEffect(() => { setStocksRef.current = setStocks; });
  useEffect(() => { setIndicesRef.current = setIndices; });
  useEffect(() => { setSectorsRef.current = setSectors; });
  useEffect(() => { setChecklistRef.current = setChecklist; });
  useEffect(() => { setBreadthRef.current = setBreadth; });
  useEffect(() => { setSectorScoresRef.current = setSectorScores; });
  useEffect(() => { setIsConnectedRef.current = setIsConnected; });
  useEffect(() => { setIsSimulationRef.current = setIsSimulation; });
  useEffect(() => { setConnectionErrorRef.current = setConnectionError; });
  useEffect(() => { setLastTickTimeRef.current = setLastTickTime; });
  useEffect(() => { setCircuitHitsRef.current = setCircuitHits; });
  useEffect(() => { setOpenTradesRef.current = setOpenTrades; });

  // Connect socket ONCE and never disconnect on re-renders
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket.io connected');
      setIsConnectedRef.current(true);
      // Sync favorites to backend so they get WebSocket priority
      socket.emit('update_favorites', favorites);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.io disconnected:', reason);
      setIsConnectedRef.current(false);
      // Socket.io auto-reconnects by default — no action needed
    });

    socket.on('connect_error', (err) => {
      console.log('🔌 Socket.io connect error:', err.message);
    });

    socket.on('ticks', (data) => {
      const { stocks, indices, sectors, checklist, isSimulation, error } = data;

      setIsSimulationRef.current(isSimulation);
      setConnectionErrorRef.current(error || null);
      setLastTickTimeRef.current(Date.now());

      // 1. Process stocks and inject flash details
      setStocksRef.current((prevStocks) => {
        return stocks.map((newStock) => {
          const prevStock = prevStocks.find(s => s.symbol === newStock.symbol);
          let flash = null;

          if (prevStock) {
            if (newStock.price > prevStock.price) {
              flash = 'up';
            } else if (newStock.price < prevStock.price) {
              flash = 'down';
            } else {
              flash = prevStock.flash;
            }
          }

          return { ...newStock, flash };
        });
      });

      // 2. Process indices and inject flash details
      setIndicesRef.current((prevIndices) => {
        const updated = {};
        Object.keys(indices).forEach(key => {
          const newIdx = indices[key];
          const prevIdx = prevIndices[key];
          let flash = null;

          if (prevIdx) {
            if (newIdx.price > prevIdx.price) {
              flash = 'up';
            } else if (newIdx.price < prevIdx.price) {
              flash = 'down';
            }
          }

          updated[key] = { ...newIdx, flash };
        });
        return updated;
      });

      // 3. Process sectors
      setSectorsRef.current(sectors);

      // 4. Process checklist
      setChecklistRef.current(checklist);

      // 5. Process market breadth
      if (data.breadth) setBreadthRef.current(data.breadth);

      // 6. Process sector scores
      if (data.sectorScores) setSectorScoresRef.current(data.sectorScores);

      // 7. Process circuit hits
      if (data.circuitHits) setCircuitHitsRef.current(data.circuitHits);
    });

    // Handle real-time circuit hit alerts
    socket.on('circuit_hit', (hit) => {
      addAlertRef.current({
        title: `🔒 ${hit.type} CIRCUIT: ${hit.symbol}`,
        message: `${hit.name || hit.symbol} @ ₹${hit.price} (${hit.changePct >= 0 ? '+' : ''}${hit.changePct}%)`,
        type: hit.type === 'UPPER' ? 'BUY' : 'EXIT'
      });
      setCircuitHitsRef.current(prev => [hit, ...prev].slice(0, 50));
    });

    // Handle real-time signals/alerts
    socket.on('signal', (signal) => {
      addAlertRef.current(signal);

      // Audio alert for high-confidence BUY/SELL signals
      const confidence = signal.confidence || 0;
      const isHighConfidence = confidence >= 80;
      const isActionable = ['BUY', 'EXIT', 'BOOK PROFIT'].includes(signal.type);

      if (isHighConfidence && isActionable) {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);

          if (signal.type === 'BUY') {
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(900, audioCtx.currentTime + 0.2);
          } else {
            osc.frequency.setValueAtTime(900, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.3);
          }

          gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + 0.4);
        } catch (e) { /* audio not supported */ }
      }
    });

    // Handle auth status changes
    socket.on('auth_status', (status) => {
      setIsSimulationRef.current(status.isSimulation);
      setIsConnectedRef.current(status.isConnected);
      setConnectionErrorRef.current(status.error || null);
    });

    // Handle live open trades P&L updates pushed from backend
    socket.on('trades_updated', (trades) => {
      setOpenTradesRef.current(trades);
    });

    // Cleanup only on true unmount (not on re-render)
    return () => {
      console.log('🔌 Socket.io disconnecting (component unmount)');
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []); // ← EMPTY array: effect runs ONLY once on mount

  // Sync favorites to backend whenever they change (WebSocket priority)
  useEffect(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('update_favorites', favorites);
    }
  }, [favorites]);

  return socketRef.current;
};

export default useSocket;
