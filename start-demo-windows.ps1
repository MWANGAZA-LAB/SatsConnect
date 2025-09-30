# SatsConnect Demo Launcher for Windows
# PowerShell script to start the demo

Write-Host "🚀 SatsConnect Demo Launcher" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "backend\node-orchestrator\dist\index.js")) {
    Write-Host "❌ Error: Node.js orchestrator not built" -ForegroundColor Red
    Write-Host "Building Node.js orchestrator..." -ForegroundColor Yellow
    
    try {
        Set-Location "backend\node-orchestrator"
        npm run build
        Set-Location "..\.."
        Write-Host "✅ Build completed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Build failed" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "✅ Node.js orchestrator is ready" -ForegroundColor Green
Write-Host ""

# Show demo options
Write-Host "🎯 Choose your demo option:" -ForegroundColor Cyan
Write-Host "1. Interactive HTML Demo (Recommended)" -ForegroundColor White
Write-Host "2. Command Line Mock Demo" -ForegroundColor White
Write-Host "3. Full API Demo (requires services)" -ForegroundColor White
Write-Host "4. Start All Services" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host "🌐 Opening Interactive HTML Demo..." -ForegroundColor Green
        Start-Process "demo.html"
        Write-Host "✅ Demo opened in your default browser!" -ForegroundColor Green
    }
    "2" {
        Write-Host "🎬 Running Command Line Mock Demo..." -ForegroundColor Green
        node demo-mock.js
    }
    "3" {
        Write-Host "🔧 Starting API services..." -ForegroundColor Yellow
        Write-Host "Starting Node.js orchestrator on port 4000..." -ForegroundColor Yellow
        
        # Start Node.js orchestrator in background
        $nodeJob = Start-Job -ScriptBlock {
            Set-Location "backend\node-orchestrator"
            npm start
        }
        
        # Wait for service to start
        Start-Sleep -Seconds 5
        
        Write-Host "🎬 Running Full API Demo..." -ForegroundColor Green
        node demo-satsconnect.js
        
        # Clean up
        Stop-Job $nodeJob
        Remove-Job $nodeJob
    }
    "4" {
        Write-Host "🚀 Starting All Services..." -ForegroundColor Green
        Write-Host "This will start:" -ForegroundColor Yellow
        Write-Host "  • Rust gRPC Engine (port 50051)" -ForegroundColor White
        Write-Host "  • Node.js Orchestrator (port 4000)" -ForegroundColor White
        Write-Host "  • React Native App (port 8081)" -ForegroundColor White
        Write-Host ""
        
        # Start services using npm run dev
        npm run dev
    }
    default {
        Write-Host "❌ Invalid choice. Please run the script again." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 Demo completed!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Additional commands:" -ForegroundColor Cyan
Write-Host "  npm run demo        # Run mock demo" -ForegroundColor White
Write-Host "  npm run demo:api    # Run full API demo" -ForegroundColor White
Write-Host "  npm run demo:html   # Open HTML demo" -ForegroundColor White
Write-Host "  npm run dev         # Start all services" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
