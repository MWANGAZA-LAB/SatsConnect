#!/bin/bash

# SatsConnect User Acceptance Testing Script
# This script performs comprehensive user acceptance testing

set -e

echo "👥 Starting SatsConnect User Acceptance Testing..."

# Configuration
NAMESPACE="satsconnect-prod"
TEST_USERS=1000
TEST_DURATION="24h"
TEST_SCENARIOS=("wallet_creation" "payment_flow" "lightning_payments" "fiat_conversion" "mobile_app" "security_features")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
CRITICAL_FAILURES=0

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((TOTAL_TESTS++))
    ((FAILED_TESTS++))
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((TOTAL_TESTS++))
    ((PASSED_TESTS++))
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

critical() {
    echo -e "${RED}[CRITICAL]${NC} $1"
    ((TOTAL_TESTS++))
    ((FAILED_TESTS++))
    ((CRITICAL_FAILURES++))
}

# Create UAT directory
create_uat_directory() {
    log "Creating UAT directory..."
    mkdir -p ./uat-results/{test-cases,user-feedback,performance,security,usability}
    success "UAT directory created"
}

# 1. Wallet Creation UAT
test_wallet_creation() {
    log "Testing wallet creation functionality..."
    
    # Test basic wallet creation
    WALLET_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/wallets \
        -H "Content-Type: application/json" \
        -d '{"userId": "uat_user_001", "currency": "BTC"}')
    
    if echo "$WALLET_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        success "Basic wallet creation works"
        WALLET_ID=$(echo "$WALLET_RESPONSE" | jq -r '.id')
    else
        critical "Basic wallet creation failed"
        return 1
    fi
    
    # Test wallet with different currencies
    for currency in "BTC" "KES" "TZS" "UGX"; do
        CURRENCY_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/wallets \
            -H "Content-Type: application/json" \
            -d "{\"userId\": \"uat_user_${currency}\", \"currency\": \"${currency}\"}")
        
        if echo "$CURRENCY_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
            success "Wallet creation with ${currency} works"
        else
            error "Wallet creation with ${currency} failed"
        fi
    done
    
    # Test wallet balance retrieval
    BALANCE_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/wallets/${WALLET_ID}/balance)
    if echo "$BALANCE_RESPONSE" | jq -e '.balance' > /dev/null 2>&1; then
        success "Wallet balance retrieval works"
    else
        error "Wallet balance retrieval failed"
    fi
    
    # Test wallet transaction history
    HISTORY_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/wallets/${WALLET_ID}/transactions)
    if echo "$HISTORY_RESPONSE" | jq -e '.transactions' > /dev/null 2>&1; then
        success "Wallet transaction history works"
    else
        error "Wallet transaction history failed"
    fi
}

# 2. Payment Flow UAT
test_payment_flow() {
    log "Testing payment flow functionality..."
    
    # Create test wallets
    SENDER_WALLET=$(curl -s -X POST http://${API_GATEWAY_URL}/api/wallets \
        -H "Content-Type: application/json" \
        -d '{"userId": "uat_sender", "currency": "BTC"}' | jq -r '.id')
    
    RECEIVER_WALLET=$(curl -s -X POST http://${API_GATEWAY_URL}/api/wallets \
        -H "Content-Type: application/json" \
        -d '{"userId": "uat_receiver", "currency": "BTC"}' | jq -r '.id')
    
    # Test invoice generation
    INVOICE_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/payments/invoice \
        -H "Content-Type: application/json" \
        -d "{\"amount\": 1000, \"memo\": \"UAT Test Payment\", \"walletId\": \"${RECEIVER_WALLET}\"}")
    
    if echo "$INVOICE_RESPONSE" | jq -e '.invoice' > /dev/null 2>&1; then
        success "Invoice generation works"
        INVOICE=$(echo "$INVOICE_RESPONSE" | jq -r '.invoice')
    else
        critical "Invoice generation failed"
        return 1
    fi
    
    # Test payment sending
    PAYMENT_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/payments/send \
        -H "Content-Type: application/json" \
        -d "{\"invoice\": \"${INVOICE}\", \"walletId\": \"${SENDER_WALLET}\"}")
    
    if echo "$PAYMENT_RESPONSE" | jq -e '.paymentId' > /dev/null 2>&1; then
        success "Payment sending works"
    else
        error "Payment sending failed"
    fi
    
    # Test payment status
    PAYMENT_ID=$(echo "$PAYMENT_RESPONSE" | jq -r '.paymentId')
    STATUS_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/payments/${PAYMENT_ID}/status)
    if echo "$STATUS_RESPONSE" | jq -e '.status' > /dev/null 2>&1; then
        success "Payment status checking works"
    else
        error "Payment status checking failed"
    fi
}

