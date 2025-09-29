const { generateToken } = require('./dist/middleware/auth');

// Create a test user
const testUser = {
  id: 'test_user_123',
  email: 'test@example.com',
  role: 'user',
};

// Generate token
const authToken = generateToken(testUser);
console.log('Test Auth Token:', authToken);

// Test the API
const axios = require('axios');

async function testAPI() {
  try {
    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:4000/health/health');
    console.log('Health Status:', healthResponse.data.status);
    console.log('gRPC Engine:', healthResponse.data.services.grpcEngine);

    // Test wallet creation
    console.log('\n2. Testing wallet creation...');
    const walletResponse = await axios.post('http://localhost:4000/api/wallet/create', {
      label: 'test_wallet',
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Wallet Created:', walletResponse.data);

    // Test balance
    console.log('\n3. Testing balance...');
    const balanceResponse = await axios.get('http://localhost:4000/api/wallet/balance', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('Balance:', balanceResponse.data);

    // Test invoice creation
    console.log('\n4. Testing invoice creation...');
    const invoiceResponse = await axios.post('http://localhost:4000/api/wallet/invoice', {
      amount_sats: 1000,
      memo: 'Test invoice'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Invoice Created:', invoiceResponse.data);

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAPI();
