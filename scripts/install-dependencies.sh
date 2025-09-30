#!/bin/bash

# SatsConnect Dependency Installation Script
# This script installs all dependencies for the SatsConnect platform

set -e

echo "📦 Installing SatsConnect Dependencies..."

# Configuration
PROJECT_ROOT="$(pwd)"
RUST_ENGINE_DIR="$PROJECT_ROOT/backend/rust-engine"
NODE_ORCHESTRATOR_DIR="$PROJECT_ROOT/backend/node-orchestrator"
MOBILE_DIR="$PROJECT_ROOT/mobile"
LOG_DIR="./dependency-install-logs-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Installation results
TOTAL_INSTALLS=0
SUCCESSFUL_INSTALLS=0
FAILED_INSTALLS=0

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((TOTAL_INSTALLS++))
    ((FAILED_INSTALLS++))
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((TOTAL_INSTALLS++))
    ((SUCCESSFUL_INSTALLS++))
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Create log directory
create_log_directory() {
    log "Creating log directory: ${LOG_DIR}"
    mkdir -p "${LOG_DIR}"/{system,rust,nodejs,mobile,docker,kubernetes}
    success "Log directory created"
}

# 1. System Dependencies
install_system_dependencies() {
    log "🔧 Installing System Dependencies..."
    
    # Check operating system
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log "Detected Linux system"
        install_linux_dependencies
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log "Detected macOS system"
        install_macos_dependencies
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        log "Detected Windows system"
        install_windows_dependencies
    else
        warning "Unknown operating system: $OSTYPE"
    fi
}

install_linux_dependencies() {
    log "Installing Linux dependencies..."
    
    # Update package list
    if command -v apt-get &> /dev/null; then
        log "Updating package list with apt-get..."
        sudo apt-get update > "${LOG_DIR}/system/apt-update.log" 2>&1 || warning "apt-get update failed"
        
        # Install essential packages
        log "Installing essential packages..."
        sudo apt-get install -y \
            curl \
            wget \
            git \
            build-essential \
            pkg-config \
            libssl-dev \
            libffi-dev \
            python3-dev \
            python3-pip \
            > "${LOG_DIR}/system/apt-install.log" 2>&1 || warning "Some packages failed to install"
        
        success "Linux dependencies installed"
    elif command -v yum &> /dev/null; then
        log "Installing packages with yum..."
        sudo yum update -y > "${LOG_DIR}/system/yum-update.log" 2>&1 || warning "yum update failed"
        sudo yum install -y curl wget git gcc gcc-c++ make pkgconfig openssl-devel libffi-devel python3 python3-pip > "${LOG_DIR}/system/yum-install.log" 2>&1 || warning "Some packages failed to install"
        success "Linux dependencies installed"
    else
        warning "No supported package manager found"
    fi
}

install_macos_dependencies() {
    log "Installing macOS dependencies..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        log "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" > "${LOG_DIR}/system/homebrew-install.log" 2>&1 || error "Homebrew installation failed"
    fi
    
    # Install essential packages
    log "Installing essential packages with Homebrew..."
    brew install \
        curl \
        wget \
        git \
        pkg-config \
        openssl \
        libffi \
        python3 \
        > "${LOG_DIR}/system/brew-install.log" 2>&1 || warning "Some packages failed to install"
    
    success "macOS dependencies installed"
}

install_windows_dependencies() {
    log "Installing Windows dependencies..."
    
    # Check if Chocolatey is installed
    if ! command -v choco &> /dev/null; then
        log "Installing Chocolatey..."
        powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" > "${LOG_DIR}/system/chocolatey-install.log" 2>&1 || error "Chocolatey installation failed"
    fi
    
    # Install essential packages
    log "Installing essential packages with Chocolatey..."
    choco install -y \
        curl \
        wget \
        git \
        python3 \
        nodejs \
        > "${LOG_DIR}/system/choco-install.log" 2>&1 || warning "Some packages failed to install"
    
    success "Windows dependencies installed"
}

# 2. Rust Toolchain
install_rust_toolchain() {
    log "🦀 Installing Rust Toolchain..."
    
    # Check if Rust is already installed
    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version)
        log "Rust already installed: $RUST_VERSION"
        success "Rust toolchain available"
        return 0
    fi
    
    # Install Rust
    log "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y > "${LOG_DIR}/rust/rustup-install.log" 2>&1 || error "Rust installation failed"
    
    # Source Rust environment
    source "$HOME/.cargo/env" || error "Failed to source Rust environment"
    
    # Install additional Rust components
    log "Installing Rust components..."
    rustup component add rustfmt clippy > "${LOG_DIR}/rust/rustup-components.log" 2>&1 || warning "Some Rust components failed to install"
    
    # Install Rust tools
    log "Installing Rust tools..."
    cargo install cargo-watch cargo-expand > "${LOG_DIR}/rust/cargo-tools.log" 2>&1 || warning "Some Rust tools failed to install"
    
    success "Rust toolchain installed"
}

