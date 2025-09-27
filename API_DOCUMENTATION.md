# SatsConnect API Documentation

## Overview

SatsConnect is a non-custodial Lightning Network wallet system with the following architecture:

- **Rust Engine**: Core Lightning functionality (gRPC server)
- **Node.js Orchestrator**: REST API layer (Express server)
- **React Native Mobile App**: Frontend interface

## Base URL

```
http://localhost:4000
```

## Authentication

Currently, the API does not require authentication. In production, implement JWT or API key authentication.

## Error Handling

All API responses follow this format:

```json
{
  "success": boolean,
  "error"?: string,
  "code"?: number,
  "data"?: object,
  "message"?: string
}
```

## Endpoints

### Health Check

#### GET /health

Check the health status of all services.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "nodeOrchestrator": "healthy",
    "rustEngine": "healthy"
  }
}
```

---

## Wallet API

### Create Wallet

#### POST /api/wallet/create

Create a new Lightning wallet.

**Request Body:**
```json
{
  "mnemonic"?: string,
  "label"?: string
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet created successfully",
  "data": {
    "nodeId": "02a1b2c3d4e5f6...",
    "address": "bc1q...",
    "message": "Wallet created successfully"
  }
}
```

### Get Balance

#### GET /api/wallet/balance

Get the current wallet balance.

**Response:**
```json
{
  "success": true,
  "data": {
    "onchainSats": 100000,
    "lightningSats": 50000,
    "totalSats": 150000
  }
}
```

### Create Invoice

#### POST /api/wallet/invoice

Create a new Lightning invoice for receiving payments.

**Request Body:**
```json
{
  "amountSats": 1000,
  "memo"?: "Payment for services"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "invoice": "lnbc10u1p...",
    "paymentHash": "abc123...",
    "amountSats": 1000
  }
}
```

### Send Payment

#### POST /api/wallet/send

Send a Lightning payment.

**Request Body:**
```json
{
  "invoice": "lnbc10u1p..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment sent successfully",
  "data": {
    "paymentHash": "abc123...",
    "status": "PENDING",
    "invoice": "lnbc10u1p..."
  }
}
```

### Buy Airtime

#### POST /api/wallet/buy-airtime

Create an invoice for airtime purchase (mock implementation).

**Request Body:**
```json
{
  "amountSats": 5000,
  "phoneNumber": "+1234567890",
  "provider"?: "MTN"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Airtime purchase initiated",
  "data": {
    "invoice": "lnbc50u1p...",
    "paymentHash": "def456...",
    "amountSats": 5000,
    "phoneNumber": "+1234567890",
    "provider": "MTN"
  }
}
```

---

## Payment API

### Process Payment

#### POST /api/payments/process

Process a payment transaction.

**Request Body:**
```json
{
  "paymentId": "pay_123",
  "walletId": "wallet_456",
  "amountSats": 1000,
  "invoice": "lnbc10u1p...",
  "description"?: "Payment description"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "paymentId": "pay_123",
    "status": "PENDING",
    "amountSats": 1000,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Payment Status

#### GET /api/payments/:paymentId/status

Get the status of a specific payment.

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_123",
    "status": "COMPLETED",
    "amountSats": 1000,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z",
    "description": "Payment description"
  }
}
```

### Process Refund

#### POST /api/payments/:paymentId/refund

Process a refund for a payment.

**Request Body:**
```json
{
  "amountSats": 500
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "paymentId": "pay_123",
    "status": "REFUNDED",
    "refundAmountSats": 500,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### Stream Payments

#### GET /api/payments/stream/:walletId

Get a stream of payments for a specific wallet.

**Query Parameters:**
- `limit` (optional): Maximum number of payments to return

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "paymentId": "pay_123",
        "status": "COMPLETED",
        "amountSats": 1000,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:35:00.000Z",
        "description": "Payment description"
      }
    ],
    "count": 1
  }
}
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Invalid request data |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

## gRPC Error Codes

| Code | Description |
|------|-------------|
| 9 | Failed Precondition (e.g., wallet not initialized) |
| 5 | Not Found |
| 3 | Invalid Argument |
| 2 | Unknown Error |

## Rate Limiting

Currently no rate limiting is implemented. In production, implement rate limiting to prevent abuse.

## WebSocket Support

WebSocket support for real-time updates is planned but not yet implemented.

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **Authentication**: Implement proper authentication
3. **Rate Limiting**: Implement rate limiting
4. **Input Validation**: All inputs are validated using Zod schemas
5. **Error Handling**: Sensitive information is not exposed in error messages

## Development Setup

1. Start the Rust engine:
   ```bash
   cd backend/rust-engine
   cargo run
   ```

2. Start the Node.js orchestrator:
   ```bash
   cd backend/node-orchestrator
   npm run dev
   ```

3. Test the API:
   ```bash
   curl http://localhost:4000/health
   ```

## Testing

Use the provided Postman collection or curl commands to test the API endpoints.

## Support

For issues or questions, please refer to the project documentation or create an issue in the repository.
