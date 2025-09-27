# SatsConnect Node.js Orchestrator

A production-ready Node.js REST API orchestrator that bridges frontend/mobile clients with the Rust gRPC Lightning Engine.

## 🚀 Features

- **gRPC Integration**: Seamless communication with Rust Lightning Engine
- **REST API**: Clean, RESTful endpoints for wallet and payment operations
- **Fiat On/Off Ramp**: MPesa and airtime integrations for KES ↔ BTC transactions
- **Security**: JWT authentication, input validation, rate limiting, and security headers
- **Logging**: Comprehensive logging with Winston
- **Error Handling**: Graceful error handling and recovery
- **Queue System**: Async processing with BullMQ and Redis
- **Testing**: Unit and integration tests with Jest
- **Production Ready**: Docker support, health checks, and monitoring

## 📋 API Endpoints

### Wallet Operations
- `POST /api/wallet/create` - Create a new wallet
- `GET /api/wallet/balance/:id` - Get wallet balance
- `POST /api/wallet/invoice/new` - Create Lightning invoice
- `POST /api/wallet/payment/send` - Send Lightning payment
- `POST /api/wallet/airtime/buy` - Buy airtime (mock)

### Payment Operations
- `POST /api/payments/process` - Process payment
- `GET /api/payments/:id/status` - Get payment status
- `POST /api/payments/:id/refund` - Refund payment

### Fiat Operations (KES ↔ BTC)
- `POST /api/fiat/mpesa/buy` - Buy Bitcoin via MPesa STK Push
- `POST /api/fiat/mpesa/payout` - Sell Bitcoin to MPesa
- `POST /api/fiat/airtime` - Buy airtime with Bitcoin
- `GET /api/fiat/transaction/:id` - Get fiat transaction status
- `GET /api/fiat/airtime/providers` - Get supported airtime providers
- `GET /api/fiat/mpesa/limits` - Get MPesa transaction limits

### Webhooks
- `POST /webhook/mpesa` - MPesa STK Push callback
- `POST /webhook/airtime` - Airtime purchase callback
- `POST /webhook/mpesa/payout` - MPesa payout callback
- `GET /webhook/health` - Webhook service health check

### System
- `GET /health` - Health check
- `GET /` - API documentation

## 🛠️ Development Setup

### Prerequisites
- Node.js 20+ 
- npm or yarn
- Rust Engine running on port 50051

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd backend/node-orchestrator
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start the Rust Engine:**
   ```bash
   cd ../rust-engine
   cargo run --bin engine_server
   ```

4. **Start the orchestrator:**
   ```bash
   npm run dev
   ```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `NODE_ENV` | Environment | `development` |
| `RUST_ENGINE_GRPC_URL` | Rust engine gRPC URL | `127.0.0.1:50051` |
| `RUST_ENGINE_GRPC_USE_TLS` | Use TLS for gRPC | `false` |
| `JWT_SECRET` | JWT signing secret | `default-secret` |
| `JWT_EXPIRES_IN` | JWT expiration | `24h` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `LOG_LEVEL` | Logging level | `info` |
| `CORS_ORIGIN` | CORS origin | `http://localhost:3000` |

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Run specific test suites
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # With coverage report
```

### Test with Rust Engine
1. Start the Rust engine: `cargo run --bin engine_server`
2. Run integration tests: `npm run test:integration`

## 🚀 Production Deployment

### Docker

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

2. **Build individual service:**
   ```bash
   docker build -t satsconnect-orchestrator .
   docker run -p 4000:4000 satsconnect-orchestrator
   ```

### Manual Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start in production:**
   ```bash
   NODE_ENV=production npm start
   ```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:4000/health
```

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Console output in development

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Input Validation**: Comprehensive request validation
- **Security Headers**: Helmet.js security headers
- **Input Sanitization**: XSS and injection protection
- **Error Sanitization**: No sensitive data in error responses

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/REST    ┌──────────────────┐
│   Frontend/     │ ──────────────► │   Node.js        │
│   Mobile App    │                 │   Orchestrator   │
└─────────────────┘                 └──────────────────┘
                                             │
                                             │ gRPC
                                             ▼
                                    ┌──────────────────┐
                                    │   Rust Engine    │
                                    │   (Lightning)    │
                                    └──────────────────┘
                                             │
                                             │ HTTP/Webhooks
                                             ▼
                                    ┌──────────────────┐
                                    │   Fiat APIs      │
                                    │   (MPesa, etc.)  │
                                    └──────────────────┘
