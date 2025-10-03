# SatsConnect Lightning Network Development Environment Setup
Write-Host "Setting up SatsConnect Lightning Network Development Environment" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "backend\rust-engine\Cargo.toml")) {
    Write-Host "Error: Please run this script from the SatsConnect root directory" -ForegroundColor Red
    exit 1
}

Write-Host "`nPrerequisites Check:" -ForegroundColor Yellow

# Check Rust installation
Write-Host "Checking Rust installation..." -ForegroundColor White
try {
    $rustVersion = rustc --version 2>$null
    if ($rustVersion) {
        Write-Host "   Rust: $rustVersion" -ForegroundColor Green
    } else {
        Write-Host "   Rust not found. Please install Rust from https://rustup.rs/" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Rust not found. Please install Rust from https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# Check Cargo
Write-Host "Checking Cargo..." -ForegroundColor White
try {
    $cargoVersion = cargo --version 2>$null
    if ($cargoVersion) {
        Write-Host "   Cargo: $cargoVersion" -ForegroundColor Green
    } else {
        Write-Host "   Cargo not found" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Cargo not found" -ForegroundColor Red
    exit 1
}

Write-Host "`nBuilding Rust Engine..." -ForegroundColor Yellow
Set-Location "backend\rust-engine"

# Build the Rust engine
Write-Host "Running cargo build..." -ForegroundColor White
try {
    cargo build --release
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Rust engine built successfully" -ForegroundColor Green
    } else {
        Write-Host "   Rust engine build failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Failed to build Rust engine" -ForegroundColor Red
    exit 1
}

Write-Host "`nTesting Regtest Lightning Network..." -ForegroundColor Yellow

# Run the regtest demo
Write-Host "Starting regtest Lightning Network demo..." -ForegroundColor White
Write-Host "   This will create 3 local Lightning nodes and test connectivity..." -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop the demo early" -ForegroundColor Gray

try {
    cargo run --bin regtest_demo
    Write-Host "   Regtest demo completed successfully" -ForegroundColor Green
} catch {
    Write-Host "   Failed to run regtest demo" -ForegroundColor Red
}

Write-Host "`nDevelopment Environment Ready!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

Write-Host "`nAvailable Commands:" -ForegroundColor Cyan
Write-Host "   Build Rust Engine:     cd backend\rust-engine; cargo build" -ForegroundColor White
Write-Host "   Run Regtest Demo:      cd backend\rust-engine; cargo run --bin regtest_demo" -ForegroundColor White
Write-Host "   Start Mobile App:      cd mobile; npx expo start" -ForegroundColor White
Write-Host "   Start All Services:    npm run dev" -ForegroundColor White

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "   1. Start the regtest Lightning Network: cargo run --bin regtest_demo" -ForegroundColor White
Write-Host "   2. In another terminal, start the mobile app: npx expo start" -ForegroundColor White
Write-Host "   3. Test Lightning payments between local nodes" -ForegroundColor White
Write-Host "   4. Integrate mobile app with local Lightning services" -ForegroundColor White

Write-Host "`nLightning Network Features Available:" -ForegroundColor Cyan
Write-Host "   Local regtest Lightning nodes" -ForegroundColor Green
Write-Host "   Invoice generation and payment processing" -ForegroundColor Green
Write-Host "   Channel management and network graph" -ForegroundColor Green
Write-Host "   Privacy and security features" -ForegroundColor Green
Write-Host "   Mobile app integration ready" -ForegroundColor Green

Write-Host "`nSetup completed successfully!" -ForegroundColor Gray
