# SatsConnect Fiat API Documentation

This document provides comprehensive documentation for the fiat on/off ramp API endpoints that enable KES ↔ BTC transactions through MPesa and airtime providers.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [MPesa Integration](#mpesa-integration)
- [Airtime Integration](#airtime-integration)
- [Webhooks](#webhooks)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Testing](#testing)

## Overview

The fiat API enables users to:
- Buy Bitcoin using MPesa STK Push
- Sell Bitcoin and receive KES via MPesa
- Buy airtime using Bitcoin
- Track transaction status
- Receive webhook notifications

All endpoints require JWT authentication and return JSON responses.

## Authentication

All fiat endpoints require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

## MPesa Integration

### Buy Bitcoin (KES → BTC)

**Endpoint:** `POST /api/fiat/mpesa/buy`

Initiates an MPesa STK Push to allow users to buy Bitcoin with KES.

#### Request Body

```json
{
  "phoneNumber": "254712345678",
  "amount": 1000,
  "walletId": "wallet_123",
  "accountReference": "SATS_123456",
  "transactionDesc": "Bitcoin Purchase"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phoneNumber` | string | Yes | Kenyan phone number (format: 254XXXXXXXXX) |
| `amount` | number | Yes | Amount in KES (1-150,000) |
| `walletId` | string | Yes | User's wallet ID |
| `accountReference` | string | No | Reference for the transaction (max 20 chars) |
| `transactionDesc` | string | No | Transaction description (max 20 chars) |

#### Response

```json
{
  "success": true,
  "data": {
    "transactionId": "fiat_1758929654955_gb2lhtoe2",
    "status": "pending",
    "message": "STK Push initiated. Please check your phone to complete the transaction."
  }
}
```

#### Example cURL

```bash
curl -X POST http://localhost:4000/api/fiat/mpesa/buy \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254712345678",
    "amount": 1000,
    "walletId": "wallet_123"
  }'
```

### Sell Bitcoin (BTC → KES)

**Endpoint:** `POST /api/fiat/mpesa/payout`

Initiates an MPesa payout to send KES to the user's phone number.

#### Request Body

```json
{
  "phoneNumber": "254712345678",
  "amount": 1000,
  "lightningInvoice": "lnbc1000n1p...",
  "accountReference": "SATS_123456",
  "transactionDesc": "Bitcoin Sale"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phoneNumber` | string | Yes | Kenyan phone number (format: 254XXXXXXXXX) |
| `amount` | number | Yes | Amount in KES (1-150,000) |
| `lightningInvoice` | string | Yes | Lightning invoice for Bitcoin payment |
| `accountReference` | string | No | Reference for the transaction (max 20 chars) |
| `transactionDesc` | string | No | Transaction description (max 20 chars) |

#### Response

```json
{
  "success": true,
  "data": {
    "transactionId": "fiat_1758929655073_4b52f50nt",
    "status": "pending",
    "message": "Payout initiated. Processing will begin shortly."
  }
}
```

## Airtime Integration

### Buy Airtime

**Endpoint:** `POST /api/fiat/airtime`

Purchases airtime using Bitcoin payment.

#### Request Body

```json
{
  "phoneNumber": "254712345678",
  "amount": 100,
  "provider": "safaricom",
  "lightningInvoice": "lnbc1000n1p...",
  "reference": "airtime_123456"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phoneNumber` | string | Yes | Kenyan phone number (format: 254XXXXXXXXX) |
| `amount` | number | Yes | Amount in KES (10-10,000) |
| `provider` | string | Yes | Airtime provider: `safaricom`, `airtel`, or `telkom` |
| `lightningInvoice` | string | Yes | Lightning invoice for Bitcoin payment |
| `reference` | string | No | Reference for the transaction (max 50 chars) |

#### Response

```json
{
  "success": true,
  "data": {
    "transactionId": "fiat_1758929655109_8on69h1t4",
    "status": "pending",
    "message": "Airtime purchase initiated. Processing will begin shortly."
  }
}
```

### Get Supported Providers

**Endpoint:** `GET /api/fiat/airtime/providers`

Returns list of supported airtime providers and their limits.

#### Response

```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "id": "safaricom",
        "name": "Safaricom",
        "minAmount": 10,
        "maxAmount": 10000,
        "currency": "KES"
      },
      {
        "id": "airtel",
        "name": "Airtel",
        "minAmount": 10,
        "maxAmount": 10000,
        "currency": "KES"
      },
      {
        "id": "telkom",
        "name": "Telkom",
        "minAmount": 10,
        "maxAmount": 10000,
        "currency": "KES"
      }
    ]
  }
}
```

## Transaction Status

### Get Transaction Status

**Endpoint:** `GET /api/fiat/transaction/:transactionId`

Retrieves the current status of a fiat transaction.

#### Response

```json
{
  "success": true,
  "data": {
    "transactionId": "fiat_1758929654955_gb2lhtoe2",
    "status": "completed",
    "progress": 100,
    "data": {
      "phoneNumber": "254712345678",
      "amount": 1000,
      "walletId": "wallet_123"
    },
    "failedReason": null,
    "returnValue": {
      "mpesaReceiptNumber": "QGH123456789",
      "amount": 1000
    }
  }
}
```

### Get MPesa Limits

**Endpoint:** `GET /api/fiat/mpesa/limits`

Returns MPesa transaction limits and requirements.

#### Response

```json
{
  "success": true,
  "data": {
    "buy": {
      "minAmount": 1,
      "maxAmount": 150000,
      "currency": "KES",
      "description": "MPesa STK Push limits for buying Bitcoin"
    },
    "payout": {
      "minAmount": 1,
      "maxAmount": 150000,
      "currency": "KES",
      "description": "MPesa payout limits for selling Bitcoin"
    }
  }
}
```

## Webhooks

### MPesa STK Push Callback

**Endpoint:** `POST /webhook/mpesa`

Receives callbacks from MPesa for STK Push transactions.

#### Headers

```http
x-mpesa-signature: <hmac-signature>
Content-Type: application/json
```

#### Request Body

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_27072017154747416",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 1000
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "QGH123456789"
          },
          {
            "Name": "TransactionDate",
            "Value": "20231201120000"
          },
          {
            "Name": "PhoneNumber",
            "Value": "254712345678"
          }
        ]
      }
    }
  }
}
```

#### Response

```json
{
  "success": true,
  "message": "Callback processed"
}
```

### Airtime Purchase Callback

**Endpoint:** `POST /webhook/airtime`

Receives callbacks from airtime providers for purchase confirmations.

#### Headers

```http
x-signature: <hmac-signature>
Content-Type: application/json
```

#### Request Body

```json
{
  "transactionId": "airtime_123456",
  "status": "success",
  "amount": 100,
  "phoneNumber": "254712345678",
  "provider": "safaricom",
  "message": "Airtime purchased successfully",
  "timestamp": "2023-12-01T12:00:00Z"
}
```

#### Response

```json
{
  "success": true,
  "message": "Callback processed"
}
```

### Webhook Health Check

**Endpoint:** `GET /webhook/health`

Checks the health of the webhook service.

#### Response

```json
{
  "success": true,
  "message": "Webhook service is healthy",
  "timestamp": "2023-12-01T12:00:00Z"
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error description",
  "details": [
    {
      "field": "phoneNumber",
      "message": "Valid Kenyan phone number required"
    }
  ]
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing JWT token |
| 404 | Not Found - Transaction or resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server-side error |

### Validation Errors

When validation fails, the response includes detailed field-specific errors:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "phoneNumber",
      "message": "Valid Kenyan phone number required"
    },
    {
      "field": "amount",
      "message": "Amount must be between 1 and 150,000 KES"
    }
  ]
}
```

## Rate Limits

- **General API**: 100 requests per 15 minutes per IP
- **Fiat Operations**: 10 requests per minute per user
- **Webhooks**: No rate limiting (internal use)

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Testing

### Sandbox Environment

For testing, use the MPesa sandbox environment:

```bash
# Set environment variables
export MPESA_ENVIRONMENT=sandbox
export MPESA_CONSUMER_KEY=your_sandbox_consumer_key
export MPESA_CONSUMER_SECRET=your_sandbox_consumer_secret
export MPESA_BUSINESS_SHORT_CODE=174379
export MPESA_PASSKEY=your_sandbox_passkey
```

### Test Phone Numbers

Use these test phone numbers for sandbox testing:

- `254708374149` - Success
- `254711111111` - User cancelled
- `254722222222` - Insufficient funds
- `254733333333` - Timeout

### Webhook Testing

Use ngrok to expose local webhooks for testing:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 4000

# Update webhook URLs
export MPESA_CALLBACK_URL=https://your-ngrok-url.ngrok.io/webhook/mpesa
export CHIMONEY_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/webhook/airtime
```

### Running Tests

```bash
# Run all fiat tests
npm test -- --testPathPattern="fiat"

# Run specific test suites
npm test -- --testPathPattern="mpesa"
npm test -- --testPathPattern="airtime"
npm test -- --testPathPattern="webhook"
```

## Security Considerations

1. **HMAC Validation**: All webhooks validate HMAC signatures
2. **Input Sanitization**: All inputs are sanitized and validated
3. **Rate Limiting**: Prevents abuse and DoS attacks
4. **JWT Authentication**: All endpoints require valid authentication
5. **Error Sanitization**: Sensitive data is never exposed in error messages
6. **Logging**: All transactions are logged for audit purposes

## Support

For issues or questions regarding the fiat API:

1. Check the logs in `logs/` directory
2. Verify environment configuration
3. Test with sandbox environment first
4. Contact the development team with transaction IDs for debugging
