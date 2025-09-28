# SatsConnect Architecture Documentation

## System Overview

SatsConnect is a non-custodial Bitcoin Lightning wallet with integrated MPesa fiat on/off ramp, designed specifically for the Kenyan market. The system follows a microservices architecture with three main components communicating via gRPC and REST APIs.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                SatsConnect Architecture                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐            │
│  │   Mobile App    │    │  Node.js API     │    │  Rust Engine    │            │
│  │  (React Native) │◄──►│  (Orchestrator)  │◄──►│  (Lightning)    │            │
│  │                 │    │                  │    │                 │            │
│  │ • Wallet UI     │    │ • REST API       │    │ • gRPC Server   │            │
│  │ • Biometric Auth│    │ • MPesa Bridge   │    │ • Lightning Node│            │
│  │ • QR Scanner    │    │ • Airtime API    │    │ • Bitcoin Core  │            │
│  │ • Secure Store  │    │ • JWT Auth       │    │ • Multi-peer    │            │
│  │ • PIN Protection│    │ • Rate Limiting  │    │ • Failover      │            │
│  └─────────────────┘    └──────────────────┘    └─────────────────┘            │
│           │                       │                       │                    │
│           │                       │                       │                    │
│           ▼                       ▼                       ▼                    │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐            │
│  │   MPesa API     │    │   Redis Queue    │    │  Lightning      │            │
│  │                 │    │                  │    │  Network        │            │
│  │ • STK Push      │    │ • Job Processing │    │                 │            │
│  │ • Callbacks     │    │ • Rate Limiting  │    │ • Peer Nodes    │            │
│  │ • Payouts       │    │ • Caching        │    │ • Channels      │            │
│  │ • B2C           │    │ • Session Store  │    │ • Routing       │            │
│  └─────────────────┘    └──────────────────┘    └─────────────────┘            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Mobile App (React Native)

**Purpose**: User interface and local wallet management

**Key Features**:
- Non-custodial wallet interface
- Biometric authentication (fingerprint/face ID)
- PIN protection with salted hashing
- QR code scanning and generation
- Secure local storage using Expo SecureStore
- Offline transaction signing capability

**Security Measures**:
- Private keys never leave the device
- Mnemonic phrases encrypted in device keychain
- Biometric authentication for sensitive operations
- PIN-based fallback authentication
- Certificate pinning for API communications

**Technology Stack**:
- React Native with TypeScript
- Expo for development and deployment
- Expo SecureStore for encrypted storage
- Expo LocalAuthentication for biometrics
- React Navigation for routing

### 2. Node.js Orchestrator

**Purpose**: REST API server and fiat integration bridge

**Key Features**:
- RESTful API for mobile app communication
- JWT-based authentication and authorization
- MPesa STK Push and B2C integration
- Airtime purchase with Bitcoin
- Webhook handling for payment callbacks
- Rate limiting and security middleware
- Job queue management with Redis

**Security Measures**:
- JWT tokens with short expiration
- Rate limiting per IP address
- Input validation and sanitization
- CORS configuration
- Security headers (Helmet.js)
- Request logging and monitoring

**Technology Stack**:
- Node.js with TypeScript
- Express.js framework
- JWT for authentication
- Redis for caching and job queues
- Axios for HTTP requests
- Express-validator for input validation

### 3. Rust Lightning Engine

**Purpose**: High-performance Lightning Network node

**Key Features**:
- Lightning Network protocol implementation
- Multi-peer support with automatic failover
- Bitcoin Core integration
- gRPC API for orchestrator communication
- Channel management and routing
- Payment processing and settlement

**Security Measures**:
- Secure key management
- Encrypted state persistence
- Peer authentication and validation
- Payment preimage verification
- Channel security protocols

**Technology Stack**:
- Rust for performance and safety
- Tonic for gRPC implementation
- Lightning Network libraries
- Bitcoin Core integration
- Tokio for async runtime

## Data Flow

### 1. User Onboarding
```
Mobile App → Node.js API → Rust Engine
     ↓            ↓           ↓
  Generate    Create User   Generate
  Mnemonic    Account      Lightning
  & Wallet    & JWT        Node
```

### 2. Buy Bitcoin with MPesa
```
Mobile App → Node.js API → MPesa API
     ↓            ↓           ↓
  Request     Validate    STK Push
  Purchase    & Queue     Payment
     ↓            ↓           ↓
  Show QR    Process     Callback
  Code       Payment     Handler
     ↓            ↓           ↓
  Update      Credit      Update
  Balance     Wallet      Status
```

### 3. Send Lightning Payment
```
Mobile App → Node.js API → Rust Engine
     ↓            ↓           ↓
  Scan QR     Validate    Process
  Code        Invoice     Payment
     ↓            ↓           ↓
  Confirm     Route to    Update
  Payment     Peer        Channel
     ↓            ↓           ↓
  Update      Update      Notify
  Balance     Status      Success
```

