@echo off
echo 🌐 Opening SatsConnect Demo in Web Browser...
echo.

REM Navigate to the SatsConnect directory
cd /d "C:\Users\mwang\Desktop\SatsConnect"

REM Check if demo.html exists
if not exist "demo.html" (
    echo ❌ Error: demo.html not found
    echo Please make sure you're in the SatsConnect directory
    pause
    exit /b 1
)

echo ✅ Found demo.html
echo 🌐 Opening in your default browser...
echo.

REM Open the demo in the default browser
start "" "demo.html"

echo 🎉 Demo opened successfully!
echo.
echo 💡 The demo showcases:
echo    • Non-custodial Lightning wallet
echo    • MPesa integration for fiat on/off ramps
echo    • Real-time Bitcoin exchange rates
echo    • Instant Lightning payments
echo    • Bitcoin to airtime conversion
echo    • Military-grade security (AES-256-GCM)
echo    • Argon2 key derivation
echo    • Secure mnemonic storage
echo.
echo 🎬 Click "Run Demo" in the browser to start the interactive simulation!
echo.
pause
