@echo off
echo 🚀 SatsConnect Demo Launcher
echo ============================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "backend\node-orchestrator\dist\index.js" (
    echo ❌ Error: Node.js orchestrator not built
    echo Please run: cd backend\node-orchestrator && npm run build
    pause
    exit /b 1
)

echo ✅ Node.js orchestrator is built
echo.

echo 🎯 Starting SatsConnect Demo...
echo.

REM Start the Node.js orchestrator in the background
echo Starting Node.js orchestrator on port 4000...
start "SatsConnect API" cmd /c "cd backend\node-orchestrator && npm start"

REM Wait a moment for the service to start
timeout /t 5 /nobreak >nul

echo.
echo 🌐 API Server should be running on http://localhost:4000
echo.

REM Run the demo script
echo 🎬 Running SatsConnect Demo...
echo.
node demo-satsconnect.js

echo.
echo 🎉 Demo completed!
echo.
echo 💡 To stop the API server, close the "SatsConnect API" window
echo 💡 To test the mobile app: cd mobile && npx expo start
echo.
pause
