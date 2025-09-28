# SatsConnect Startup Script
Write-Host "🚀 Starting SatsConnect..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "backend/rust-engine/Cargo.toml")) {
    Write-Host "❌ Error: Please run this script from the SatsConnect root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm run install:all

Write-Host "🔨 Building Rust engine..." -ForegroundColor Yellow
cd backend/rust-engine
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Rust build failed" -ForegroundColor Red
    exit 1
}
cd ../..

Write-Host "🔨 Building Node.js orchestrator..." -ForegroundColor Yellow
cd backend/node-orchestrator
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js build failed" -ForegroundColor Red
    exit 1
}
cd ../..

Write-Host "✅ All builds completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 To start all services, run:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Or start individual services:" -ForegroundColor Cyan
Write-Host "   npm run start:rust    # Rust gRPC Engine (port 50051)" -ForegroundColor White
Write-Host "   npm run start:node    # Node.js Orchestrator (port 4000)" -ForegroundColor White
Write-Host "   npm run start:mobile  # React Native App (port 8081)" -ForegroundColor White
Write-Host ""
Write-Host "🌐 API Health Check: http://localhost:4000/health" -ForegroundColor Green
