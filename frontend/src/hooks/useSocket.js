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
    setIsConnected,
    setIsSimulation,
    setConnectionError,
    setLastTickTime,
    addAlert
  } = useApp();

  const socketRef = useRef(null);
  const prevPricesRef = useRef({});

  useEffect(() => {
    // Connect socket
    const socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.io connection established.');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket.io connection disconnected.');
      setIsConnected(false);
    });

    socket.on('ticks', (data) => {
      const { stocks, indices, sectors, checklist, isSimulation, error } = data;
      
      setIsSimulation(isSimulation);
      setConnectionError(error || null);
      setLastTickTime(Date.now());

      // 1. Process stocks and inject flash details
      setStocks((prevStocks) => {
        return stocks.map((newStock) => {
          const prevStock = prevStocks.find(s => s.symbol === newStock.symbol);
          let flash = null;
          
          if (prevStock) {
            if (newStock.price > prevStock.price) {
              flash = 'up';
            } else if (newStock.price < prevStock.price) {
              flash = 'down';
            } else {
              flash = prevStock.flash; // preserve if unchanged
            }
          }

          return { ...newStock, flash };
        });
      });

      // 2. Process indices and inject flash details
      setIndices((prevIndices) => {
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
      setSectors(sectors);

      // 4. Process checklist
      setChecklist(checklist);
    });

    // Handle real-time signals/alerts
    socket.on('signal', (signal) => {
      addAlert(signal);

      // Audio alert for high-confidence BUY/SELL signals (>80%)
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
          
          // Buy = rising tone, Sell/Exit = falling tone
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
        } catch(e) { /* audio not supported */ }
      }
    });

    // Handle auth status changes (live/simulation mode switches)
    socket.on('auth_status', (status) => {
      setIsSimulation(status.isSimulation);
      setIsConnected(status.isConnected);
      setConnectionError(status.error || null);
    });

    // Cleanup
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [setStocks, setIndices, setSectors, setChecklist, setIsConnected, setIsSimulation, setConnectionError, setLastTickTime, addAlert]);

  return socketRef.current;
};

export default useSocket;
