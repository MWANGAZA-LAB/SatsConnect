#!/bin/bash

# SatsConnect Phase 4 Production Deployment Script
# This script deploys all Phase 4 advanced features to production

set -e

echo "🚀 Starting SatsConnect Phase 4 Production Deployment..."

# Configuration
NAMESPACE="satsconnect-prod"
REGISTRY="satsconnect.azurecr.io"
VERSION="v4.0.0"
ENVIRONMENT="production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "helm is not installed or not in PATH"
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        error "docker is not installed or not in PATH"
    fi
    
    # Check Kubernetes connection
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    success "Prerequisites check passed"
}

# Build and push Docker images
build_and_push_images() {
    log "Building and pushing Docker images..."
    
    # Build Rust Engine
    log "Building Rust Engine..."
    docker build -t ${REGISTRY}/satsconnect-rust-engine:${VERSION} \
        -f backend/rust-engine/Dockerfile \
        backend/rust-engine/
    docker push ${REGISTRY}/satsconnect-rust-engine:${VERSION}
    
    # Build Node.js Orchestrator
    log "Building Node.js Orchestrator..."
    docker build -t ${REGISTRY}/satsconnect-api-gateway:${VERSION} \
        -f backend/node-orchestrator/Dockerfile \
        backend/node-orchestrator/
    docker push ${REGISTRY}/satsconnect-api-gateway:${VERSION}
    
    # Build Mobile App (if needed)
    log "Building Mobile App..."
    docker build -t ${REGISTRY}/satsconnect-mobile:${VERSION} \
        -f mobile/Dockerfile \
        mobile/
    docker push ${REGISTRY}/satsconnect-mobile:${VERSION}
    
    success "Docker images built and pushed successfully"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    log "Deploying to Kubernetes..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy with Helm
    log "Deploying with Helm..."
    helm upgrade --install satsconnect-prod \
        ./infra/k8s/helm/satsconnect \
        --namespace ${NAMESPACE} \
        --set image.registry=${REGISTRY} \
        --set image.tag=${VERSION} \
        --set environment=${ENVIRONMENT} \
        --set rustEngine.replicas=5 \
        --set apiGateway.replicas=10 \
        --set monitoring.enabled=true \
        --set security.hsm.enabled=true \
        --set ai.fraudDetection.enabled=true \
        --set privacy.coinjoin.enabled=true \
        --set lsp.providers.enabled=true \
        --wait --timeout=10m
    
    success "Kubernetes deployment completed"
}

# Deploy monitoring stack
deploy_monitoring() {
    log "Deploying monitoring stack..."
    
    # Deploy Prometheus
    helm upgrade --install prometheus \
        prometheus-community/kube-prometheus-stack \
        --namespace ${NAMESPACE} \
        --set grafana.adminPassword=admin123 \
        --set prometheus.prometheusSpec.retention=30d \
        --wait --timeout=5m
    
    # Deploy Loki for logging
    helm upgrade --install loki \
        grafana/loki-stack \
        --namespace ${NAMESPACE} \
        --wait --timeout=5m
    
    success "Monitoring stack deployed"
}

# Deploy security components
deploy_security() {
    log "Deploying security components..."
    
    # Deploy Vault for secrets management
    helm upgrade --install vault \
        hashicorp/vault \
        --namespace ${NAMESPACE} \
        --set server.dev.enabled=true \
        --set server.dataStorage.enabled=true \
        --wait --timeout=5m
    
    # Deploy Trivy for vulnerability scanning
    helm upgrade --install trivy \
        aquasecurity/trivy-operator \
        --namespace ${NAMESPACE} \
        --wait --timeout=5m
    
    success "Security components deployed"
}

