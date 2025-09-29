# SatsConnect

A **non-custodial Bitcoin + Lightning wallet** with **MPesa fiat on/off ramp** for the African market. Built with Rust, Node.js, and React Native.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SatsConnect Architecture                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  │   Mobile App    │    │  Node.js         │    │  Rust Engine    │
│  │   (React Native)│◄──►│  Orchestrator    │◄──►│  (gRPC Server)  │
│  │                 │    │  (REST API)      │    │                 │
│  │ • Secure Store  │    │ • JWT Auth       │    │ • Wallet Logic  │
│  │ • Biometric     │    │ • Rate Limiting  │    │ • Lightning     │
│  │ • QR Scanner    │    │ • Input Validation│   │ • Key Management│
│  └─────────────────┘    └──────────────────┘    └─────────────────┘
│           │                       │                       │
│           │                       │                       │
│           ▼                       ▼                       ▼
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  │  Secure Storage │    │  Redis/BullMQ    │    │  Lightning      │
│  │  (Keychain)     │    │  (Queues)        │    │  Network        │
│  │                 │    │ • MPesa Jobs     │    │ • Bitcoin Core  │
│  │ • Private Keys  │    │ • Airtime Jobs   │    │ • LND Node      │
│  │ • Seed Phrases  │    │ • Webhook Jobs   │    │ • Channel Mgmt  │
│  └─────────────────┘    └──────────────────┘    └─────────────────┘
│                                │
│                                ▼
│                    ┌──────────────────┐
│                    │  MPesa + Airtime │
│                    │  (Fiat Bridge)   │
│                    │                  │
│                    │ • STK Push       │
│                    │ • B2C Payouts    │
│                    │ • Airtime API    │
│                    │ • Webhooks       │
│                    └──────────────────┘
│
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Onboarding**: Mobile app generates seed phrase → stored in Keychain
2. **Wallet Creation**: Mobile app → Node.js → Rust engine → Lightning node
3. **Buy Bitcoin**: Mobile app → Node.js → MPesa STK Push → Bitcoin received
4. **Send Bitcoin**: Mobile app → Node.js → Rust engine → Lightning payment
5. **Sell Bitcoin**: Mobile app → Node.js → MPesa B2C → Mobile money received

## 🚀 Features

### Core Wallet
- **Non-custodial**: User controls their private keys
- **Seed phrase backup**: 12-word mnemonic recovery
- **Bitcoin Lightning**: Instant, low-fee payments
- **QR code support**: Easy invoice generation and scanning
- **Biometric security**: Fingerprint/Face ID app lock

### Fiat Integration
- **MPesa STK Push**: Buy Bitcoin with mobile money
- **MPesa B2C Payouts**: Convert Bitcoin to mobile money
- **Airtime purchase**: Buy mobile airtime with Bitcoin
- **Real-time webhooks**: Instant transaction confirmations

### Security
- **JWT authentication**: Secure API access
- **Input validation**: All user inputs sanitized
- **Sensitive data redaction**: No secrets in logs
- **Rate limiting**: DDoS protection
- **Secure storage**: Keys stored in device keychain

## 🛠️ Tech Stack

### Backend
- **Rust Engine**: Core Lightning wallet logic (gRPC server)
- **Node.js Orchestrator**: REST API, authentication, rate limiting
- **Redis + BullMQ**: Queue management for async operations
- **Winston**: Structured logging with sensitive data redaction

### Mobile
- **React Native + Expo**: Cross-platform mobile app
- **TypeScript**: Type safety across all components
- **Expo SecureStore**: Secure key storage
- **Jest**: Comprehensive testing suite

### Infrastructure
- **Docker**: Containerized deployment
- **Nginx**: Reverse proxy and load balancing
- **Prometheus**: Monitoring and metrics
- **GitHub Actions**: CI/CD pipeline

## 📋 Prerequisites

- **Rust** 1.70+ (for Lightning engine)
- **Node.js** 18+ (for orchestrator)
- **Redis** 5.0+ (for queues)
- **Docker** (for containerized deployment)
- **Expo CLI** (for mobile development)
- **Protocol Buffers Compiler (protoc)** (for gRPC proto compilation)

### Install Protocol Buffers Compiler

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y protobuf-compiler
protoc --version  # Verify installation
```

**macOS:**
```bash
brew install protobuf
protoc --version  # Verify installation
```

**Windows:**
```bash
# Using Chocolatey
choco install protoc

# Or download from: https://github.com/protocolbuffers/protobuf/releases
```

**Alternative - Use Bundled protoc:**
The project includes a bundled protoc binary. Set the environment variable:
```bash
# Windows
set PROTOC=.\backend\rust-engine\protoc\bin\protoc.exe

# Linux/macOS
export PROTOC=./backend/rust-engine/protoc/bin/protoc
```

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/MWANGAZA-LAB/SatsConnect.git
cd SatsConnect
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend/node-orchestrator
npm install

# Install mobile dependencies
cd ../../mobile
npm install

# Install Rust dependencies
cd ../rust-engine
cargo build
```

### 3. Environment Setup
```bash
# Copy environment files
cp backend/node-orchestrator/env.example backend/node-orchestrator/.env
cp mobile/app.json.example mobile/app.json

# Edit configuration files with your settings
```

