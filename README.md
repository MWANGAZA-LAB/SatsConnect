# SatsConnect - Bitcoin Lightning Wallet with MPesa Integration

[![CI/CD Pipeline](https://github.com/MWANGAZA-LAB/SatsConnect/actions/workflows/ci.yml/badge.svg)](https://github.com/MWANGAZA-LAB/SatsConnect/actions/workflows/ci.yml)
[![Security Audit](https://github.com/MWANGAZA-LAB/SatsConnect/actions/workflows/security.yml/badge.svg)](https://github.com/MWANGAZA-LAB/SatsConnect/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**SatsConnect** is a non-custodial Bitcoin Lightning wallet with integrated MPesa fiat on/off ramp, designed for the Kenyan market. Users can seamlessly buy Bitcoin with MPesa, send Lightning payments, and convert Bitcoin back to MPesa or airtime.

## 🏗️ Architecture Overview

SatsConnect follows a microservices architecture with three main components:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │    │  Node.js API     │    │  Rust Engine    │
│  (React Native) │◄──►│  (Orchestrator)  │◄──►│  (Lightning)    │
│                 │    │                  │    │                 │
│ • Wallet UI     │    │ • REST API       │    │ • gRPC Server   │
│ • Biometric Auth│    │ • MPesa Bridge   │    │ • Lightning Node│
│ • QR Scanner    │    │ • Airtime API    │    │ • Bitcoin Core  │
│ • Secure Store  │    │ • JWT Auth       │    │ • Multi-peer    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MPesa API     │    │   Redis Queue    │    │  Lightning      │
│                 │    │                  │    │  Network        │
│ • STK Push      │    │ • Job Processing │    │                 │
│ • Callbacks     │    │ • Rate Limiting  │    │ • Peer Nodes    │
│ • Payouts       │    │ • Caching        │    │ • Channels      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Features

### Core Wallet Features
- **Non-custodial**: Users control their private keys
- **Lightning Network**: Fast, low-cost Bitcoin transactions
- **Multi-peer Support**: Automatic failover for reliability
- **Biometric Security**: Fingerprint/Face ID authentication
- **PIN Protection**: Secure PIN with salted hashing
- **QR Code Support**: Easy payment scanning and generation

### Fiat Integration
- **MPesa Buy Bitcoin**: Convert KES to BTC via STK Push
- **MPesa Payouts**: Convert BTC to KES via B2C
- **Airtime Purchase**: Buy airtime with Bitcoin
- **Bill Payments**: Pay utilities with Bitcoin (coming soon)

### Security Features
- **Secure Storage**: Sensitive data encrypted in device keychain
- **JWT Authentication**: Secure API access tokens
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive request sanitization
- **Audit Logging**: Complete transaction and security logs

## 🛠️ Tech Stack

### Backend
- **Rust Engine**: High-performance Lightning node implementation
- **Node.js Orchestrator**: Express.js REST API with TypeScript
- **gRPC**: Inter-service communication
- **Redis**: Job queue and caching
- **PostgreSQL**: Transaction and user data storage

### Mobile App
- **React Native**: Cross-platform mobile development
- **Expo**: Development and deployment platform
- **TypeScript**: Type-safe JavaScript
- **Expo SecureStore**: Encrypted local storage
- **Expo LocalAuthentication**: Biometric authentication

### Infrastructure
- **Docker**: Containerized deployment
- **GitHub Actions**: CI/CD pipeline
- **Trivy**: Security vulnerability scanning
- **CodeQL**: Static code analysis

## 📋 Prerequisites

- **Rust**: 1.81.0 or later
- **Node.js**: 20.x or later
- **npm**: 10.x or later
- **Docker**: 24.x or later
- **Expo CLI**: Latest version
- **Redis**: 7.x or later
- **PostgreSQL**: 15.x or later

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/MWANGAZA-LAB/SatsConnect.git
cd SatsConnect
```

### 2. Environment Setup
```bash
# Copy environment files
cp backend/node-orchestrator/.env.example backend/node-orchestrator/.env
cp mobile/.env.example mobile/.env

# Edit configuration files with your API keys
```

### 3. Start Services with Docker
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

### 4. Manual Development Setup

#### Rust Engine
```bash
cd backend/rust-engine
cargo build --release
cargo test
./target/release/rust-engine
```

#### Node.js Orchestrator
```bash
cd backend/node-orchestrator
npm install
npm run build
npm start
```

#### Mobile App
```bash
cd mobile
npm install
npx expo start
```

## 🔧 Configuration

### Environment Variables

#### Node.js Orchestrator (.env)
```env
# Server Configuration
PORT=4000
NODE_ENV=development
LOG_LEVEL=info

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/satsconnect

# MPesa Configuration
MPESA_CONSUMER_KEY=your-mpesa-consumer-key
MPESA_CONSUMER_SECRET=your-mpesa-consumer-secret
MPESA_PASSKEY=your-mpesa-passkey
MPESA_SHORTCODE=your-mpesa-shortcode
MPESA_CALLBACK_URL=https://your-domain.com/api/webhooks/mpesa

# Airtime Configuration
CHIMONEY_API_KEY=your-chimoney-api-key
CHIMONEY_SUB_KEY=your-chimoney-sub-key

# gRPC Configuration
GRPC_ENGINE_URL=localhost:50051
```

#### Mobile App (.env)
```env
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_APP_NAME=SatsConnect
EXPO_PUBLIC_APP_VERSION=1.0.0
```

## 🔒 Security Considerations

### Data Protection
- **Private Keys**: Never transmitted, stored only in device keychain
- **Mnemonic Phrases**: Encrypted with device-specific keys
- **API Keys**: Stored securely in environment variables
- **Sensitive Data**: Redacted in logs and error messages

### Authentication & Authorization
- **JWT Tokens**: Short-lived with secure signing
- **Biometric Auth**: Device-native security
- **PIN Protection**: Salted SHA-256 hashing
- **Rate Limiting**: Per-IP request throttling

### Network Security
- **HTTPS Only**: All API communications encrypted
- **Certificate Pinning**: Mobile app validates server certificates
- **Input Validation**: Comprehensive request sanitization
- **CORS Configuration**: Restricted to trusted origins

## 🧪 Testing

### Run All Tests
```bash
# Backend tests
cd backend/rust-engine && cargo test
cd backend/node-orchestrator && npm test

# Mobile app tests
cd mobile && npm test

# Integration tests
npm run test:e2e
```

### Security Audits
```bash
# Rust security audit
cd backend/rust-engine && cargo audit

# Node.js security audit
cd backend/node-orchestrator && npm audit

# Mobile app security audit
cd mobile && npm audit
```

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Wallet Endpoints
- `GET /api/wallet/balance` - Get wallet balance
- `POST /api/wallet/invoice` - Generate Lightning invoice
- `POST /api/wallet/send` - Send Lightning payment
- `GET /api/wallet/transactions` - Get transaction history

### Fiat Integration Endpoints
- `POST /api/fiat/mpesa/buy` - Buy Bitcoin with MPesa
- `POST /api/fiat/mpesa/sell` - Sell Bitcoin for MPesa
- `POST /api/fiat/airtime/buy` - Buy airtime with Bitcoin
- `POST /api/fiat/bills/pay` - Pay bills with Bitcoin

### Webhook Endpoints
- `POST /api/webhooks/mpesa` - MPesa payment callbacks
- `POST /api/webhooks/airtime` - Airtime purchase callbacks

## 🚀 Deployment

### Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec node-orchestrator npm run migrate:prod
```

### Environment-Specific Configuration
- **Development**: Local development with hot reload
- **Staging**: Pre-production testing environment
- **Production**: Live environment with monitoring

## 📈 Monitoring & Logging

### Health Checks
- **Rust Engine**: `GET /health` - Engine status and peer connectivity
- **Node.js API**: `GET /api/health` - API status and dependencies
- **Mobile App**: Built-in crash reporting and analytics

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: DEBUG, INFO, WARN, ERROR
- **Security Events**: Authentication failures, suspicious activity
- **Transaction Logs**: Complete audit trail

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
- Follow security guidelines
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/MWANGAZA-LAB/SatsConnect/wiki)
- **Issues**: [GitHub Issues](https://github.com/MWANGAZA-LAB/SatsConnect/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MWANGAZA-LAB/SatsConnect/discussions)
- **Email**: support@satsconnect.africa

## 🗺️ Roadmap

### Phase 1: Core Wallet (✅ Complete)
- [x] Rust Lightning Engine
- [x] Node.js Orchestrator API
- [x] React Native Mobile App
- [x] Basic Lightning payments

### Phase 2: Fiat Integration (✅ Complete)
- [x] MPesa STK Push integration
- [x] MPesa B2C payouts
- [x] Airtime purchase with Bitcoin
- [x] Webhook handling

### Phase 3: Enhanced Features (🔄 In Progress)
- [ ] Bill payment integration
- [ ] Multi-currency support
- [ ] Advanced security features
- [ ] Offline transaction signing

### Phase 4: Scaling (📋 Planned)
- [ ] Multi-region deployment
- [ ] Advanced analytics
- [ ] Merchant integration
- [ ] API marketplace

## 🙏 Acknowledgments

- **Lightning Network**: For enabling fast Bitcoin payments
- **MPesa**: For providing fiat on/off ramp
- **Expo**: For mobile development platform
- **Rust Community**: For excellent tooling and ecosystem
- **Node.js Community**: For robust backend infrastructure

---

**Built with ❤️ for the African Bitcoin community**

*SatsConnect - Bringing Bitcoin to Africa, one sat at a time*