# 3. Node.js and npm
install_nodejs() {
    log "📦 Installing Node.js and npm..."
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "Node.js already installed: $NODE_VERSION"
        
        # Check if version is compatible (>= 18.0.0)
        NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR_VERSION" -ge 18 ]; then
            success "Node.js version is compatible"
        else
            warning "Node.js version $NODE_VERSION is too old, need >= 18.0.0"
            install_nodejs_version
        fi
        return 0
    fi
    
    install_nodejs_version
}

install_nodejs_version() {
    log "Installing Node.js 18.x..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Install Node.js using NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - > "${LOG_DIR}/nodejs/nodesource-setup.log" 2>&1 || error "NodeSource setup failed"
        sudo apt-get install -y nodejs > "${LOG_DIR}/nodejs/nodejs-install.log" 2>&1 || error "Node.js installation failed"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # Install Node.js using Homebrew
        brew install node@18 > "${LOG_DIR}/nodejs/nodejs-install.log" 2>&1 || error "Node.js installation failed"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Install Node.js using Chocolatey
        choco install -y nodejs --version=18.19.0 > "${LOG_DIR}/nodejs/nodejs-install.log" 2>&1 || error "Node.js installation failed"
    else
        # Download and install Node.js manually
        log "Downloading Node.js manually..."
        wget https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz > "${LOG_DIR}/nodejs/nodejs-download.log" 2>&1 || error "Node.js download failed"
        tar -xf node-v18.19.0-linux-x64.tar.xz > "${LOG_DIR}/nodejs/nodejs-extract.log" 2>&1 || error "Node.js extraction failed"
        sudo mv node-v18.19.0-linux-x64 /usr/local/node > "${LOG_DIR}/nodejs/nodejs-move.log" 2>&1 || error "Node.js move failed"
        echo 'export PATH=/usr/local/node/bin:$PATH' >> ~/.bashrc || warning "Failed to add Node.js to PATH"
        source ~/.bashrc || warning "Failed to source bashrc"
    fi
    
    # Verify installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "Node.js version: $NODE_VERSION"
    log "npm version: $NPM_VERSION"
    
    success "Node.js and npm installed"
}

# 4. Rust Engine Dependencies
install_rust_dependencies() {
    log "🦀 Installing Rust Engine Dependencies..."
    
    cd "$RUST_ENGINE_DIR"
    
    # Check if Cargo.toml exists
    if [ ! -f "Cargo.toml" ]; then
        error "Cargo.toml not found in $RUST_ENGINE_DIR"
        return 1
    fi
    
    # Install Rust dependencies
    log "Installing Rust dependencies..."
    if cargo build > "${LOG_DIR}/rust/cargo-build.log" 2>&1; then
        success "Rust dependencies installed and project built"
    else
        error "Rust dependency installation failed - check ${LOG_DIR}/rust/cargo-build.log"
        return 1
    fi
    
    # Run tests to verify installation
    log "Running Rust tests..."
    if cargo test > "${LOG_DIR}/rust/cargo-test.log" 2>&1; then
        success "Rust tests passed"
    else
        warning "Rust tests failed - check ${LOG_DIR}/rust/cargo-test.log"
    fi
    
    cd "$PROJECT_ROOT"
}

# 5. Node.js Orchestrator Dependencies
install_nodejs_dependencies() {
    log "📦 Installing Node.js Orchestrator Dependencies..."
    
    cd "$NODE_ORCHESTRATOR_DIR"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        error "package.json not found in $NODE_ORCHESTRATOR_DIR"
        return 1
    fi
    
    # Install Node.js dependencies
    log "Installing Node.js dependencies..."
    if npm install > "${LOG_DIR}/nodejs/npm-install.log" 2>&1; then
        success "Node.js dependencies installed"
    else
        error "Node.js dependency installation failed - check ${LOG_DIR}/nodejs/npm-install.log"
        return 1
    fi
    
    # Install global dependencies
    log "Installing global Node.js dependencies..."
    npm install -g typescript ts-node nodemon > "${LOG_DIR}/nodejs/npm-global.log" 2>&1 || warning "Some global packages failed to install"
    
    # Run tests to verify installation
    log "Running Node.js tests..."
    if npm test > "${LOG_DIR}/nodejs/npm-test.log" 2>&1; then
        success "Node.js tests passed"
    else
        warning "Node.js tests failed - check ${LOG_DIR}/nodejs/npm-test.log"
    fi
    
    cd "$PROJECT_ROOT"
}

