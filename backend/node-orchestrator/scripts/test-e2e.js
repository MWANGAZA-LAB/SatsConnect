#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🧪 Starting End-to-End gRPC Communication Tests');
console.log('================================================');

// Function to run command and return promise
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function runE2ETests() {
  try {
    // Step 1: Install dependencies
    console.log('\n📦 Installing dependencies...');
    await runCommand('npm', ['install'], { cwd: projectRoot });

    // Step 2: Build the project
    console.log('\n🔨 Building project...');
    await runCommand('npm', ['run', 'build'], { cwd: projectRoot });

    // Step 3: Run E2E tests
    console.log('\n🧪 Running E2E tests...');
    await runCommand('npm', ['run', 'test:e2e'], { cwd: projectRoot });

    console.log('\n✅ All E2E tests completed successfully!');
    console.log('🎉 gRPC communication is working correctly!');

  } catch (error) {
    console.error('\n❌ E2E tests failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('1. Make sure Rust engine is running: cd ../rust-engine && cargo run');
    console.error('2. Check if all dependencies are installed');
    console.error('3. Verify gRPC connection settings');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test run interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test run terminated');
  process.exit(0);
});

// Run the tests
runE2ETests();