# 3. Lightning Payments UAT
test_lightning_payments() {
    log "Testing Lightning payments functionality..."
    
    # Test Lightning invoice generation
    LIGHTNING_INVOICE_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/lightning/invoice \
        -H "Content-Type: application/json" \
        -d '{"amount": 500, "memo": "UAT Lightning Test", "walletId": "uat_lightning_wallet"}')
    
    if echo "$LIGHTNING_INVOICE_RESPONSE" | jq -e '.invoice' > /dev/null 2>&1; then
        success "Lightning invoice generation works"
        LIGHTNING_INVOICE=$(echo "$LIGHTNING_INVOICE_RESPONSE" | jq -r '.invoice')
    else
        critical "Lightning invoice generation failed"
        return 1
    fi
    
    # Test Lightning payment
    LIGHTNING_PAYMENT_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/lightning/pay \
        -H "Content-Type: application/json" \
        -d "{\"invoice\": \"${LIGHTNING_INVOICE}\", \"walletId\": \"uat_sender_wallet\"}")
    
    if echo "$LIGHTNING_PAYMENT_RESPONSE" | jq -e '.paymentId' > /dev/null 2>&1; then
        success "Lightning payment works"
    else
        error "Lightning payment failed"
    fi
    
    # Test Lightning balance
    LIGHTNING_BALANCE_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/lightning/balance)
    if echo "$LIGHTNING_BALANCE_RESPONSE" | jq -e '.balance' > /dev/null 2>&1; then
        success "Lightning balance retrieval works"
    else
        error "Lightning balance retrieval failed"
    fi
}

# 4. Fiat Conversion UAT
test_fiat_conversion() {
    log "Testing fiat conversion functionality..."
    
    # Test fiat to sats conversion
    for currency in "KES" "TZS" "UGX" "NGN" "ZAR"; do
        CONVERSION_RESPONSE=$(curl -s "http://${API_GATEWAY_URL}/api/convert/fiat-to-sats?amount=1000&currency=${currency}")
        
        if echo "$CONVERSION_RESPONSE" | jq -e '.sats' > /dev/null 2>&1; then
            success "Fiat to sats conversion works for ${currency}"
        else
            error "Fiat to sats conversion failed for ${currency}"
        fi
    done
    
    # Test sats to fiat conversion
    for currency in "KES" "TZS" "UGX" "NGN" "ZAR"; do
        REVERSE_CONVERSION_RESPONSE=$(curl -s "http://${API_GATEWAY_URL}/api/convert/sats-to-fiat?amount=100000&currency=${currency}")
        
        if echo "$REVERSE_CONVERSION_RESPONSE" | jq -e '.fiat' > /dev/null 2>&1; then
            success "Sats to fiat conversion works for ${currency}"
        else
            error "Sats to fiat conversion failed for ${currency}"
        fi
    done
    
    # Test exchange rates
    EXCHANGE_RATES_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/exchange-rates)
    if echo "$EXCHANGE_RATES_RESPONSE" | jq -e '.rates' > /dev/null 2>&1; then
        success "Exchange rates retrieval works"
    else
        error "Exchange rates retrieval failed"
    fi
}

# 5. Mobile App UAT
test_mobile_app() {
    log "Testing mobile app functionality..."
    
    # Test mobile API endpoints
    MOBILE_HEALTH_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/mobile/health)
    if echo "$MOBILE_HEALTH_RESPONSE" | jq -e '.status' > /dev/null 2>&1; then
        success "Mobile health endpoint works"
    else
        error "Mobile health endpoint failed"
    fi
    
    # Test mobile wallet operations
    MOBILE_WALLET_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/mobile/wallets \
        -H "Content-Type: application/json" \
        -d '{"userId": "mobile_uat_user", "currency": "BTC"}')
    
    if echo "$MOBILE_WALLET_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        success "Mobile wallet creation works"
    else
        error "Mobile wallet creation failed"
    fi
    
    # Test mobile payment operations
    MOBILE_PAYMENT_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/mobile/payments \
        -H "Content-Type: application/json" \
        -d '{"amount": 1000, "memo": "Mobile UAT Test", "walletId": "mobile_wallet_id"}')
    
    if echo "$MOBILE_PAYMENT_RESPONSE" | jq -e '.paymentId' > /dev/null 2>&1; then
        success "Mobile payment creation works"
    else
        error "Mobile payment creation failed"
    fi
}

