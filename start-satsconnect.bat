@echo off
echo 🚀 Starting SatsConnect...
echo.

REM Check if we're in the right directory
if not exist "backend\rust-engine\Cargo.toml" (
    echo ❌ Error: Please run this script from the SatsConnect root directory
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
call npm run install:all
if errorlevel 1 (
    echo ❌ Dependency installation failed
    pause
    exit /b 1
)

echo.
echo 🔨 Building Rust engine...
cd backend\rust-engine
call cargo build --release
if errorlevel 1 (
    echo ❌ Rust build failed
    pause
    exit /b 1
)
cd ..\..

echo.
echo 🔨 Building Node.js orchestrator...
cd backend\node-orchestrator
call npm run build
if errorlevel 1 (
    echo ❌ Node.js build failed
    pause
    exit /b 1
)
cd ..\..

echo.
echo ✅ All builds completed successfully!
echo.
echo 🎯 To start all services, run:
echo    npm run dev
echo.
echo 🎯 Or start individual services:
echo    npm run start:rust    # Rust gRPC Engine (port 50051)
echo    npm run start:node    # Node.js Orchestrator (port 4000)
echo    npm run start:mobile  # React Native App (port 8081)
echo.
echo 🌐 API Health Check: http://localhost:4000/health
echo.
pause