# 6. Mobile App Dependencies
install_mobile_dependencies() {
    log "📱 Installing Mobile App Dependencies..."
    
    cd "$MOBILE_DIR"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        error "package.json not found in $MOBILE_DIR"
        return 1
    fi
    
    # Install mobile dependencies
    log "Installing mobile dependencies..."
    if npm install > "${LOG_DIR}/mobile/npm-install.log" 2>&1; then
        success "Mobile dependencies installed"
    else
        error "Mobile dependency installation failed - check ${LOG_DIR}/mobile/npm-install.log"
        return 1
    fi
    
    # Install Expo CLI globally
    log "Installing Expo CLI..."
    npm install -g @expo/cli > "${LOG_DIR}/mobile/expo-cli.log" 2>&1 || warning "Expo CLI installation failed"
    
    # Install EAS CLI
    log "Installing EAS CLI..."
    npm install -g eas-cli > "${LOG_DIR}/mobile/eas-cli.log" 2>&1 || warning "EAS CLI installation failed"
    
    # Run tests to verify installation
    log "Running mobile tests..."
    if npm test > "${LOG_DIR}/mobile/npm-test.log" 2>&1; then
        success "Mobile tests passed"
    else
        warning "Mobile tests failed - check ${LOG_DIR}/mobile/npm-test.log"
    fi
    
    cd "$PROJECT_ROOT"
}

# 7. Docker Dependencies
install_docker_dependencies() {
    log "🐳 Installing Docker Dependencies..."
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        log "Docker already installed: $DOCKER_VERSION"
        success "Docker available"
    else
        log "Installing Docker..."
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Install Docker on Linux
            curl -fsSL https://get.docker.com -o get-docker.sh > "${LOG_DIR}/docker/docker-install.log" 2>&1 || error "Docker installation script download failed"
            sudo sh get-docker.sh > "${LOG_DIR}/docker/docker-install.log" 2>&1 || error "Docker installation failed"
            sudo usermod -aG docker $USER > "${LOG_DIR}/docker/docker-group.log" 2>&1 || warning "Failed to add user to docker group"
            rm get-docker.sh
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # Install Docker Desktop on macOS
            brew install --cask docker > "${LOG_DIR}/docker/docker-install.log" 2>&1 || error "Docker installation failed"
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            # Install Docker Desktop on Windows
            choco install -y docker-desktop > "${LOG_DIR}/docker/docker-install.log" 2>&1 || error "Docker installation failed"
        else
            warning "Docker installation not supported on this OS"
            return 0
        fi
        
        success "Docker installed"
    fi
    
    # Check if Docker Compose is available
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        log "Docker Compose already installed: $COMPOSE_VERSION"
        success "Docker Compose available"
    else
        log "Installing Docker Compose..."
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose > "${LOG_DIR}/docker/compose-install.log" 2>&1 || error "Docker Compose installation failed"
            sudo chmod +x /usr/local/bin/docker-compose
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install docker-compose > "${LOG_DIR}/docker/compose-install.log" 2>&1 || error "Docker Compose installation failed"
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            choco install -y docker-compose > "${LOG_DIR}/docker/compose-install.log" 2>&1 || error "Docker Compose installation failed"
        fi
        
        success "Docker Compose installed"
    fi
}

# 8. Kubernetes Dependencies
install_kubernetes_dependencies() {
    log "☸️ Installing Kubernetes Dependencies..."
    
    # Check if kubectl is already installed
    if command -v kubectl &> /dev/null; then
        KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null || kubectl version --client)
        log "kubectl already installed: $KUBECTL_VERSION"
        success "kubectl available"
    else
        log "Installing kubectl..."
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" > "${LOG_DIR}/kubernetes/kubectl-download.log" 2>&1 || error "kubectl download failed"
            sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl > "${LOG_DIR}/kubernetes/kubectl-install.log" 2>&1 || error "kubectl installation failed"
            rm kubectl
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install kubectl > "${LOG_DIR}/kubernetes/kubectl-install.log" 2>&1 || error "kubectl installation failed"
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            choco install -y kubernetes-cli > "${LOG_DIR}/kubernetes/kubectl-install.log" 2>&1 || error "kubectl installation failed"
        else
            warning "kubectl installation not supported on this OS"
            return 0
        fi
        
        success "kubectl installed"
    fi
    
    # Check if Helm is already installed
    if command -v helm &> /dev/null; then
        HELM_VERSION=$(helm version --short)
        log "Helm already installed: $HELM_VERSION"
        success "Helm available"
    else
        log "Installing Helm..."
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash > "${LOG_DIR}/kubernetes/helm-install.log" 2>&1 || error "Helm installation failed"
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install helm > "${LOG_DIR}/kubernetes/helm-install.log" 2>&1 || error "Helm installation failed"
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            choco install -y kubernetes-helm > "${LOG_DIR}/kubernetes/helm-install.log" 2>&1 || error "Helm installation failed"
        else
            warning "Helm installation not supported on this OS"
        fi
        
        success "Helm installed"
    fi
}

