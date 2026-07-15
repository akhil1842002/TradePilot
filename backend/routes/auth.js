const express = require('express');
const router = express.Router();
const kiteService = require('../services/kiteService');
const { KiteConnect } = require('kiteconnect');
const fs = require('fs');
const path = require('path');

// GET /api/auth/kite/login - Redirect user to Zerodha login page
router.get('/kite/login', (req, res) => {
  const apiKey = process.env.KITE_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ message: 'KITE_API_KEY not set in .env file.' });
  }
  const redirectUrl = process.env.KITE_REDIRECT_URL || 'http://localhost:5000/api/auth/kite/callback';
  const loginUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey}&v=3&redirect_url=${encodeURIComponent(redirectUrl)}`;
  console.log(`Redirecting to Zerodha login. Callback will be: ${redirectUrl}`);
  res.redirect(loginUrl);
});

// GET /api/auth/kite/callback - Zerodha redirects here with ?request_token=...
router.get('/kite/callback', async (req, res) => {
  const { request_token, status } = req.query;
  console.log('=== Kite callback received ===');
  console.log('Query params:', { request_token: request_token ? `${request_token.slice(0,10)}...` : 'MISSING', status });

  if (status !== 'success' || !request_token) {
    kiteService.emitSignal(
      'Zerodha Login Failed',
      `Status: ${status || 'unknown'}. Please try again.`,
      'EXIT'
    );
    return res.send(`
      <html><body style="background:#0d1117;color:#ff4d4d;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;">
        <h2>❌ Zerodha Login Failed</h2>
        <p>Status: ${status || 'unknown'}. Please try again.</p>
        <a href="http://localhost:5173" style="color:#4fc3f7;margin-top:1rem;">← Back to TradePilot</a>
      </body></html>
      <script>if(window.opener)window.opener.postMessage({type:'ZERODHA_AUTH',status:'failed',message:'Login failed: ${status || 'unknown'}'},'http://localhost:5173');</script>
    `);
  }

  try {
    const apiKey = process.env.KITE_API_KEY;
    const apiSecret = process.env.KITE_API_SECRET;

    if (!apiSecret) {
      kiteService.emitSignal(
        'Configuration Error',
        'KITE_API_SECRET is missing. Please add it to the .env file and restart the backend.',
        'EXIT'
      );
      return res.send(`
        <html><body style="background:#0d1117;color:#ff4d4d;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;">
          <h2>❌ KITE_API_SECRET missing</h2>
          <p>Please add your KITE_API_SECRET to the .env file and restart the backend.</p>
          <a href="http://localhost:5173" style="color:#4fc3f7;margin-top:1rem;">← Back to TradePilot</a>
        </body></html>
        <script>if(window.opener)window.opener.postMessage({type:'ZERODHA_AUTH',status:'failed',message:'KITE_API_SECRET is missing'},'http://localhost:5173');</script>
      `);
    }

    const kite = new KiteConnect({ api_key: apiKey });
    const session = await kite.generateSession(request_token, apiSecret);
    const accessToken = session.access_token;

    // Write access token to .env file so it persists across restarts
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    if (envContent.includes('KITE_ACCESS_TOKEN=')) {
      envContent = envContent.replace(/KITE_ACCESS_TOKEN=.*/g, `KITE_ACCESS_TOKEN=${accessToken}`);
    } else {
      envContent += `\nKITE_ACCESS_TOKEN=${accessToken}`;
    }

    if (envContent.includes('SIMULATION_MODE=')) {
      envContent = envContent.replace(/SIMULATION_MODE=.*/g, 'SIMULATION_MODE=false');
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    // Update process environment variables live (no restart needed for this session)
    process.env.KITE_ACCESS_TOKEN = accessToken;
    process.env.SIMULATION_MODE = 'false';

    // Quick verification: test if the fresh token has quote permissions
    console.log('=== FRESH TOKEN VERIFICATION ===');
    console.log('New access_token (first 10):', accessToken.substring(0, 10) + '...');
    try {
      kite.setAccessToken(accessToken);
      const testLTP = await kite.getLTP(['NSE:INFY']);
      console.log('✅ LTP test PASSED with fresh token:', JSON.stringify(testLTP));
    } catch (ltpErr) {
      console.log('❌ LTP test FAILED with fresh token:', ltpErr.message, '| error_type:', ltpErr.error_type);
      console.log('   This means quote permissions are still not available.');
      console.log('   Subscription may not be fully active yet, or API key mismatch.');
    }
    console.log('================================');

    // Re-initialize kiteService with the new access token
    kiteService.initKiteConnect(apiKey, apiSecret, accessToken);

    // Notify frontend immediately
    kiteService.emitAuthStatus();
    kiteService.emitSignal(
      '✅ Zerodha Connected',
      'Live market data is now active. Your access token has been saved for this session.',
      'BUY'
    );

    res.send(`
      <html><body style="background:#0d1117;color:#00e676;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;">
        <div style="font-size:3rem;">✅</div>
        <h2 style="margin:0;">Zerodha Connected Successfully!</h2>
        <p style="color:#aaa;margin:0;">TradePilot is now receiving live market data from your Zerodha account.</p>
        <p style="color:#aaa;font-size:0.85rem;margin:0;">Access Token saved for today's session. You'll need to reconnect tomorrow morning.</p>
        <a href="http://localhost:5173" style="color:#4fc3f7;margin-top:1rem;font-size:1.1rem;text-decoration:none;border:1px solid #4fc3f7;padding:10px 24px;border-radius:8px;">
          🚀 Go to TradePilot Dashboard
        </a>
      </body></html>
      <script>if(window.opener)window.opener.postMessage({type:'ZERODHA_AUTH',status:'success',message:'Zerodha connected successfully'},'http://localhost:5173');</script>
    `);
  } catch (err) {
    console.error('Kite session generation error:', err);
    kiteService.emitSignal(
      '❌ Session Generation Failed',
      err.message || 'Unknown error generating Kite session.',
      'EXIT'
    );
    res.send(`
      <html><body style="background:#0d1117;color:#ff4d4d;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;">
        <h2>❌ Session Generation Failed</h2>
        <p>${err.message}</p>
        <a href="http://localhost:5173" style="color:#4fc3f7;margin-top:1rem;">← Back to TradePilot</a>
      </body></html>
      <script>if(window.opener)window.opener.postMessage({type:'ZERODHA_AUTH',status:'failed',message:'${err.message.replace(/'/g, "\\'")}'},'http://localhost:5173');</script>
    `);
  }
});

// GET /api/auth/status - Check if live Kite is connected
router.get('/status', (req, res) => {
  res.json({
    isSimulation: kiteService.isSimulation,
    isConnected: kiteService.isLiveReady && !!process.env.KITE_ACCESS_TOKEN,
    isLiveReady: kiteService.isLiveReady,
    apiKey: process.env.KITE_API_KEY ? `${process.env.KITE_API_KEY.slice(0, 4)}****` : null,
    hasSecret: !!process.env.KITE_API_SECRET,
    hasToken: !!process.env.KITE_ACCESS_TOKEN,
    stockCount: Object.keys(kiteService.stocks).length,
    loginUrl: `http://localhost:5000/api/auth/kite/login`
  });
});

module.exports = router;
