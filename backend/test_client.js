const { io } = require('socket.io-client');

const socket = io('http://localhost:5000');

console.log('Connecting to TradePilot Socket.IO server...');

socket.on('connect', () => {
  console.log('Connected! Waiting for ticks...');
});

socket.on('auth_status', (status) => {
  console.log('Auth Status:', status);
});

socket.on('ticks', (data) => {
  console.log('--- TICK RECEIVED ---');
  console.log('isSimulation:', data.isSimulation);
  console.log('Error:', data.error);
  if (data.stocks && data.stocks.length > 0) {
    console.log('Number of stocks:', data.stocks.length);
    // Print first 5 stocks
    for (let i = 0; i < Math.min(5, data.stocks.length); i++) {
      const s = data.stocks[i];
      console.log(`- ${s.symbol}: price = ${s.price}, open = ${s.open}, sector = ${s.sector}`);
    }
  }
  socket.disconnect();
  process.exit(0);
});

socket.on('disconnect', () => {
  console.log('Disconnected.');
});

setTimeout(() => {
  console.log('Timeout waiting for ticks.');
  socket.disconnect();
  process.exit(1);
}, 10000);
