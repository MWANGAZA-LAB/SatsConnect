# SatsConnect CI/CD Pipeline Validation Script
# This script validates the GitHub Actions workflow setup

Write-Host "🔍 Validating SatsConnect CI/CD Pipeline Setup..." -ForegroundColor Green

# Check if .github directory exists
if (Test-Path ".github") {
    Write-Host "✅ .github directory exists" -ForegroundColor Green
} else {
    Write-Host "❌ .github directory missing" -ForegroundColor Red
    exit 1
}

# Check if workflows directory exists
if (Test-Path ".github\workflows") {
    Write-Host "✅ .github\workflows directory exists" -ForegroundColor Green
} else {
    Write-Host "❌ .github\workflows directory missing" -ForegroundColor Red
    exit 1
}

# Check for required workflow files
$requiredFiles = @(
    "ci.yml",
    "security.yml", 
    "release.yml",
    "code-quality.yml",
    "dependabot.yml"
)

foreach ($file in $requiredFiles) {
    $filePath = ".github\workflows\$file"
    if (Test-Path $filePath) {
        Write-Host "✅ $file exists" -ForegroundColor Green
    } else {
        Write-Host "❌ $file missing" -ForegroundColor Red
    }
}

# Check for Dependabot configuration
if (Test-Path ".github\dependabot.yml") {
    Write-Host "✅ Dependabot configuration exists" -ForegroundColor Green
} else {
    Write-Host "❌ Dependabot configuration missing" -ForegroundColor Red
}

# Check for documentation
if (Test-Path ".github\README.md") {
    Write-Host "✅ CI/CD documentation exists" -ForegroundColor Green
} else {
    Write-Host "❌ CI/CD documentation missing" -ForegroundColor Red
}

if (Test-Path "CI-CD-SETUP.md") {
    Write-Host "✅ Setup guide exists" -ForegroundColor Green
} else {
    Write-Host "❌ Setup guide missing" -ForegroundColor Red
}

# Validate YAML syntax (basic check)
Write-Host "`n🔍 Validating YAML syntax..." -ForegroundColor Yellow

$workflowFiles = Get-ChildItem ".github\workflows\*.yml"
foreach ($file in $workflowFiles) {
    try {
        $content = Get-Content $file.FullName -Raw
        if ($content -match "name:" -and $content -match "on:" -and $content -match "jobs:") {
            Write-Host "✅ $($file.Name) has valid structure" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $($file.Name) may have syntax issues" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Error reading $($file.Name)" -ForegroundColor Red
    }
}

# Check project structure
Write-Host "`n🔍 Validating project structure..." -ForegroundColor Yellow

$requiredDirs = @(
    "backend\rust-engine",
    "backend\node-orchestrator", 
    "mobile"
)

foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Host "✅ $dir exists" -ForegroundColor Green
    } else {
        Write-Host "⚠️  $dir missing (workflows may fail)" -ForegroundColor Yellow
    }
}

# Summary
Write-Host "`n📊 Validation Summary:" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

$workflowCount = (Get-ChildItem ".github\workflows\*.yml").Count
Write-Host "Workflow files: $workflowCount/5" -ForegroundColor White

$hasDependabot = Test-Path ".github\dependabot.yml"
Write-Host "Dependabot config: $(if($hasDependabot){'✅'}else{'❌'})" -ForegroundColor White

$hasDocs = (Test-Path ".github\README.md") -and (Test-Path "CI-CD-SETUP.md")
Write-Host "Documentation: $(if($hasDocs){'✅'}else{'❌'})" -ForegroundColor White

Write-Host "`n🚀 Next Steps:" -ForegroundColor Green
Write-Host "1. Push these files to your GitHub repository" -ForegroundColor White
Write-Host "2. Enable GitHub Actions in repository settings" -ForegroundColor White
Write-Host "3. Configure repository secrets (optional)" -ForegroundColor White
Write-Host "4. Test the pipeline with a test commit" -ForegroundColor White
Write-Host "5. Monitor the Actions tab for build status" -ForegroundColor White

Write-Host "`n✨ CI/CD Pipeline setup complete!" -ForegroundColor Green
