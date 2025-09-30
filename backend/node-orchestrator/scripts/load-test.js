#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.concurrency = options.concurrency || 100;
    this.duration = options.duration || 60000; // 1 minute
    this.rampUp = options.rampUp || 10000; // 10 seconds
    this.endpoints = options.endpoints || [
      { path: '/health/health', method: 'GET', weight: 0.5 },
      { path: '/api/wallet/balance/test-wallet', method: 'GET', weight: 0.3 },
      { path: '/api/wallet/create', method: 'POST', weight: 0.2 },
    ];
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: {},
      startTime: null,
      endTime: null,
    };
  }

  async makeRequest(endpoint) {
    const startTime = performance.now();
    const url = new URL(endpoint.path, this.baseUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LoadTester/1.0',
      },
    };

    if (endpoint.method === 'POST') {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(endpoint.body || {}));
    }

    return new Promise((resolve) => {
      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 400,
            statusCode: res.statusCode,
            responseTime,
            data: data.substring(0, 100), // Truncate for logging
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        resolve({
          success: false,
          statusCode: 0,
          responseTime,
          error: error.message,
        });
      });

      req.setTimeout(30000, () => {
        req.destroy();
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        resolve({
          success: false,
          statusCode: 0,
          responseTime,
          error: 'Request timeout',
        });
      });

      if (endpoint.method === 'POST' && endpoint.body) {
        req.write(JSON.stringify(endpoint.body));
      }

      req.end();
    });
  }

  selectEndpoint() {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const endpoint of this.endpoints) {
      cumulativeWeight += endpoint.weight;
      if (random <= cumulativeWeight) {
        return endpoint;
      }
    }
    
    return this.endpoints[0];
  }

  async runWorker(workerId) {
    const startTime = performance.now();
    
    while (performance.now() - startTime < this.duration) {
      const endpoint = this.selectEndpoint();
      const result = await this.makeRequest(endpoint);
      
      this.results.totalRequests++;
      this.results.responseTimes.push(result.responseTime);
      
      if (result.success) {
        this.results.successfulRequests++;
      } else {
        this.results.failedRequests++;
        const errorKey = `${result.statusCode}: ${result.error || 'Unknown error'}`;
        this.results.errors[errorKey] = (this.results.errors[errorKey] || 0) + 1;
      }
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async run() {
    console.log(`Starting load test...`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Concurrency: ${this.concurrency}`);
    console.log(`Duration: ${this.duration}ms`);
    console.log(`Ramp-up: ${this.rampUp}ms`);
    console.log('');

    this.results.startTime = performance.now();
    
    // Ramp up workers gradually
    const rampUpInterval = this.rampUp / this.concurrency;
    const workers = [];
    
    for (let i = 0; i < this.concurrency; i++) {
      setTimeout(() => {
        workers.push(this.runWorker(i));
      }, i * rampUpInterval);
    }
    
    // Wait for all workers to complete
    await Promise.all(workers);
    
    this.results.endTime = performance.now();
    
    this.printResults();
  }

  printResults() {
    const totalTime = this.results.endTime - this.results.startTime;
    const requestsPerSecond = this.results.totalRequests / (totalTime / 1000);
    const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
    
    const responseTimes = this.results.responseTimes.sort((a, b) => a - b);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const p50ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.5)];
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
    
    console.log('=== Load Test Results ===');
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful Requests: ${this.results.successfulRequests}`);
    console.log(`Failed Requests: ${this.results.failedRequests}`);
    console.log(`Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`Requests per Second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log('');
    console.log('=== Response Times ===');
    console.log(`Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Min: ${minResponseTime.toFixed(2)}ms`);
    console.log(`Max: ${maxResponseTime.toFixed(2)}ms`);
    console.log(`50th percentile: ${p50ResponseTime.toFixed(2)}ms`);
    console.log(`95th percentile: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`99th percentile: ${p99ResponseTime.toFixed(2)}ms`);
    console.log('');
    
    if (Object.keys(this.results.errors).length > 0) {
      console.log('=== Errors ===');
      Object.entries(this.results.errors).forEach(([error, count]) => {
        console.log(`${error}: ${count}`);
      });
      console.log('');
    }
    
    // Performance assessment
    if (successRate < 95) {
      console.log('⚠️  WARNING: Success rate below 95%');
    }
    
    if (p95ResponseTime > 1000) {
      console.log('⚠️  WARNING: 95th percentile response time above 1s');
    }
    
    if (requestsPerSecond < 100) {
      console.log('⚠️  WARNING: Requests per second below 100');
    }
    
    if (successRate >= 95 && p95ResponseTime <= 1000 && requestsPerSecond >= 100) {
      console.log('✅ Load test passed all performance criteria');
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'concurrency' || key === 'duration' || key === 'rampUp') {
      options[key] = parseInt(value);
    } else {
      options[key] = value;
    }
  }
  
  const loadTester = new LoadTester(options);
  loadTester.run().catch(console.error);
}

module.exports = LoadTester;
