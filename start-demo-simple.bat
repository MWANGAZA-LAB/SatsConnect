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

echo ✅ Node.js is installed
echo.

REM Check if demo files exist
if not exist "demo.html" (
    echo ❌ Error: demo.html not found
    echo Please make sure you're in the SatsConnect root directory
    pause
    exit /b 1
)

echo ✅ Demo files found
echo.

echo 🎯 Choose your demo option:
echo 1. Interactive HTML Demo (Recommended)
echo 2. Command Line Mock Demo
echo 3. Full API Demo (requires services)
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo 🌐 Opening Interactive HTML Demo...
    start demo.html
    echo ✅ Demo opened in your default browser!
    goto :end
)

if "%choice%"=="2" (
    echo 🎬 Running Command Line Mock Demo...
    node demo-mock.js
    goto :end
)

if "%choice%"=="3" (
    echo 🔧 Starting API services...
    echo Starting Node.js orchestrator on port 4000...
    
    REM Start Node.js orchestrator in background
    start "SatsConnect API" cmd /c "cd backend\node-orchestrator && npm start"
    
    REM Wait for service to start
    timeout /t 5 /nobreak >nul
    
    echo 🎬 Running Full API Demo...
    node demo-satsconnect.js
    
    echo 💡 To stop the API server, close the "SatsConnect API" window
    goto :end
)

echo ❌ Invalid choice. Please run the script again.

:end
echo.
echo 🎉 Demo completed!
echo.
echo 💡 Additional commands:
echo   npm run demo        # Run mock demo
echo   npm run demo:api    # Run full API demo
echo   npm run demo:html   # Open HTML demo
echo   npm run dev         # Start all services
echo.
pause