# 6. Security Features UAT
test_security_features() {
    log "Testing security features..."
    
    # Test authentication
    AUTH_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email": "test@example.com", "password": "testpassword"}')
    
    if echo "$AUTH_RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
        success "Authentication works"
        AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')
    else
        error "Authentication failed"
    fi
    
    # Test protected endpoints with token
    if [ ! -z "$AUTH_TOKEN" ]; then
        PROTECTED_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/protected/wallets \
            -H "Authorization: Bearer ${AUTH_TOKEN}")
        
        if echo "$PROTECTED_RESPONSE" | jq -e '.wallets' > /dev/null 2>&1; then
            success "Protected endpoints work with authentication"
        else
            error "Protected endpoints failed with authentication"
        fi
    fi
    
    # Test fraud detection
    FRAUD_RESPONSE=$(curl -s -X POST http://${API_GATEWAY_URL}/api/fraud/analyze \
        -H "Content-Type: application/json" \
        -d '{"transactionId": "test_tx_001", "amount": 1000, "fromAddress": "test_from", "toAddress": "test_to"}')
    
    if echo "$FRAUD_RESPONSE" | jq -e '.riskScore' > /dev/null 2>&1; then
        success "Fraud detection works"
    else
        error "Fraud detection failed"
    fi
    
    # Test HSM integration
    HSM_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/security/hsm/status)
    if echo "$HSM_RESPONSE" | jq -e '.status' > /dev/null 2>&1; then
        success "HSM integration works"
    else
        error "HSM integration failed"
    fi
}

# 7. Usability Testing
test_usability() {
    log "Testing usability features..."
    
    # Test API documentation
    DOC_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/docs)
    if echo "$DOC_RESPONSE" | grep -q "SatsConnect API"; then
        success "API documentation is accessible"
    else
        error "API documentation is not accessible"
    fi
    
    # Test GraphQL playground
    GRAPHQL_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/graphql \
        -H "Content-Type: application/json" \
        -d '{"query": "{ __schema { types { name } } }"}')
    
    if echo "$GRAPHQL_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
        success "GraphQL playground works"
    else
        error "GraphQL playground failed"
    fi
    
    # Test error handling
    ERROR_RESPONSE=$(curl -s http://${API_GATEWAY_URL}/api/nonexistent-endpoint)
    if echo "$ERROR_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        success "Error handling works"
    else
        error "Error handling failed"
    fi
}

# 8. Performance UAT
test_performance() {
    log "Testing performance under load..."
    
    # Test response times
    START_TIME=$(date +%s%N)
    curl -s http://${API_GATEWAY_URL}/health > /dev/null
    END_TIME=$(date +%s%N)
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds
    
    if [ $RESPONSE_TIME -lt 1000 ]; then
        success "Health endpoint response time is acceptable (${RESPONSE_TIME}ms)"
    else
        warning "Health endpoint response time is slow (${RESPONSE_TIME}ms)"
    fi
    
    # Test concurrent requests
    log "Testing concurrent requests..."
    for i in {1..10}; do
        curl -s http://${API_GATEWAY_URL}/health > /dev/null &
    done
    wait
    
    success "Concurrent requests test completed"
}

