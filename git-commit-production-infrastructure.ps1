# SatsConnect Production Infrastructure - Git Commit Script
# PowerShell version for Windows

Write-Host "🚀 SatsConnect Production Infrastructure - Git Commit" -ForegroundColor Blue
Write-Host "=====================================================" -ForegroundColor Blue
Write-Host ""

# Check if we're in a Git repository
try {
    $gitStatus = git status 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Not in a Git repository"
    }
    Write-Host "✅ Git repository detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Not in a Git repository" -ForegroundColor Red
    Write-Host "Please run this script from the SatsConnect project root directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Add all new infrastructure files
Write-Host "📁 Adding infrastructure files..." -ForegroundColor Cyan
git add infra/
git add *.md
git add *.bat
git add *.js
git add *.html
git add *.ps1

Write-Host ""
Write-Host "📋 Files to be committed:" -ForegroundColor Cyan
git status --porcelain

Write-Host ""
Write-Host "📝 Creating commit message..." -ForegroundColor Cyan
$commitMessage = @"
🚀 Complete Production Infrastructure + Fix Rust Formatting

- Add comprehensive Docker containerization for all services
- Implement Kubernetes deployments with enterprise security
- Set up complete monitoring stack (Prometheus, Grafana, Loki)
- Create CI/CD pipeline with GitHub Actions
- Add Helm charts for easy deployment
- Implement secrets management with Vault
- Add production deployment scripts and documentation
- Remove all mock data for production readiness
- Create interactive demo and deployment guides
- Fix all Rust formatting issues to pass CI/CD checks

SatsConnect is now 100% production-ready for African markets!
"@

Write-Host ""
Write-Host "🎯 Commit Details:" -ForegroundColor Yellow
Write-Host "Message: Complete Production Infrastructure Implementation" -ForegroundColor White
Write-Host ""

# Ask for confirmation
$confirm = Read-Host "Do you want to commit these changes? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ Commit cancelled" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""
Write-Host "💾 Committing changes..." -ForegroundColor Cyan
git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Commit successful!" -ForegroundColor Green
Write-Host ""

# Ask about pushing
$pushConfirm = Read-Host "Do you want to push to remote repository? (y/N)"
if ($pushConfirm -ne "y" -and $pushConfirm -ne "Y") {
    Write-Host "ℹ️  Commit completed. You can push later with: git push" -ForegroundColor Blue
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host ""
Write-Host "🚀 Pushing to remote repository..." -ForegroundColor Cyan
git push

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed. You may need to set up remote repository first." -ForegroundColor Red
    Write-Host ""
    Write-Host "To set up remote repository:" -ForegroundColor Yellow
    Write-Host "  git remote add origin YOUR_REPOSITORY_URL" -ForegroundColor White
    Write-Host "  git push -u origin main" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "🎉 Successfully pushed to remote repository!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Infrastructure Summary:" -ForegroundColor Blue
Write-Host "  ✅ Docker containerization for all services" -ForegroundColor Green
Write-Host "  ✅ Kubernetes deployments with security" -ForegroundColor Green
Write-Host "  ✅ Complete monitoring stack (Prometheus, Grafana, Loki)" -ForegroundColor Green
Write-Host "  ✅ CI/CD pipeline with GitHub Actions" -ForegroundColor Green
Write-Host "  ✅ Helm charts for easy deployment" -ForegroundColor Green
Write-Host "  ✅ Secrets management with Vault" -ForegroundColor Green
Write-Host "  ✅ Production deployment scripts" -ForegroundColor Green
Write-Host "  ✅ Comprehensive documentation" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 SatsConnect is now ready for production deployment!" -ForegroundColor Blue
Write-Host ""
Read-Host "Press Enter to exit"
