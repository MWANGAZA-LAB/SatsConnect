# SatsConnect Testing Guide

## Overview

This document describes the comprehensive testing strategy for SatsConnect, including unit tests, integration tests, and end-to-end tests for gRPC communication.

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test setup
├── e2e/
│   ├── grpcCommunication.test.ts    # Direct gRPC tests
│   └── restApiIntegration.test.ts   # REST API integration tests
└── unit/
    ├── services/
    │   ├── walletService.test.ts
    │   └── paymentService.test.ts
    └── routes/
        ├── walletRoutes.test.ts
        └── paymentRoutes.test.ts
```

## Test Types

### 1. End-to-End Tests (E2E)

**Purpose**: Test complete gRPC communication flow from Node.js to Rust engine.

**Files**:
- `grpcCommunication.test.ts` - Direct gRPC client tests
- `restApiIntegration.test.ts` - REST API to gRPC integration tests

**Coverage**:
- ✅ Wallet creation, balance, invoice generation
- ✅ Payment processing and status checking
- ✅ Error handling and validation
- ✅ Performance and concurrency
- ✅ Data validation and type safety

### 2. Unit Tests

**Purpose**: Test individual components in isolation.

**Coverage**:
- Service layer methods
- Route handlers
- Validation schemas
- Error handling utilities

### 3. Integration Tests

**Purpose**: Test component interactions within the Node.js application.

**Coverage**:
- Express middleware
- Route-to-service communication
- Database interactions (if applicable)

## Running Tests

### Prerequisites

1. **Rust Engine Running**:
   ```bash
   cd backend/rust-engine
   cargo run
   ```

2. **Dependencies Installed**:
   ```bash
   cd backend/node-orchestrator
   npm install
   ```

### Test Commands

```bash
# Run all tests
npm test

# Run only E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run E2E tests with custom script
node scripts/test-e2e.js
```

### Test Configuration

**Jest Configuration** (`jest.config.js`):
- TypeScript support with ESM
- 30-second timeout for E2E tests
- Coverage reporting
- Setup file for global configuration

## Test Scenarios

### Wallet Operations

1. **Create Wallet**
   - Valid mnemonic
   - Invalid mnemonic
   - Empty mnemonic (auto-generate)
   - Custom label

2. **Get Balance**
   - Before wallet creation (should fail)
   - After wallet creation (should succeed)
   - Concurrent requests

3. **Create Invoice**
   - Valid amount and memo
   - Invalid amount (negative)
   - Empty memo
   - Large amounts

4. **Send Payment**
   - Valid invoice
   - Invalid invoice format
   - Empty invoice
   - Expired invoice

### Payment Operations

1. **Process Payment**
   - Valid payment data
   - Invalid payment ID
   - Missing required fields
   - Duplicate payment ID

2. **Get Payment Status**
   - Existing payment
   - Non-existent payment
   - Invalid payment ID format

3. **Process Refund**
   - Valid refund amount
   - Invalid refund amount
   - Refund exceeding payment amount
   - Already refunded payment

4. **Stream Payments**
   - Valid wallet ID
   - Invalid wallet ID
   - With limit parameter
   - Without limit parameter

### Error Handling

1. **gRPC Errors**
   - Connection failures
   - Service unavailable
   - Invalid arguments
   - Failed precondition

2. **Validation Errors**
   - Invalid input types
   - Missing required fields
   - Out-of-range values
   - Malformed data

3. **Network Errors**
   - Timeout scenarios
   - Connection drops
   - Service restarts

## Performance Testing

### Concurrent Requests
- Multiple simultaneous wallet operations
- Parallel payment processing
- Load testing with 10+ concurrent requests

### Sequential Requests
- Rapid successive operations
- Memory usage monitoring
- Response time validation

### Stress Testing
- High-volume operations
- Extended runtime testing
- Resource cleanup validation

## Test Data

### Test Utilities (`testUtils`)

```typescript
// Generate consistent test data
const testData = testUtils.generateTestData();

// Wait for engine readiness
await testUtils.waitForEngine();
```

### Mock Data

- **Valid Mnemonic**: `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about`
- **Test Wallet**: Auto-generated with timestamp
- **Test Payments**: Unique IDs with timestamps
- **Mock Invoices**: Valid Lightning invoice format

## Debugging Tests

### Common Issues

1. **Engine Not Ready**
   ```
   Error: Rust Engine failed to start within 30 seconds
   ```
   **Solution**: Ensure Rust engine is running and accessible

2. **gRPC Connection Failed**
   ```
   Error: Failed to connect to engine
   ```
   **Solution**: Check engine address and port configuration

3. **Test Timeout**
   ```
   Error: Test timeout exceeded
   ```
   **Solution**: Increase timeout or optimize test performance

### Debug Mode

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- grpcCommunication.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create wallet"
```

## Coverage Reports

### Generating Coverage

```bash
npm test -- --coverage
```

### Coverage Targets

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Coverage Reports

- **Text**: Console output
- **HTML**: `coverage/index.html`
- **LCOV**: `coverage/lcov.info`

## Continuous Integration

### GitHub Actions

The CI pipeline automatically runs:
1. Unit tests
2. Integration tests
3. E2E tests (with Rust engine)
4. Coverage reporting
5. Security scanning

### Local CI Simulation

```bash
# Run full test suite
npm run test:ci

# Run with coverage
npm run test:coverage
```

## Best Practices

### Test Organization

1. **Descriptive Names**: Use clear, descriptive test names
2. **Single Responsibility**: Each test should test one thing
3. **Independent Tests**: Tests should not depend on each other
4. **Clean Setup**: Use proper setup and teardown

### Test Data

1. **Consistent Data**: Use the same test data across tests
2. **Realistic Data**: Use realistic values and formats
3. **Edge Cases**: Test boundary conditions and edge cases
4. **Error Cases**: Test both success and failure scenarios

### Performance

1. **Fast Tests**: Keep individual tests fast (< 1 second)
2. **Parallel Execution**: Use parallel test execution where possible
3. **Resource Cleanup**: Clean up resources after tests
4. **Timeout Management**: Set appropriate timeouts

## Troubleshooting

### Common Problems

1. **Port Conflicts**: Ensure ports 4000 and 50051 are available
2. **Permission Issues**: Check file permissions for test files
3. **Memory Issues**: Monitor memory usage during tests
4. **Network Issues**: Verify network connectivity for gRPC

### Getting Help

1. Check test logs for detailed error messages
2. Verify all dependencies are installed
3. Ensure Rust engine is running and accessible
4. Check Jest configuration and setup files

## Future Enhancements

### Planned Improvements

1. **Visual Testing**: Add visual regression tests
2. **Load Testing**: Implement comprehensive load testing
3. **Security Testing**: Add security-focused test scenarios
4. **Mobile Testing**: Integrate mobile app testing

### Test Automation

1. **Auto-retry**: Implement automatic retry for flaky tests
2. **Parallel Execution**: Optimize parallel test execution
3. **Test Selection**: Smart test selection based on changes
4. **Performance Monitoring**: Continuous performance monitoring
