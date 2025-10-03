# 📱 SatsConnect Expo Go Testing Guide

## 🚀 Services Started

I've started all the necessary services for testing SatsConnect on Expo Go:

### ✅ **Services Running:**
1. **Expo Development Server** - Mobile app development server
2. **Node.js Orchestrator** - REST API server (Port 4000)
3. **Rust Lightning Engine** - gRPC server (Port 50051)

---

## 📱 **Testing on Expo Go**

### **Step 1: Install Expo Go**
1. Download **Expo Go** from:
   - **iOS**: App Store
   - **Android**: Google Play Store

### **Step 2: Connect to Development Server**
1. **Scan QR Code**: Look for the QR code in your terminal
2. **Or use URL**: The Expo server should show a URL like `exp://192.168.x.x:8081`
3. **Open in Expo Go**: Scan the QR code or enter the URL

### **Step 3: Test SatsConnect Features**

#### **🔐 Wallet Creation & Security**
- **Create New Wallet**: Test wallet creation with mnemonic generation
- **Import Wallet**: Test wallet import with existing mnemonic
- **Biometric Auth**: Test fingerprint/face ID authentication
- **PIN Protection**: Test PIN-based authentication

#### **⚡ Lightning Network Features**
- **Generate Invoice**: Create Lightning payment invoices
- **Send Payment**: Test Lightning payment sending
- **Receive Payment**: Test Lightning payment receiving
- **QR Code Scanner**: Test QR code scanning for payments

#### **💰 MPesa Integration**
- **Buy Bitcoin**: Test MPesa STK Push for Bitcoin purchase
- **Sell Bitcoin**: Test Bitcoin to MPesa conversion
- **Airtime Purchase**: Test airtime purchase with Bitcoin
- **Exchange Rates**: Test real-time exchange rate updates

#### **🔒 Security Features**
- **Secure Storage**: Test encrypted data storage
- **Key Management**: Test secure key handling
- **Transaction History**: Test transaction logging
- **Error Handling**: Test error scenarios

---

## 🧪 **Test Scenarios**

### **Scenario 1: New User Onboarding**
1. Open SatsConnect app
2. Create new wallet
3. Set up biometric authentication
4. Generate test Lightning invoice
5. Verify wallet balance display

### **Scenario 2: Lightning Payments**
1. Generate a Lightning invoice
2. Copy invoice or show QR code
3. Test payment flow (simulated)
4. Verify transaction history
5. Test error handling

### **Scenario 3: Security Testing**
1. Test biometric authentication
2. Test PIN fallback
3. Test secure storage
4. Test app backgrounding/foregrounding
5. Test data persistence

### **Scenario 4: MPesa Integration (Simulated)**
1. Test Bitcoin purchase flow
2. Test exchange rate display
3. Test airtime purchase
4. Test transaction confirmation
5. Test error handling

---

## 🔧 **Troubleshooting**

### **If Expo Go Can't Connect:**
1. **Check Network**: Ensure device and computer are on same WiFi
2. **Firewall**: Check Windows Firewall settings
3. **Port Access**: Ensure ports 8081, 4000, 50051 are accessible
4. **Restart Services**: Restart Expo development server

### **If Backend Services Fail:**
1. **Check Logs**: Look at terminal output for errors
2. **Dependencies**: Ensure all dependencies are installed
3. **Ports**: Check if ports are already in use
4. **Environment**: Verify environment variables are set

### **If Mobile App Crashes:**
1. **Check Logs**: Look at Expo logs for errors
2. **Restart App**: Close and reopen Expo Go
3. **Clear Cache**: Clear Expo Go cache
4. **Restart Development Server**: Restart Expo server

---

## 📊 **Expected Behavior**

### **✅ Successful Tests Should Show:**
- Smooth app navigation
- Responsive UI interactions
- Secure authentication flows
- Proper error handling
- Real-time data updates
- Smooth Lightning operations

### **⚠️ Known Limitations in Development:**
- MPesa integration requires real API keys
- Lightning payments are simulated
- Some features may show mock data
- Network calls may timeout in development

---

## 🎯 **Testing Checklist**

### **Core Functionality:**
- [ ] App launches successfully
- [ ] Wallet creation works
- [ ] Biometric authentication works
- [ ] PIN authentication works
- [ ] Lightning invoice generation works
- [ ] QR code scanning works
- [ ] Transaction history displays
- [ ] Settings are accessible

### **Security Features:**
- [ ] Secure storage works
- [ ] Authentication flows work
- [ ] Error handling is proper
- [ ] Data persistence works
- [ ] App security is maintained

### **User Experience:**
- [ ] UI is responsive
- [ ] Navigation is smooth
- [ ] Loading states are shown
- [ ] Error messages are clear
- [ ] Success feedback is provided

---

## 🚀 **Next Steps After Testing**

1. **Report Issues**: Document any bugs or issues found
2. **Performance Notes**: Note any performance issues
3. **User Experience**: Provide feedback on UX
4. **Feature Requests**: Suggest improvements
5. **Production Readiness**: Confirm readiness for production

---

## 📞 **Support**

If you encounter any issues during testing:

1. **Check Logs**: Look at terminal output for error messages
2. **Restart Services**: Try restarting the development servers
3. **Clear Cache**: Clear Expo Go cache and restart
4. **Network Issues**: Ensure proper network connectivity
5. **Document Issues**: Note specific error messages and steps to reproduce

---

**🎉 Happy Testing! SatsConnect is ready for comprehensive testing on Expo Go!**

*This testing guide was generated to help you thoroughly test all SatsConnect features on your mobile device using Expo Go.*
