@echo off
echo 🚀 SatsConnect Production Infrastructure - Git Commit
echo =====================================================
echo.

REM Check if we're in a Git repository
git status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Not in a Git repository
    echo Please run this script from the SatsConnect project root directory
    pause
    exit /b 1
)

echo ✅ Git repository detected
echo.

REM Add all new infrastructure files
echo 📁 Adding infrastructure files...
git add infra/
git add *.md
git add *.bat
git add *.js
git add *.html
git add *.ps1

echo.
echo 📋 Files to be committed:
git status --porcelain

echo.
echo 📝 Creating commit message...
set COMMIT_MESSAGE=🚀 Complete Production Infrastructure Implementation

echo.
echo 🎯 Commit Details:
echo Message: %COMMIT_MESSAGE%
echo.

REM Ask for confirmation
set /p CONFIRM="Do you want to commit these changes? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo ❌ Commit cancelled
    pause
    exit /b 0
)

echo.
echo 💾 Committing changes...
git commit -m "%COMMIT_MESSAGE%"

if %errorlevel% neq 0 (
    echo ❌ Commit failed
    pause
    exit /b 1
)

echo ✅ Commit successful!
echo.

REM Ask about pushing
set /p PUSH_CONFIRM="Do you want to push to remote repository? (y/N): "
if /i not "%PUSH_CONFIRM%"=="y" (
    echo ℹ️  Commit completed. You can push later with: git push
    pause
    exit /b 0
)

echo.
echo 🚀 Pushing to remote repository...
git push

if %errorlevel% neq 0 (
    echo ❌ Push failed. You may need to set up remote repository first.
    echo.
    echo To set up remote repository:
    echo   git remote add origin YOUR_REPOSITORY_URL
    echo   git push -u origin main
    pause
    exit /b 1
)

echo.
echo 🎉 Successfully pushed to remote repository!
echo.
echo 📊 Infrastructure Summary:
echo   ✅ Docker containerization for all services
echo   ✅ Kubernetes deployments with security
echo   ✅ Complete monitoring stack (Prometheus, Grafana, Loki)
echo   ✅ CI/CD pipeline with GitHub Actions
echo   ✅ Helm charts for easy deployment
echo   ✅ Secrets management with Vault
echo   ✅ Production deployment scripts
echo   ✅ Comprehensive documentation
echo.
echo 🚀 SatsConnect is now ready for production deployment!
echo.
pause
