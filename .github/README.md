# SatsConnect CI/CD Pipeline

This directory contains GitHub Actions workflows for the SatsConnect project, providing automated testing, security scanning, and deployment capabilities.

## Workflows

### 1. CI Pipeline (`ci.yml`)
**Triggers:** Push to main/develop, Pull Requests, Manual dispatch

**Jobs:**
- **Rust Engine**: Builds and tests the gRPC Lightning engine
- **Node.js Orchestrator**: Tests the REST API and fiat integrations
- **React Native App**: Validates the mobile application
- **Security Checks**: Runs vulnerability scans and secret detection
- **Docker Build**: Builds and tests Docker containers
- **E2E Tests**: Runs integration tests with all services

**Features:**
- ✅ Dependency caching for faster builds
- ✅ Security auditing with Trivy and TruffleHog
- ✅ Code quality checks (ESLint, Prettier, Clippy)
- ✅ Comprehensive test coverage
- ✅ Artifact uploads for deployment

### 2. Security Audit (`security.yml`)
**Triggers:** Daily schedule, Push to main, Pull Requests, Manual dispatch

**Features:**
- 🔍 Vulnerability scanning with Trivy
- 🔐 Secret detection with TruffleHog
- 📊 CodeQL analysis for security issues
- 📈 SARIF report generation

### 3. Release Pipeline (`release.yml`)
**Triggers:** Git tags (v*), Manual dispatch

**Features:**
- 🚀 Automated release creation
- 🐳 Docker image building and pushing
- 📱 Mobile app builds (Android APK, iOS IPA)
- 📦 Asset uploads to GitHub Releases

### 4. Dependabot Auto-merge (`dependabot.yml`)
**Triggers:** Dependabot pull requests

**Features:**
- 🔄 Auto-merge for patch and minor updates
- ⚠️ Manual review for major updates
- 📅 Weekly dependency updates

## Configuration

### Environment Variables
The following secrets need to be configured in the repository:

```bash
# Required for Docker registry push
GITHUB_TOKEN  # Automatically provided

# Optional for enhanced security
TRIVY_TOKEN   # For Trivy vulnerability database
```

### Dependabot Configuration
Dependabot is configured to update:
- Rust dependencies (Cargo)
- Node.js dependencies (npm)
- GitHub Actions
- Docker images

Updates are scheduled weekly on Mondays at 9:00 AM UTC.

## Usage

### Running Tests Locally
```bash
# Rust Engine
cd backend/rust-engine
cargo test

# Node.js Orchestrator
cd backend/node-orchestrator
npm test

# React Native App
cd mobile
npm test
```

### Manual Workflow Trigger
1. Go to Actions tab in GitHub
2. Select the desired workflow
3. Click "Run workflow"
4. Choose the target branch and environment

### Creating a Release
```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0

# Or use the manual trigger with version input
```

## Security Features

### Vulnerability Scanning
- **Trivy**: Scans for known vulnerabilities in dependencies and Docker images
- **TruffleHog**: Detects secrets and credentials in code
- **CodeQL**: Analyzes code for security issues

### Dependency Management
- **Cargo Audit**: Rust dependency security scanning
- **npm audit**: Node.js dependency vulnerability checks
- **Dependabot**: Automated dependency updates

### Code Quality
- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **Clippy**: Rust linting and suggestions
- **TypeScript**: Type checking

## Monitoring

### Build Status
- ✅ Green: All checks passed
- ❌ Red: One or more checks failed
- 🟡 Yellow: Build in progress or warnings

### Artifacts
- Rust binary: `rust-engine-binary`
- Node.js dist: `node-orchestrator-dist`
- Mobile bundles: `react-native-bundles`
- Security reports: `security-scan-results`

## Troubleshooting

### Common Issues

1. **Rust build failures**
   - Check Cargo.toml dependencies
   - Verify Rust version compatibility
   - Run `cargo clean` and retry

2. **Node.js test failures**
   - Ensure all environment variables are set
   - Check package.json scripts
   - Verify test database connections

3. **Mobile build issues**
   - Check Expo CLI version
   - Verify app.json configuration
   - Ensure all dependencies are installed

4. **Security scan failures**
   - Review vulnerability reports
   - Update vulnerable dependencies
   - Check for exposed secrets

### Getting Help
- Check the Actions tab for detailed logs
- Review the Security tab for vulnerability reports
- Open an issue for persistent problems

## Contributing

When adding new workflows:
1. Follow the existing naming conventions
2. Include proper error handling
3. Add appropriate caching
4. Document any new environment variables
5. Test workflows on feature branches first

## License

This CI/CD configuration is part of the SatsConnect project and follows the same license terms.
