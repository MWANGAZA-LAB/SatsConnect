# SatsConnect Mobile App

A non-custodial Bitcoin Lightning wallet mobile app built with React Native and Expo, designed for users in Kenya and Africa.

## Features

### 🔐 Non-Custodial Wallet
- **User-controlled keys**: You own your private keys and seed phrase
- **Secure storage**: Keys stored in device Keychain/SecureStore
- **Seed phrase backup**: 12-word recovery phrase for wallet restoration
- **Biometric authentication**: Optional fingerprint/face ID protection

### ⚡ Lightning Network
- **Instant payments**: Send and receive Bitcoin instantly
- **Low fees**: Minimal transaction costs via Lightning Network
- **QR code support**: Scan QR codes for payments and invoices
- **Invoice generation**: Create Lightning invoices for receiving payments

### 🇰🇪 African-Focused Features
- **Airtime purchase**: Buy mobile airtime for all Kenyan networks
- **Bill payments**: Pay utility bills (KPLC, water, DStv, etc.)
- **KES conversion**: Real-time Bitcoin to Kenyan Shilling conversion
- **Localized UI**: Designed for African users

### 📱 Modern Mobile Experience
- **Cross-platform**: Works on both iOS and Android
- **Offline-first**: Works without constant internet connection
- **Push notifications**: Real-time transaction updates
- **Dark/Light theme**: User preference support

## Tech Stack

- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and build tools
- **TypeScript**: Type-safe JavaScript
- **React Navigation**: Screen navigation
- **Expo SecureStore**: Secure key storage
- **Expo Local Authentication**: Biometric authentication
- **Expo Camera**: QR code scanning
- **React Native QRCode SVG**: QR code generation
- **Axios**: HTTP client for API communication

## Project Structure

```
mobile/
├── app/
│   ├── components/          # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── QRCode.tsx
│   │   ├── QRScanner.tsx
│   │   └── LoadingSpinner.tsx
│   ├── screens/             # App screens
│   │   ├── Onboarding.tsx
│   │   ├── Home.tsx
│   │   ├── Send.tsx
│   │   ├── Receive.tsx
│   │   ├── History.tsx
│   │   ├── Airtime.tsx
│   │   └── BillPayment.tsx
│   ├── services/            # Business logic
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   ├── walletService.ts
│   │   └── secureStorage.ts
│   ├── theme/               # Design system
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── index.ts
│   └── App.tsx              # Main app component
├── package.json
├── tsconfig.json
├── app.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on device/simulator**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   ```

### Environment Setup