```

## 💰 Fiat On/Off Ramp Integration

### MPesa Integration

The orchestrator integrates with Safaricom's Daraja API to enable seamless KES ↔ BTC transactions:

#### MPesa STK Push (KES → BTC)
1. User initiates Bitcoin purchase via mobile app
2. System triggers MPesa STK Push to user's phone
3. User enters MPesa PIN to authorize payment
4. MPesa webhook confirms successful payment
5. System generates Lightning invoice and sends BTC to user's wallet

#### MPesa Payout (BTC → KES)
1. User initiates Bitcoin sale via mobile app
2. System processes Lightning payment
3. System triggers MPesa payout to user's phone number
4. User receives KES in their MPesa account

### Airtime Integration

Supports multiple airtime providers for buying airtime with Bitcoin:

- **Safaricom**: Kenya's largest mobile network
- **Airtel**: Major mobile network in Kenya
- **Telkom**: Alternative mobile network

#### Airtime Purchase Flow
1. User selects airtime provider and amount
2. System generates Lightning invoice
3. User pays with Bitcoin
4. System purchases airtime via provider API
5. User receives airtime on their phone

### Configuration

Set up your environment variables for fiat integrations:

```bash
# MPesa Daraja API Configuration
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_mpesa_passkey
MPESA_CALLBACK_URL=https://your-domain.com/webhook/mpesa
MPESA_ENVIRONMENT=sandbox

# Airtime Provider Configuration
AIRTIME_PROVIDER=chimoney
CHIMONEY_API_KEY=your_chimoney_api_key
CHIMONEY_SUB_KEY=your_chimoney_sub_key
CHIMONEY_WEBHOOK_URL=https://your-domain.com/webhook/airtime

# Redis Configuration (for BullMQ)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Queue Configuration
QUEUE_CONCURRENCY=5
QUEUE_RETRY_ATTEMPTS=3
```

### Testing Fiat Integrations

1. **Sandbox Testing**: Use MPesa sandbox environment for testing
2. **Mock Providers**: Airtime providers can be mocked for development
3. **Webhook Testing**: Use ngrok or similar tools to expose local webhooks

```bash
# Run fiat-specific tests
npm test -- --testPathPattern="fiat"

# Test MPesa integration
npm test -- --testPathPattern="mpesa"

# Test airtime integration
npm test -- --testPathPattern="airtime"
```

## 📁 Project Structure

```
src/
├── config/           # Configuration management
├── middleware/       # Express middleware
│   ├── auth.ts      # JWT authentication
│   ├── security.ts  # Security middleware
│   └── validation.ts # Request validation
├── routes/          # API routes
│   ├── walletRoutes.ts
│   ├── paymentRoutes.ts
│   ├── fiatRoutes.ts    # Fiat operations (MPesa, airtime)
│   └── webhookRoutes.ts # Webhook handlers
├── services/        # Business logic
│   ├── grpcClient.ts
│   ├── walletService.ts
│   ├── paymentService.ts
│   ├── mpesaService.ts  # MPesa Daraja API integration
│   ├── airtimeService.ts # Airtime provider integration
│   └── queueService.ts  # Async job processing
├── utils/           # Utilities
│   └── logger.ts
└── __tests__/       # Tests
    ├── unit/
    │   ├── fiatRoutes.test.ts
    │   ├── mpesaService.test.ts
    │   └── airtimeService.test.ts
    └── integration/
        └── fiatIntegration.test.ts
```

## 🔧 Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code

## 🤝 Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Run linting and tests before committing

## 📄 License

This project is part of the SatsConnect Lightning Network application.
