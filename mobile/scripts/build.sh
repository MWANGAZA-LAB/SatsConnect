#!/bin/bash

# SatsConnect Mobile Build Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BUILD_TYPE=${1:-development}
PLATFORM=${2:-all}

echo -e "${GREEN}📱 Starting SatsConnect mobile build for $BUILD_TYPE environment${NC}"

# Check if EAS CLI is installed
if ! command -v eas > /dev/null 2>&1; then
    echo -e "${RED}❌ EAS CLI is not installed. Please install it with: npm install -g @expo/eas-cli${NC}"
    exit 1
fi

# Check if logged in to EAS
if ! eas whoami > /dev/null 2>&1; then
    echo -e "${YELLOW}🔐 Please log in to EAS:${NC}"
    eas login
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Run pre-build checks
echo -e "${YELLOW}🔍 Running pre-build checks...${NC}"

# TypeScript check
echo -e "${YELLOW}  • TypeScript check...${NC}"
npx tsc --noEmit

# ESLint check
echo -e "${YELLOW}  • ESLint check...${NC}"
npx eslint . --ext .ts,.tsx --max-warnings 0

# Jest tests
echo -e "${YELLOW}  • Running tests...${NC}"
npm test -- --coverage --watchAll=false

# Build based on platform
if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
    echo -e "${YELLOW}🍎 Building for iOS...${NC}"
    eas build --platform ios --profile $BUILD_TYPE --non-interactive
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
    echo -e "${YELLOW}🤖 Building for Android...${NC}"
    eas build --platform android --profile $BUILD_TYPE --non-interactive
fi

echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${GREEN}📋 Build artifacts are available in the EAS dashboard${NC}"