# Run health checks
run_health_checks() {
    log "Running health checks..."
    
    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=satsconnect-rust-engine -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=ready pod -l app=satsconnect-api-gateway -n ${NAMESPACE} --timeout=300s
    
    # Check service endpoints
    log "Checking service endpoints..."
    
    # Get service URLs
    RUST_ENGINE_URL=$(kubectl get service satsconnect-rust-engine -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    API_GATEWAY_URL=$(kubectl get service satsconnect-api-gateway -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    if [ -z "$RUST_ENGINE_URL" ] || [ -z "$API_GATEWAY_URL" ]; then
        warning "LoadBalancer IPs not available, using port-forward for testing"
        # Use port-forward for testing
        kubectl port-forward service/satsconnect-rust-engine 50051:50051 -n ${NAMESPACE} &
        kubectl port-forward service/satsconnect-api-gateway 3000:3000 -n ${NAMESPACE} &
        sleep 10
        RUST_ENGINE_URL="localhost:50051"
        API_GATEWAY_URL="localhost:3000"
    fi
    
    # Test Rust Engine health
    log "Testing Rust Engine health..."
    if curl -f http://${API_GATEWAY_URL}/health/rust-engine; then
        success "Rust Engine is healthy"
    else
        error "Rust Engine health check failed"
    fi
    
    # Test API Gateway health
    log "Testing API Gateway health..."
    if curl -f http://${API_GATEWAY_URL}/health; then
        success "API Gateway is healthy"
    else
        error "API Gateway health check failed"
    fi
    
    # Test GraphQL endpoint
    log "Testing GraphQL endpoint..."
    if curl -f -X POST http://${API_GATEWAY_URL}/graphql \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __schema { types { name } } }"}'; then
        success "GraphQL endpoint is working"
    else
        warning "GraphQL endpoint test failed"
    fi
}

# Deploy Phase 4 specific features
deploy_phase4_features() {
    log "Deploying Phase 4 advanced features..."
    
    # Deploy LSP providers
    log "Deploying LSP providers..."
    kubectl apply -f infra/k8s/lsp-providers/ -n ${NAMESPACE}
    
    # Deploy HSM integration
    log "Deploying HSM integration..."
    kubectl apply -f infra/k8s/security/hsm/ -n ${NAMESPACE}
    
    # Deploy AI fraud detection
    log "Deploying AI fraud detection..."
    kubectl apply -f infra/k8s/ai/fraud-detection/ -n ${NAMESPACE}
    
    # Deploy privacy features
    log "Deploying privacy features..."
    kubectl apply -f infra/k8s/privacy/coinjoin/ -n ${NAMESPACE}
    
    # Deploy push notifications
    log "Deploying push notifications..."
    kubectl apply -f infra/k8s/notifications/ -n ${NAMESPACE}
    
    success "Phase 4 features deployed"
}

# Main deployment function
main() {
    log "Starting SatsConnect Phase 4 Production Deployment"
    log "Version: ${VERSION}"
    log "Environment: ${ENVIRONMENT}"
    log "Namespace: ${NAMESPACE}"
    log "Registry: ${REGISTRY}"
    
    check_prerequisites
    build_and_push_images
    deploy_to_kubernetes
    deploy_monitoring
    deploy_security
    deploy_phase4_features
    run_health_checks
    
    success "🎉 SatsConnect Phase 4 Production Deployment Completed Successfully!"
    
    log "Deployment Summary:"
    log "- Rust Engine: ${REGISTRY}/satsconnect-rust-engine:${VERSION}"
    log "- API Gateway: ${REGISTRY}/satsconnect-api-gateway:${VERSION}"
    log "- Mobile App: ${REGISTRY}/satsconnect-mobile:${VERSION}"
    log "- Namespace: ${NAMESPACE}"
    log "- Monitoring: Prometheus + Grafana + Loki"
    log "- Security: Vault + Trivy + HSM"
    log "- Features: LSP + AI + Privacy + Notifications"
    
    log "Next steps:"
    log "1. Run security audit: ./scripts/security-audit.sh"
    log "2. Run performance tests: ./scripts/performance-test.sh"
    log "3. Begin user acceptance testing"
    log "4. Monitor deployment: kubectl get pods -n ${NAMESPACE}"
}

# Run main function
main "$@"