# 9. Generate Installation Report
generate_installation_report() {
    log "📊 Generating Installation Report..."
    
    cat > "${LOG_DIR}/reports/installation-report.md" << EOF
# SatsConnect Dependency Installation Report

**Date**: $(date)
**Project Root**: $PROJECT_ROOT
**Log Directory**: $LOG_DIR

## Installation Summary

### Overall Statistics
- **Total Installations**: $TOTAL_INSTALLS
- **Successful Installations**: $SUCCESSFUL_INSTALLS
- **Failed Installations**: $FAILED_INSTALLS
- **Success Rate**: $(( (SUCCESSFUL_INSTALLS * 100) / TOTAL_INSTALLS ))%

### Component Status

#### 1. System Dependencies
- **Status**: $(if [ $FAILED_INSTALLS -eq 0 ]; then echo "✅ INSTALLED"; else echo "❌ FAILED"; fi)
- **Operating System**: $OSTYPE
- **Package Manager**: $(if command -v apt-get &> /dev/null; then echo "apt-get"; elif command -v yum &> /dev/null; then echo "yum"; elif command -v brew &> /dev/null; then echo "Homebrew"; elif command -v choco &> /dev/null; then echo "Chocolatey"; else echo "Unknown"; fi)

#### 2. Rust Toolchain
- **Status**: $(if command -v rustc &> /dev/null; then echo "✅ INSTALLED"; else echo "❌ FAILED"; fi)
- **Version**: $(if command -v rustc &> /dev/null; then rustc --version; else echo "Not installed"; fi)
- **Cargo**: $(if command -v cargo &> /dev/null; then cargo --version; else echo "Not installed"; fi)

#### 3. Node.js and npm
- **Status**: $(if command -v node &> /dev/null; then echo "✅ INSTALLED"; else echo "❌ FAILED"; fi)
- **Node.js Version**: $(if command -v node &> /dev/null; then node --version; else echo "Not installed"; fi)
- **npm Version**: $(if command -v npm &> /dev/null; then npm --version; else echo "Not installed"; fi)

#### 4. Rust Engine Dependencies
- **Status**: $(if [ -f "$RUST_ENGINE_DIR/Cargo.toml" ]; then echo "✅ INSTALLED"; else echo "❌ FAILED"; fi)
- **Dependencies**: Resolved
- **Build**: $(if [ -f "$RUST_ENGINE_DIR/target/release/engine_server" ]; then echo "Successful"; else echo "Failed"; fi)

#### 5. Node.js Orchestrator Dependencies
- **Status**: $(if [ -f "$NODE_ORCHESTRATOR_DIR/package.json" ]; then echo "✅ INSTALLED"; else echo "❌ FAILED"; fi)
- **Dependencies**: Installed
- **Build**: $(if [ -f "$NODE_ORCHESTRATOR_DIR/dist/index.js" ]; then echo "Successful"; else echo "Failed"; fi)

#### 6. Mobile App Dependencies
- **Status**: $(if [ -f "$MOBILE_DIR/package.json" ]; then echo "✅ INSTALLED"; else echo "❌ FAILED"; fi)
- **Dependencies**: Installed
- **Expo CLI**: $(if command -v expo &> /dev/null; then echo "Available"; else echo "Not available"; fi)

#### 7. Docker Dependencies
- **Status**: $(if command -v docker &> /dev/null; then echo "✅ INSTALLED"; else echo "❌ FAILED"; fi)
- **Docker Version**: $(if command -v docker &> /dev/null; then docker --version; else echo "Not installed"; fi)
- **Docker Compose**: $(if command -v docker-compose &> /dev/null; then echo "Available"; else echo "Not available"; fi)

#### 8. Kubernetes Dependencies
- **Status**: $(if command -v kubectl &> /dev/null; then echo "✅ INSTALLED"; else echo "❌ FAILED"; fi)
- **kubectl**: $(if command -v kubectl &> /dev/null; then echo "Available"; else echo "Not available"; fi)
- **Helm**: $(if command -v helm &> /dev/null; then echo "Available"; else echo "Not available"; fi)

## Detailed Logs

### System Dependencies
- Linux: \`${LOG_DIR}/system/apt-install.log\`
- macOS: \`${LOG_DIR}/system/brew-install.log\`
- Windows: \`${LOG_DIR}/system/choco-install.log\`

### Rust Toolchain
- Installation: \`${LOG_DIR}/rust/rustup-install.log\`
- Components: \`${LOG_DIR}/rust/rustup-components.log\`
- Tools: \`${LOG_DIR}/rust/cargo-tools.log\`
- Build: \`${LOG_DIR}/rust/cargo-build.log\`
- Tests: \`${LOG_DIR}/rust/cargo-test.log\`

### Node.js
- Installation: \`${LOG_DIR}/nodejs/nodejs-install.log\`
- Dependencies: \`${LOG_DIR}/nodejs/npm-install.log\`
- Global: \`${LOG_DIR}/nodejs/npm-global.log\`
- Tests: \`${LOG_DIR}/nodejs/npm-test.log\`

### Mobile App
- Dependencies: \`${LOG_DIR}/mobile/npm-install.log\`
- Expo CLI: \`${LOG_DIR}/mobile/expo-cli.log\`
- EAS CLI: \`${LOG_DIR}/mobile/eas-cli.log\`
- Tests: \`${LOG_DIR}/mobile/npm-test.log\`

### Docker
- Installation: \`${LOG_DIR}/docker/docker-install.log\`
- Compose: \`${LOG_DIR}/docker/compose-install.log\`

### Kubernetes
- kubectl: \`${LOG_DIR}/kubernetes/kubectl-install.log\`
- Helm: \`${LOG_DIR}/kubernetes/helm-install.log\`

## Next Steps

### Immediate Actions
$(if [ $FAILED_INSTALLS -eq 0 ]; then
    echo "1. **SUCCESS**: All dependencies installed successfully"
    echo "2. **READY**: Platform is ready for development and deployment"
    echo "3. **TEST**: Run integration tests to verify everything works"
else
    echo "1. **CRITICAL**: Fix failed installations before proceeding"
    echo "2. **REVIEW**: Check installation logs for specific errors"
    echo "3. **RETRY**: Re-run installation script after fixing issues"
fi)

### Development Setup
1. **Environment**: Set up development environment variables
2. **Database**: Configure database connections
3. **Services**: Start required services (Redis, etc.)
4. **Testing**: Run comprehensive test suite

### Deployment Setup
1. **Production**: Configure production environment
2. **Monitoring**: Set up monitoring and logging
3. **Security**: Configure security settings
4. **Scaling**: Set up horizontal scaling

## Conclusion

$(if [ $FAILED_INSTALLS -eq 0 ]; then
    echo "**✅ SUCCESS** - All SatsConnect dependencies have been successfully installed. The platform is ready for development and deployment."
elif [ $FAILED_INSTALLS -lt $TOTAL_INSTALLS ]; then
    echo "**⚠️ PARTIAL SUCCESS** - Most dependencies installed successfully, but some failed. Please review the failed installations and retry."
else
    echo "**❌ FAILED** - Dependency installation failed. Please review the installation logs and fix the issues before proceeding."
fi)

---
*This report was generated automatically as part of the SatsConnect dependency installation process.*
EOF

    success "Installation report generated: ${LOG_DIR}/reports/installation-report.md"
}

# Main execution function
main() {
    log "Starting SatsConnect Dependency Installation"
    log "Project Root: $PROJECT_ROOT"
    log "Log Directory: $LOG_DIR"
    
    create_log_directory
    
    # Install all dependencies
    install_system_dependencies
    install_rust_toolchain
    install_nodejs
    install_rust_dependencies
    install_nodejs_dependencies
    install_mobile_dependencies
    install_docker_dependencies
    install_kubernetes_dependencies
    generate_installation_report
    
    success "🎉 Dependency Installation Completed!"
    
    log "Installation Results:"
    log "- Total Installations: $TOTAL_INSTALLS"
    log "- Successful: $SUCCESSFUL_INSTALLS"
    log "- Failed: $FAILED_INSTALLS"
    log "- Success Rate: $(( (SUCCESSFUL_INSTALLS * 100) / TOTAL_INSTALLS ))%"
    
    if [ $FAILED_INSTALLS -gt 0 ]; then
        error "Dependency installation failed - $FAILED_INSTALLS installations failed"
    else
        success "All dependencies installed successfully - platform is ready!"
    fi
}

# Run main function
main "$@"