### 4. Start Services

#### Option A: Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Option B: Manual Start
```bash
# Terminal 1: Start Rust Engine
cd backend/rust-engine
cargo run --bin engine_server

# Terminal 2: Start Node.js Orchestrator
cd backend/node-orchestrator
npm start

# Terminal 3: Start Mobile App
cd mobile
npm start
```

### 5. Verify Installation
```bash
# Check health endpoints
curl http://localhost:4000/health/health
curl http://localhost:50051/health

# Test API endpoints
curl -X POST http://localhost:4000/api/wallet/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", "label": "test-wallet"}'
```

## 🔧 Configuration

### Environment Variables

#### Node.js Orchestrator (.env)
```bash
# Server
NODE_ENV=development
PORT=4000
HOST=0.0.0.0

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Rust Engine
RUST_ENGINE_ADDR=http://127.0.0.1:50051

# MPesa (Safaricom)
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_PASSKEY=your-passkey
MPESA_SHORTCODE=your-shortcode
MPESA_CALLBACK_URL=https://your-domain.com/webhook/mpesa

# Airtime (Chimoney)
CHIMONEY_API_KEY=your-chimoney-api-key
CHIMONEY_SUB_KEY=your-chimoney-sub-key
```

#### Mobile App (app.json)
```json
{
  "expo": {
    "name": "SatsConnect",
    "slug": "satsconnect",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "com.satsconnect.app"
    },
    "android": {
      "package": "com.satsconnect.app"
    }
  }
}
```

## 🧪 Testing

### Run All Tests
```bash
# Backend tests
cd backend/node-orchestrator
npm test

# Mobile tests
cd mobile
npm test

# Rust tests
cd backend/rust-engine
cargo test
```

### Test Coverage
```bash
# Generate coverage reports
cd backend/node-orchestrator
npm run test:coverage

cd mobile
npm run test:coverage
```

### End-to-End Testing
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run E2E tests
cd backend/node-orchestrator
npm run test:e2e
```

## 📱 Mobile App Development

### Development Mode
```bash
cd mobile
npm start

# Scan QR code with Expo Go app
# Or run on simulator
npm run ios
npm run android
```

### Building for Production
```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

## 🔒 Security Considerations

### Production Checklist
- [ ] Change all default secrets and keys
- [ ] Enable HTTPS/TLS encryption
- [ ] Configure proper CORS settings
- [ ] Set up rate limiting
- [ ] Enable request logging and monitoring
- [ ] Use secure key management (AWS KMS, HashiCorp Vault)
- [ ] Regular security audits and dependency updates

### Key Security Features
- **Non-custodial**: Users control their private keys
- **Secure storage**: Keys stored in device keychain
- **JWT authentication**: Stateless, secure API access
- **Input validation**: All inputs sanitized and validated
- **Sensitive data redaction**: No secrets logged
- **Rate limiting**: DDoS protection
- **Biometric authentication**: Device-level security

## 🚀 Deployment

### Docker Deployment
```bash
# Build images
docker-compose build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose up -d --scale node-orchestrator=3
```

### Manual Deployment
```bash
# Build Rust engine
cd backend/rust-engine
cargo build --release

# Build Node.js orchestrator
cd ../node-orchestrator
npm run build

# Start services with PM2
pm2 start ecosystem.config.js
```

## 📊 Monitoring

### Health Checks
- **Node.js Orchestrator**: `GET /health/health`
- **Rust Engine**: `GET /health` (gRPC)
- **Redis**: `redis-cli ping`

### Metrics
- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000`

### Logs
```bash
# View logs
docker-compose logs -f node-orchestrator
docker-compose logs -f rust-engine

# Or with PM2
pm2 logs
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Follow conventional commit messages
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/MWANGAZA-LAB/SatsConnect/wiki)
- **Issues**: [GitHub Issues](https://github.com/MWANGAZA-LAB/SatsConnect/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MWANGAZA-LAB/SatsConnect/discussions)

## 🗺️ Roadmap

### Phase 1: Core MVP ✅
- [x] Non-custodial Bitcoin wallet
- [x] Lightning Network integration
- [x] MPesa fiat on/off ramp
- [x] Mobile app with secure storage
- [x] Basic security features

### Phase 2: Enhanced Features 🚧
- [ ] Multi-currency support (USD, EUR, NGN)
- [ ] Advanced Lightning features (channels, routing)
- [ ] Merchant integration tools
- [ ] Advanced security (hardware wallet support)
- [ ] Offline transaction signing

### Phase 3: Scale & Enterprise 📋
- [ ] Enterprise dashboard
- [ ] Advanced analytics
- [ ] White-label solutions
- [ ] Regulatory compliance tools
- [ ] Multi-region deployment

## 🙏 Acknowledgments

- **Lightning Network**: For instant, low-fee Bitcoin payments
- **Rust Community**: For the excellent ecosystem and performance
- **React Native**: For cross-platform mobile development
- **Expo**: For the amazing development experience
- **MPesa**: For enabling mobile money integration in Africa

---

**Built with ❤️ for the African Bitcoin community**

*SatsConnect - Bringing Bitcoin to Africa, one transaction at a time.*