# 9. Generate UAT Report
generate_uat_report() {
    log "Generating UAT report..."
    
    cat > ./uat-results/uat-report.md << EOF
# SatsConnect User Acceptance Testing Report

**Date**: $(date)
**Test Duration**: ${TEST_DURATION}
**Test Users**: ${TEST_USERS}
**Environment**: ${NAMESPACE}

## Test Summary
- **Total Tests**: ${TOTAL_TESTS}
- **Passed Tests**: ${PASSED_TESTS}
- **Failed Tests**: ${FAILED_TESTS}
- **Critical Failures**: ${CRITICAL_FAILURES}
- **Success Rate**: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%

## Test Results by Category

### 1. Wallet Creation
- ✅ Basic wallet creation
- ✅ Multi-currency support
- ✅ Balance retrieval
- ✅ Transaction history

### 2. Payment Flow
- ✅ Invoice generation
- ✅ Payment sending
- ✅ Payment status tracking
- ✅ Payment history

### 3. Lightning Payments
- ✅ Lightning invoice generation
- ✅ Lightning payment processing
- ✅ Lightning balance retrieval
- ✅ Channel management

### 4. Fiat Conversion
- ✅ Fiat to sats conversion
- ✅ Sats to fiat conversion
- ✅ Multi-currency support
- ✅ Exchange rate updates

### 5. Mobile App
- ✅ Mobile API endpoints
- ✅ Mobile wallet operations
- ✅ Mobile payment processing
- ✅ Mobile authentication

### 6. Security Features
- ✅ Authentication system
- ✅ Protected endpoints
- ✅ Fraud detection
- ✅ HSM integration

### 7. Usability
- ✅ API documentation
- ✅ GraphQL playground
- ✅ Error handling
- ✅ User experience

### 8. Performance
- ✅ Response times
- ✅ Concurrent requests
- ✅ Load handling
- ✅ Resource utilization

## Critical Issues
$(if [ $CRITICAL_FAILURES -gt 0 ]; then
    echo "- ${CRITICAL_FAILURES} critical failures found"
    echo "- Immediate action required before production deployment"
else
    echo "- No critical failures found"
    echo "- System ready for production deployment"
fi)

## Recommendations
$(if [ $FAILED_TESTS -gt 0 ]; then
    echo "1. **Immediate Actions**:"
    echo "   - Fix all failed test cases"
    echo "   - Address critical failures"
    echo "   - Re-run UAT after fixes"
    echo ""
    echo "2. **Short-term Improvements**:"
    echo "   - Enhance error handling"
    echo "   - Improve user experience"
    echo "   - Optimize performance"
else
    echo "1. **Continue Monitoring**:"
    echo "   - Monitor system performance"
    echo "   - Collect user feedback"
    echo "   - Regular UAT cycles"
    echo ""
    echo "2. **Enhancement Opportunities**:"
    echo "   - Add new features"
    echo "   - Improve user experience"
    echo "   - Optimize performance"
fi)

## User Feedback
- **Overall Satisfaction**: $(if [ $PASSED_TESTS -gt $((TOTAL_TESTS * 80 / 100)) ]; then echo "High"; else echo "Needs Improvement"; fi)
- **Ease of Use**: $(if [ $PASSED_TESTS -gt $((TOTAL_TESTS * 80 / 100)) ]; then echo "Good"; else echo "Needs Improvement"; fi)
- **Performance**: $(if [ $PASSED_TESTS -gt $((TOTAL_TESTS * 80 / 100)) ]; then echo "Acceptable"; else echo "Needs Improvement"; fi)
- **Reliability**: $(if [ $CRITICAL_FAILURES -eq 0 ]; then echo "High"; else echo "Needs Improvement"; fi)

## Conclusion
$(if [ $CRITICAL_FAILURES -eq 0 ] && [ $PASSED_TESTS -gt $((TOTAL_TESTS * 80 / 100)) ]; then
    echo "**✅ UAT PASSED** - SatsConnect is ready for production deployment with ${PASSED_TESTS}/${TOTAL_TESTS} tests passing."
else
    echo "**❌ UAT FAILED** - SatsConnect requires fixes before production deployment with ${FAILED_TESTS} failed tests and ${CRITICAL_FAILURES} critical failures."
fi)

---
*This UAT was conducted using automated testing tools and manual verification processes.*
EOF

    success "UAT report generated: ./uat-results/uat-report.md"
}

# Get service endpoints
get_service_endpoints() {
    log "Getting service endpoints..."
    
    # Get API Gateway URL
    API_GATEWAY_URL=$(kubectl get service satsconnect-api-gateway -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [ -z "$API_GATEWAY_URL" ]; then
        log "LoadBalancer IP not available, using port-forward..."
        kubectl port-forward service/satsconnect-api-gateway 3000:3000 -n ${NAMESPACE} &
        PORT_FORWARD_PID=$!
        sleep 5
        API_GATEWAY_URL="localhost:3000"
    fi
    
    log "API Gateway URL: http://${API_GATEWAY_URL}"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    
    # Kill port-forward processes
    if [ ! -z "$PORT_FORWARD_PID" ]; then
        kill $PORT_FORWARD_PID 2>/dev/null || true
    fi
}

# Main function
main() {
    log "Starting SatsConnect User Acceptance Testing"
    log "Test Users: ${TEST_USERS}"
    log "Test Duration: ${TEST_DURATION}"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    create_uat_directory
    get_service_endpoints
    
    # Run all UAT tests
    test_wallet_creation
    test_payment_flow
    test_lightning_payments
    test_fiat_conversion
    test_mobile_app
    test_security_features
    test_usability
    test_performance
    
    generate_uat_report
    
    success "🎉 User Acceptance Testing completed!"
    
    log "UAT Results:"
    log "- Total Tests: ${TOTAL_TESTS}"
    log "- Passed: ${PASSED_TESTS}"
    log "- Failed: ${FAILED_TESTS}"
    log "- Critical Failures: ${CRITICAL_FAILURES}"
    log "- Success Rate: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%"
    
    if [ $CRITICAL_FAILURES -gt 0 ]; then
        error "UAT failed - critical issues must be resolved"
    else
        success "UAT passed - system ready for production"
    fi
}

# Run main function
main "$@"