### 4. Sell Bitcoin for MPesa
```
Mobile App → Node.js API → Rust Engine
     ↓            ↓           ↓
  Request     Validate    Process
  Payout      Amount      Payment
     ↓            ↓           ↓
  Confirm     Queue       Debit
  Details     B2C         Wallet
     ↓            ↓           ↓
  Update      MPesa       Update
  Balance     Payout      Status
```

## Security Architecture

### Authentication Flow
1. User creates wallet with mnemonic
2. Mobile app generates JWT token
3. Token stored securely in device keychain
4. All API requests include JWT in Authorization header
5. Server validates JWT and extracts user context

### Data Encryption
- **At Rest**: Sensitive data encrypted in device keychain
- **In Transit**: All communications over HTTPS/TLS
- **In Memory**: Sensitive data cleared after use
- **Logs**: Sensitive data redacted in logs

### Key Management
- **Private Keys**: Generated and stored only on device
- **Mnemonic**: Encrypted in device keychain
- **API Keys**: Stored in environment variables
- **JWT Secrets**: Rotated regularly

## Scalability Considerations

### Horizontal Scaling
- **Mobile App**: Stateless, scales with user base
- **Node.js API**: Can be load balanced across multiple instances
- **Rust Engine**: Single instance per Lightning node
- **Redis**: Can be clustered for high availability

### Performance Optimization
- **Caching**: Redis for frequently accessed data
- **CDN**: Static assets served via CDN
- **Database**: Connection pooling and query optimization
- **Lightning**: Channel rebalancing and routing optimization

### Monitoring and Observability
- **Health Checks**: All services expose health endpoints
- **Metrics**: Prometheus-compatible metrics
- **Logging**: Structured JSON logs with correlation IDs
- **Tracing**: Distributed tracing across services

## Deployment Architecture

### Development Environment
- Local development with Docker Compose
- Hot reload for rapid development
- Mock services for external APIs

### Staging Environment
- Production-like configuration
- Real external API integrations
- Automated testing and validation

### Production Environment
- Kubernetes deployment
- Auto-scaling based on load
- Multi-region deployment
- Disaster recovery procedures

## API Contracts

### gRPC Services (Rust Engine)

#### Wallet Service
```protobuf
service WalletService {
  rpc CreateWallet(CreateWalletRequest) returns (CreateWalletResponse);
  rpc GetBalance(GetBalanceRequest) returns (GetBalanceResponse);
  rpc NewInvoice(NewInvoiceRequest) returns (NewInvoiceResponse);
  rpc SendPayment(SendPaymentRequest) returns (SendPaymentResponse);
}
```

#### Payment Service
```protobuf
service PaymentService {
  rpc ProcessPayment(PaymentRequest) returns (PaymentResponse);
  rpc GetPaymentStatus(PaymentStatusRequest) returns (PaymentResponse);
  rpc ProcessRefund(RefundRequest) returns (PaymentResponse);
  rpc PaymentStream(PaymentStreamRequest) returns (stream PaymentStreamResponse);
}
```

### REST API (Node.js Orchestrator)

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token

#### Wallet Operations
- `GET /api/wallet/balance` - Get balance
- `POST /api/wallet/invoice` - Generate invoice
- `POST /api/wallet/send` - Send payment
- `GET /api/wallet/transactions` - Transaction history

#### Fiat Integration
- `POST /api/fiat/mpesa/buy` - Buy Bitcoin
- `POST /api/fiat/mpesa/sell` - Sell Bitcoin
- `POST /api/fiat/airtime/buy` - Buy airtime
- `POST /api/fiat/bills/pay` - Pay bills

## Error Handling

### Mobile App
- User-friendly error messages
- Retry mechanisms for network failures
- Offline mode with queued operations
- Crash reporting and analytics

### Node.js API
- Structured error responses
- Request validation errors
- Rate limiting errors
- External service failures

### Rust Engine
- gRPC error codes and messages
- Lightning protocol errors
- Channel management errors
- Payment routing failures

## Future Enhancements

### Phase 1: Core Features (Complete)
- ✅ Basic Lightning wallet
- ✅ MPesa integration
- ✅ Airtime purchase
- ✅ Mobile app

### Phase 2: Enhanced Security (In Progress)
- 🔄 Hardware wallet support
- 🔄 Multi-signature wallets
- 🔄 Advanced biometrics
- 🔄 Transaction signing

### Phase 3: Advanced Features (Planned)
- 📋 Bill payment integration
- 📋 Multi-currency support
- 📋 Merchant tools
- 📋 API marketplace

### Phase 4: Scaling (Future)
- 📋 Multi-region deployment
- 📋 Advanced analytics
- 📋 Machine learning
- 📋 Enterprise features

## Conclusion

SatsConnect's architecture is designed for security, scalability, and user experience. The microservices approach allows for independent scaling and deployment of components, while the use of proven technologies ensures reliability and maintainability. The security-first design protects user funds and data, while the Lightning Network integration provides fast and low-cost Bitcoin transactions.

The system is production-ready and can handle the demands of the Kenyan market while providing a foundation for future expansion across Africa.
