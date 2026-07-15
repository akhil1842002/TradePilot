const { KiteConnect } = require('kiteconnect');
require('dotenv').config();

const kite = new KiteConnect({ api_key: process.env.KITE_API_KEY });
kite.setAccessToken(process.env.KITE_ACCESS_TOKEN);

async function test() {
  console.log('=== KITE LIVE TEST ===');
  console.log('API Key:', process.env.KITE_API_KEY);
  console.log('Token:', process.env.KITE_ACCESS_TOKEN ? 'Present (length ' + process.env.KITE_ACCESS_TOKEN.length + ')' : 'Missing');
  try {
    const profile = await kite.getProfile();
    console.log('Profile:', profile.user_name, '| Broker:', profile.broker);
    const ltp = await kite.getLTP(['NSE:RELIANCE']);
    console.log('LTP for RELIANCE:', ltp['NSE:RELIANCE'] ? ltp['NSE:RELIANCE'].last_price : 'No data');
    console.log('🎉 SUCCESS: Live connection and Quote permissions are ACTIVE!');
  } catch (err) {
    console.error('❌ FAILED:', err.message);
  }
}

test();
