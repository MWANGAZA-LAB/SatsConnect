#!/bin/bash

# Fix Rust formatting issues for SatsConnect
echo "🔧 Fixing Rust formatting issues..."

# Navigate to the Rust engine directory
cd backend/rust-engine

# Run cargo fmt to automatically fix formatting
echo "Running cargo fmt..."
cargo fmt

# Check if formatting is now correct
echo "Checking formatting..."
if cargo fmt -- --check; then
    echo "✅ Rust formatting is now correct!"
else
    echo "❌ Still have formatting issues"
    exit 1
fi

echo "🎉 All Rust formatting issues fixed!"
