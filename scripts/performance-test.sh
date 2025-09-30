#!/bin/bash

# SatsConnect Performance Testing Script
# This script performs comprehensive performance testing with 100,000+ concurrent users

set -e

echo "⚡ Starting SatsConnect Performance Testing..."

# Configuration
NAMESPACE="satsconnect-prod"
TEST_DURATION="300s"  # 5 minutes
CONCURRENT_USERS=100000
RAMP_UP_TIME="60s"
TARGET_RPS=50000  # 50,000 requests per second
TEST_SCENARIOS=("wallet_operations" "payment_processing" "lightning_payments" "fiat_conversion" "api_gateway")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Performance metrics
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
FAILED_REQUESTS=0
AVERAGE_RESPONSE_TIME=0
P95_RESPONSE_TIME=0
P99_RESPONSE_TIME=0
THROUGHPUT=0

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log "Installing k6..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install k6
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            curl -s https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz | tar xvz --strip-components 1
            sudo mv k6 /usr/local/bin/
        else
            error "Unsupported OS. Please install k6 manually."
        fi
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        error "jq is not installed or not in PATH"
    fi
    
    # Check Kubernetes connection
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    success "Prerequisites check passed"
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
    
    # Get Rust Engine URL
    RUST_ENGINE_URL=$(kubectl get service satsconnect-rust-engine -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [ -z "$RUST_ENGINE_URL" ]; then
        log "Rust Engine LoadBalancer IP not available, using port-forward..."
        kubectl port-forward service/satsconnect-rust-engine 50051:50051 -n ${NAMESPACE} &
        RUST_PORT_FORWARD_PID=$!
        sleep 5
        RUST_ENGINE_URL="localhost:50051"
    fi
    
    log "API Gateway URL: http://${API_GATEWAY_URL}"
    log "Rust Engine URL: ${RUST_ENGINE_URL}"
}

# Create k6 test scenarios
create_test_scenarios() {
    log "Creating k6 test scenarios..."
    
    # Create test directory
    mkdir -p ./performance-tests
    
    # 1. Wallet Operations Test
    cat > ./performance-tests/wallet-operations.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
    stages: [
        { duration: '60s', target: 10000 },  // Ramp up to 10k users
        { duration: '180s', target: 10000 }, // Stay at 10k users
        { duration: '60s', target: 0 },      // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
        http_req_failed: ['rate<0.01'],    // Error rate under 1%
        errors: ['rate<0.01'],
    },
};

const BASE_URL = __ENV.API_GATEWAY_URL || 'http://localhost:3000';