Create a `.env` file in the mobile directory:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_APP_NAME=SatsConnect
EXPO_PUBLIC_APP_VERSION=1.0.0
```

## Usage

### First Time Setup

1. **Launch the app** - You'll see the onboarding flow
2. **Read the non-custodial explanation** - Understand how the wallet works
3. **Generate seed phrase** - Write down your 12-word recovery phrase
4. **Confirm seed phrase** - Verify you've saved it correctly
5. **Accept disclaimer** - Understand the risks and responsibilities
6. **Complete setup** - Your wallet is now ready to use

### Using the Wallet

#### Home Screen
- **View balance**: See your Bitcoin balance in sats and KES
- **Quick actions**: Send, receive, buy airtime, pay bills
- **Recent transactions**: View your latest activity
- **Toggle balance visibility**: Hide/show your balance for privacy

#### Sending Bitcoin
1. Tap "Send" on the home screen
2. Scan a QR code or paste a Lightning invoice
3. Add optional amount and description
4. Confirm and send the payment

#### Receiving Bitcoin
1. Tap "Receive" on the home screen
2. Enter amount in sats
3. Add optional memo
4. Share the QR code or invoice with the sender

#### Buying Airtime
1. Tap "Airtime" on the home screen
2. Enter phone number (Kenyan format)
3. Select network provider
4. Choose amount or enter custom amount
5. Confirm purchase

#### Paying Bills
1. Tap "Pay Bill" on the home screen
2. Select bill type (KPLC, water, DStv, etc.)
3. Enter account number
4. Enter amount
5. Confirm payment

#### Transaction History
1. Tap "History" on the home screen
2. Filter by transaction type
3. Tap any transaction for details
4. Pull down to refresh

## Security Features

### Key Management
- **Seed phrase**: 12-word BIP39 mnemonic for wallet recovery
- **Secure storage**: Keys stored in device Keychain/SecureStore
- **No cloud backup**: Keys never leave your device
- **Local encryption**: All sensitive data encrypted locally

### Authentication
- **Biometric login**: Optional fingerprint/face ID
- **PIN fallback**: Alternative authentication method
- **Auto-lock**: App locks after inactivity
- **Secure session**: JWT tokens for API authentication

### Privacy
- **No tracking**: No user data collection
- **Local storage**: All data stored locally
- **Encrypted communication**: All API calls use HTTPS
- **No analytics**: No usage tracking or analytics

## API Integration

The mobile app connects to the SatsConnect Node.js Orchestrator (Phase 2) via REST API:

### Endpoints Used
- `POST /api/wallet/create` - Create new wallet
- `GET /api/wallet/balance/:id` - Get wallet balance
- `POST /api/wallet/invoice/new` - Generate Lightning invoice
- `POST /api/wallet/payment/send` - Send Lightning payment
- `POST /api/wallet/airtime/buy` - Purchase airtime
- `POST /api/payments/process` - Process payment
- `GET /api/payments/:id/status` - Get payment status

### Error Handling
- **Network errors**: Graceful fallback and retry logic
- **API errors**: User-friendly error messages
- **Validation errors**: Form validation with helpful hints
- **Offline mode**: Basic functionality without internet

## Development

### Code Structure

#### Components
- **Reusable**: All components are modular and reusable
- **TypeScript**: Fully typed with proper interfaces
- **Theme-aware**: All components use the design system
- **Accessible**: Proper accessibility labels and navigation

#### Services
- **Separation of concerns**: Business logic separated from UI
- **State management**: Centralized state with subscriptions
- **Error handling**: Comprehensive error handling and logging
- **Testing**: Unit tests for all service functions

#### Screens
- **Navigation**: Proper navigation flow and back handling
- **State management**: Local state with service integration
- **Loading states**: Proper loading and error states
- **User feedback**: Clear feedback for all user actions

### Testing

Run the test suite:

```bash
# Unit tests
npm test

# Test coverage
npm run test:coverage

# E2E tests (when implemented)
npm run test:e2e
```

### Building for Production

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android

# Build for both platforms
expo build:all
```

## Deployment

### App Store Submission

1. **Build production app**
   ```bash
   expo build:ios --type archive
   expo build:android --type apk
   ```

2. **Upload to stores**
   - iOS: Upload to App Store Connect
   - Android: Upload to Google Play Console

3. **Configure app settings**
   - Set up push notifications
   - Configure deep linking
   - Set up analytics (if needed)

### Environment Configuration

Update environment variables for production:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.satsconnect.com
EXPO_PUBLIC_APP_NAME=SatsConnect
EXPO_PUBLIC_APP_VERSION=1.0.0
```

## Troubleshooting

### Common Issues

#### App won't start
- Check if all dependencies are installed
- Clear Expo cache: `expo start -c`
- Restart Metro bundler

#### API connection issues
- Verify the backend is running
- Check network connectivity
- Verify API URL in environment variables

#### QR code scanning not working
- Grant camera permissions
- Ensure good lighting
- Try different QR code formats

#### Biometric authentication issues
- Check if biometrics are enabled on device
- Verify biometric enrollment
- Try PIN fallback

### Debug Mode

Enable debug logging:

```bash
# Start with debug logging
EXPO_DEBUG=true expo start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow the existing component patterns
- Use the design system for styling
- Write comprehensive tests
- Document all public APIs

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

## Roadmap

### Phase 3 (Current)
- ✅ Basic wallet functionality
- ✅ Lightning Network integration
- ✅ Airtime and bill payments
- ✅ QR code scanning and generation
- ✅ Secure storage and authentication

### Phase 4 (Future)
- [ ] Advanced Lightning features
- [ ] Multi-currency support
- [ ] Advanced security features
- [ ] Offline transaction signing
- [ ] Hardware wallet integration
- [ ] Advanced analytics and reporting

---

**Built with ❤️ for the African Bitcoin community**