export default function() {
    // Test wallet creation
    let walletResponse = http.post(`${BASE_URL}/api/wallets`, JSON.stringify({
        userId: `user_${__VU}_${__ITER}`,
        currency: 'BTC'
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    check(walletResponse, {
        'wallet creation status is 201': (r) => r.status === 201,
        'wallet creation response time < 2s': (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);
    
    if (walletResponse.status === 201) {
        const wallet = JSON.parse(walletResponse.body);
        
        // Test wallet balance
        let balanceResponse = http.get(`${BASE_URL}/api/wallets/${wallet.id}/balance`);
        
        check(balanceResponse, {
            'balance check status is 200': (r) => r.status === 200,
            'balance check response time < 1s': (r) => r.timings.duration < 1000,
        }) || errorRate.add(1);
        
        // Test transaction history
        let historyResponse = http.get(`${BASE_URL}/api/wallets/${wallet.id}/transactions`);
        
        check(historyResponse, {
            'history status is 200': (r) => r.status === 200,
            'history response time < 1s': (r) => r.timings.duration < 1000,
        }) || errorRate.add(1);
    }
    
    sleep(1);
}
EOF

    # 2. Payment Processing Test
    cat > ./performance-tests/payment-processing.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
    stages: [
        { duration: '60s', target: 15000 },  // Ramp up to 15k users
        { duration: '180s', target: 15000 }, // Stay at 15k users
        { duration: '60s', target: 0 },      // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
        http_req_failed: ['rate<0.01'],    // Error rate under 1%
        errors: ['rate<0.01'],
    },
};

const BASE_URL = __ENV.API_GATEWAY_URL || 'http://localhost:3000';

export default function() {
    // Test invoice generation
    let invoiceResponse = http.post(`${BASE_URL}/api/payments/invoice`, JSON.stringify({
        amount: 1000 + Math.floor(Math.random() * 9000), // Random amount 1000-10000 sats
        memo: `Test payment ${__VU}_${__ITER}`,
        walletId: `wallet_${__VU}_${__ITER}`
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    check(invoiceResponse, {
        'invoice generation status is 201': (r) => r.status === 201,
        'invoice generation response time < 2s': (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);
    
    if (invoiceResponse.status === 201) {
        const invoice = JSON.parse(invoiceResponse.body);
        
        // Test payment sending
        let paymentResponse = http.post(`${BASE_URL}/api/payments/send`, JSON.stringify({
            invoice: invoice.invoice,
            walletId: `wallet_${__VU}_${__ITER}`
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
        
        check(paymentResponse, {
            'payment status is 200': (r) => r.status === 200,
            'payment response time < 3s': (r) => r.timings.duration < 3000,
        }) || errorRate.add(1);
    }
    
    sleep(2);
}
EOF

    # 3. Lightning Payments Test
    cat > ./performance-tests/lightning-payments.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
    stages: [
        { duration: '60s', target: 20000 },  // Ramp up to 20k users
        { duration: '180s', target: 20000 }, // Stay at 20k users
        { duration: '60s', target: 0 },      // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<1500'], // 95% of requests under 1.5s
        http_req_failed: ['rate<0.01'],    // Error rate under 1%
        errors: ['rate<0.01'],
    },
};

const BASE_URL = __ENV.API_GATEWAY_URL || 'http://localhost:3000';

export default function() {
    // Test Lightning invoice generation
    let lightningInvoiceResponse = http.post(`${BASE_URL}/api/lightning/invoice`, JSON.stringify({
        amount: 100 + Math.floor(Math.random() * 900), // Random amount 100-1000 sats
        memo: `Lightning test ${__VU}_${__ITER}`,
        walletId: `wallet_${__VU}_${__ITER}`
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    check(lightningInvoiceResponse, {
        'lightning invoice status is 201': (r) => r.status === 201,
        'lightning invoice response time < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
    
    if (lightningInvoiceResponse.status === 201) {
        const lightningInvoice = JSON.parse(lightningInvoiceResponse.body);
        
        // Test Lightning payment
        let lightningPaymentResponse = http.post(`${BASE_URL}/api/lightning/pay`, JSON.stringify({
            invoice: lightningInvoice.invoice,
            walletId: `wallet_${__VU}_${__ITER}`
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
        
        check(lightningPaymentResponse, {
            'lightning payment status is 200': (r) => r.status === 200,
            'lightning payment response time < 1.5s': (r) => r.timings.duration < 1500,
        }) || errorRate.add(1);
    }
    
    sleep(1);
}
EOF

    # 4. Fiat Conversion Test
    cat > ./performance-tests/fiat-conversion.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
    stages: [
        { duration: '60s', target: 10000 },  // Ramp up to 10k users
        { duration: '180s', target: 10000 }, // Stay at 10k users
        { duration: '60s', target: 0 },      // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
        http_req_failed: ['rate<0.01'],    // Error rate under 1%
        errors: ['rate<0.01'],
    },
};

const BASE_URL = __ENV.API_GATEWAY_URL || 'http://localhost:3000';
const CURRENCIES = ['KES', 'TZS', 'UGX', 'NGN', 'ZAR', 'GHS', 'ETB', 'MWK', 'ZMW', 'BWP'];

export default function() {
    const currency = CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)];
    const amount = 100 + Math.floor(Math.random() * 9000); // Random amount 100-10000
    
    // Test fiat to sats conversion
    let conversionResponse = http.get(`${BASE_URL}/api/convert/fiat-to-sats?amount=${amount}&currency=${currency}`);
    
    check(conversionResponse, {
        'conversion status is 200': (r) => r.status === 200,
        'conversion response time < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
    
    if (conversionResponse.status === 200) {
        const conversion = JSON.parse(conversionResponse.body);
        
        // Test sats to fiat conversion
        let reverseConversionResponse = http.get(`${BASE_URL}/api/convert/sats-to-fiat?amount=${conversion.sats}&currency=${currency}`);
        
        check(reverseConversionResponse, {
            'reverse conversion status is 200': (r) => r.status === 200,
            'reverse conversion response time < 1s': (r) => r.timings.duration < 1000,
        }) || errorRate.add(1);
    }
    
    sleep(1);
}
EOF

    # 5. API Gateway Test
    cat > ./performance-tests/api-gateway.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
    stages: [
        { duration: '60s', target: 25000 },  // Ramp up to 25k users
        { duration: '180s', target: 25000 }, // Stay at 25k users
        { duration: '60s', target: 0 },      // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
        http_req_failed: ['rate<0.01'],    // Error rate under 1%
        errors: ['rate<0.01'],
    },
};

const BASE_URL = __ENV.API_GATEWAY_URL || 'http://localhost:3000';

export default function() {
    // Test health endpoint
    let healthResponse = http.get(`${BASE_URL}/health`);
    
    check(healthResponse, {
        'health status is 200': (r) => r.status === 200,
        'health response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);
    
    // Test GraphQL endpoint
    let graphqlResponse = http.post(`${BASE_URL}/graphql`, JSON.stringify({
        query: '{ __schema { types { name } } }'
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    check(graphqlResponse, {
        'GraphQL status is 200': (r) => r.status === 200,
        'GraphQL response time < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
    
    // Test REST API endpoints
    let apiResponse = http.get(`${BASE_URL}/api/currencies`);
    
    check(apiResponse, {
        'API status is 200': (r) => r.status === 200,
        'API response time < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
    
    sleep(0.5);
}
EOF

    success "Test scenarios created"
}

# Run performance tests
run_performance_tests() {
    log "Running performance tests..."
    
    # Create results directory
    mkdir -p ./performance-results
    
    # Run each test scenario
    for scenario in "${TEST_SCENARIOS[@]}"; do
        log "Running ${scenario} test..."
        
        k6 run \
            --env API_GATEWAY_URL=http://${API_GATEWAY_URL} \
            --out json=./performance-results/${scenario}-results.json \
            ./performance-tests/${scenario}.js
        
        if [ $? -eq 0 ]; then
            success "${scenario} test completed successfully"
        else
            error "${scenario} test failed"
        fi
    done
}

# Run comprehensive load test
run_comprehensive_load_test() {
    log "Running comprehensive load test with ${CONCURRENT_USERS} concurrent users..."
    
    # Create comprehensive test
    cat > ./performance-tests/comprehensive-load.js << EOF
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
    stages: [
        { duration: '${RAMP_UP_TIME}', target: ${CONCURRENT_USERS} },
        { duration: '${TEST_DURATION}', target: ${CONCURRENT_USERS} },
        { duration: '60s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        http_req_failed: ['rate<0.05'],
        errors: ['rate<0.05'],
    },
};

const BASE_URL = __ENV.API_GATEWAY_URL || 'http://localhost:3000';

export default function() {
    const testType = Math.floor(Math.random() * 4);
    
    switch(testType) {
        case 0:
            // Wallet operations
            let walletResponse = http.post(\`\${BASE_URL}/api/wallets\`, JSON.stringify({
                userId: \`user_\${__VU}_\${__ITER}\`,
                currency: 'BTC'
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
            check(walletResponse, { 'wallet creation': (r) => r.status === 201 }) || errorRate.add(1);
            break;
            
        case 1:
            // Payment processing
            let paymentResponse = http.post(\`\${BASE_URL}/api/payments/invoice\`, JSON.stringify({
                amount: 1000 + Math.floor(Math.random() * 9000),
                memo: \`Test payment \${__VU}_\${__ITER}\`,
                walletId: \`wallet_\${__VU}_\${__ITER}\`
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
            check(paymentResponse, { 'payment creation': (r) => r.status === 201 }) || errorRate.add(1);
            break;
            
        case 2:
            // Lightning payments
            let lightningResponse = http.post(\`\${BASE_URL}/api/lightning/invoice\`, JSON.stringify({
                amount: 100 + Math.floor(Math.random() * 900),
                memo: \`Lightning test \${__VU}_\${__ITER}\`,
                walletId: \`wallet_\${__VU}_\${__ITER}\`
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
            check(lightningResponse, { 'lightning invoice': (r) => r.status === 201 }) || errorRate.add(1);
            break;
            
        case 3:
            // Fiat conversion
            let conversionResponse = http.get(\`\${BASE_URL}/api/convert/fiat-to-sats?amount=1000&currency=KES\`);
            check(conversionResponse, { 'fiat conversion': (r) => r.status === 200 }) || errorRate.add(1);
            break;
    }
    
    sleep(0.1);
}
EOF

    # Run comprehensive test
    k6 run \
        --env API_GATEWAY_URL=http://${API_GATEWAY_URL} \
        --out json=./performance-results/comprehensive-load-results.json \
        ./performance-tests/comprehensive-load.js
    
    if [ $? -eq 0 ]; then
        success "Comprehensive load test completed successfully"
    else
        error "Comprehensive load test failed"
    fi
}

# Analyze results
analyze_results() {
    log "Analyzing performance test results..."
    
    # Create analysis script
    cat > ./performance-results/analyze-results.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Read all result files
const resultFiles = fs.readdirSync('./performance-results')
    .filter(file => file.endsWith('-results.json'))
    .map(file => path.join('./performance-results', file));

let totalRequests = 0;
let totalSuccessfulRequests = 0;
let totalFailedRequests = 0;
let totalResponseTime = 0;
let responseTimes = [];
let throughputs = [];

resultFiles.forEach(file => {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        
        data.forEach(point => {
            if (point.type === 'Point' && point.metric === 'http_reqs') {
                totalRequests += point.data.value;
            }
            if (point.type === 'Point' && point.metric === 'http_req_duration') {
                responseTimes.push(point.data.value);
                totalResponseTime += point.data.value;
            }
            if (point.type === 'Point' && point.metric === 'http_req_failed') {
                if (point.data.value === 1) {
                    totalFailedRequests++;
                } else {
                    totalSuccessfulRequests++;
                }
            }
            if (point.type === 'Point' && point.metric === 'http_reqs') {
                throughputs.push(point.data.value);
            }
        });
    } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
    }
});

// Calculate metrics
const averageResponseTime = totalResponseTime / responseTimes.length;
const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
const p99Index = Math.floor(sortedResponseTimes.length * 0.99);
const p95ResponseTime = sortedResponseTimes[p95Index];
const p99ResponseTime = sortedResponseTimes[p99Index];
const errorRate = (totalFailedRequests / totalRequests) * 100;
const averageThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;

// Generate report
const report = `# SatsConnect Performance Test Results

## Test Summary
- **Total Requests**: ${totalRequests.toLocaleString()}
- **Successful Requests**: ${totalSuccessfulRequests.toLocaleString()}
- **Failed Requests**: ${totalFailedRequests.toLocaleString()}
- **Error Rate**: ${errorRate.toFixed(2)}%
- **Average Response Time**: ${averageResponseTime.toFixed(2)}ms
- **P95 Response Time**: ${p95ResponseTime.toFixed(2)}ms
- **P99 Response Time**: ${p99ResponseTime.toFixed(2)}ms
- **Average Throughput**: ${averageThroughput.toFixed(2)} req/s

## Performance Assessment
${errorRate < 1 ? '✅ **EXCELLENT** - Error rate under 1%' : errorRate < 5 ? '⚠️ **GOOD** - Error rate under 5%' : '❌ **NEEDS IMPROVEMENT** - Error rate over 5%'}

${averageResponseTime < 1000 ? '✅ **EXCELLENT** - Average response time under 1s' : averageResponseTime < 2000 ? '⚠️ **GOOD** - Average response time under 2s' : '❌ **NEEDS IMPROVEMENT** - Average response time over 2s'}

${p95ResponseTime < 2000 ? '✅ **EXCELLENT** - P95 response time under 2s' : p95ResponseTime < 5000 ? '⚠️ **GOOD** - P95 response time under 5s' : '❌ **NEEDS IMPROVEMENT** - P95 response time over 5s'}

## Recommendations
${errorRate > 5 ? '- **CRITICAL**: Reduce error rate by fixing failing endpoints' : ''}
${averageResponseTime > 2000 ? '- **HIGH**: Optimize response times by improving database queries and caching' : ''}
${p95ResponseTime > 5000 ? '- **HIGH**: Optimize P95 response times by implementing better load balancing' : ''}
${averageThroughput < 1000 ? '- **MEDIUM**: Increase throughput by scaling horizontally' : ''}

## Next Steps
1. Address critical and high-priority issues
2. Implement performance optimizations
3. Scale infrastructure if needed
4. Re-run tests to validate improvements
`;

fs.writeFileSync('./performance-results/performance-report.md', report);
console.log('Performance analysis completed. Report saved to performance-report.md');
EOF

    # Run analysis
    node ./performance-results/analyze-results.js
    
    success "Performance analysis completed"
}

# Generate performance report
generate_performance_report() {
    log "Generating performance report..."
    
    cat > ./performance-results/performance-summary.md << EOF
# SatsConnect Performance Test Summary

**Date**: $(date)
**Test Duration**: ${TEST_DURATION}
**Concurrent Users**: ${CONCURRENT_USERS}
**Target RPS**: ${TARGET_RPS}

## Test Scenarios Executed
$(for scenario in "${TEST_SCENARIOS[@]}"; do
    echo "- ${scenario}"
done)

## Key Metrics
- **Total Concurrent Users**: ${CONCURRENT_USERS}
- **Test Duration**: ${TEST_DURATION}
- **Target Throughput**: ${TARGET_RPS} RPS

## Performance Targets
- **Response Time**: < 2s (95th percentile)
- **Error Rate**: < 1%
- **Throughput**: > 10,000 RPS
- **Availability**: 99.9%

## Test Results
$(if [ -f "./performance-results/performance-report.md" ]; then
    cat ./performance-results/performance-report.md
else
    echo "Test results are being processed..."
fi)

## Infrastructure Status
$(kubectl get pods -n ${NAMESPACE} | grep -E "(rust-engine|api-gateway)" | head -10)

## Resource Utilization
$(kubectl top pods -n ${NAMESPACE} | head -10)

## Recommendations
1. **Immediate Actions**:
   - Review and fix any failing endpoints
   - Optimize database queries
   - Implement caching strategies

2. **Short-term Improvements**:
   - Scale horizontal pods
   - Optimize application code
   - Implement connection pooling

3. **Long-term Optimizations**:
   - Implement microservices architecture
   - Add CDN for static content
   - Implement advanced caching

---
*This performance test was conducted using k6 load testing tool with ${CONCURRENT_USERS} concurrent users over ${TEST_DURATION}.*
EOF

    success "Performance report generated: ./performance-results/performance-summary.md"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    
    # Kill port-forward processes
    if [ ! -z "$PORT_FORWARD_PID" ]; then
        kill $PORT_FORWARD_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$RUST_PORT_FORWARD_PID" ]; then
        kill $RUST_PORT_FORWARD_PID 2>/dev/null || true
    fi
}

# Main function
main() {
    log "Starting SatsConnect Performance Testing"
    log "Concurrent Users: ${CONCURRENT_USERS}"
    log "Test Duration: ${TEST_DURATION}"
    log "Target RPS: ${TARGET_RPS}"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    check_prerequisites
    get_service_endpoints
    create_test_scenarios
    run_performance_tests
    run_comprehensive_load_test
    analyze_results
    generate_performance_report
    
    success "🎉 Performance testing completed successfully!"
    
    log "Test Results:"
    log "- Individual scenario tests completed"
    log "- Comprehensive load test with ${CONCURRENT_USERS} users completed"
    log "- Performance analysis generated"
    log "- Report saved to ./performance-results/"
    
    log "Next steps:"
    log "1. Review performance report"
    log "2. Address any performance issues"
    log "3. Scale infrastructure if needed"
    log "4. Re-run tests to validate improvements"
}

# Run main function
main "$@"
