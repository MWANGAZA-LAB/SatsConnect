#!/bin/bash

# SatsConnect Production Deployment Script
# This script deploys SatsConnect to production with proper security and monitoring

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="satsconnect-production"
STAGING_NAMESPACE="satsconnect-staging"
CHART_PATH="infra/k8s/helm/satsconnect"
VALUES_FILE="infra/k8s/helm/satsconnect/values.yaml"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

create_namespaces() {
    log_info "Creating namespaces..."
    
    # Create production namespace
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Create staging namespace
    kubectl create namespace $STAGING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Namespaces created"
}

setup_secrets() {
    log_info "Setting up secrets..."
    
    # Check if secrets exist
    if kubectl get secret rust-engine-secrets -n $NAMESPACE &> /dev/null; then
        log_warning "Rust engine secrets already exist"
    else
        log_info "Creating Rust engine secrets..."
        kubectl create secret generic rust-engine-secrets \
            --from-literal=bitcoin-rpc-url="${BITCOIN_RPC_URL:-}" \
            --from-literal=bitcoin-rpc-user="${BITCOIN_RPC_USER:-}" \
            --from-literal=bitcoin-rpc-password="${BITCOIN_RPC_PASSWORD:-}" \
            -n $NAMESPACE
    fi
    
    if kubectl get secret api-gateway-secrets -n $NAMESPACE &> /dev/null; then
        log_warning "API gateway secrets already exist"
    else
        log_info "Creating API gateway secrets..."
        kubectl create secret generic api-gateway-secrets \
            --from-literal=jwt-secret="${JWT_SECRET:-}" \
            --from-literal=mpesa-consumer-key="${MPESA_CONSUMER_KEY:-}" \
            --from-literal=mpesa-consumer-secret="${MPESA_CONSUMER_SECRET:-}" \
            --from-literal=mpesa-shortcode="${MPESA_SHORTCODE:-}" \
            --from-literal=mpesa-passkey="${MPESA_PASSKEY:-}" \
            --from-literal=coinmarketcap-api-key="${COINMARKETCAP_API_KEY:-}" \
            -n $NAMESPACE
    fi
    
    log_success "Secrets configured"
}

setup_configmap() {
    log_info "Setting up ConfigMap..."
    
    kubectl create configmap satsconnect-config \
        --from-literal=bitcoin-network="${BITCOIN_NETWORK:-mainnet}" \
        --from-literal=log-level="${LOG_LEVEL:-info}" \
        --from-literal=rate-limit-window-ms="${RATE_LIMIT_WINDOW_MS:-900000}" \
        --from-literal=rate-limit-max-requests="${RATE_LIMIT_MAX_REQUESTS:-100}" \
        -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "ConfigMap configured"
}

deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    # Add Helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Deploy Prometheus
    if helm list -n $NAMESPACE | grep -q prometheus; then
        log_warning "Prometheus already deployed, upgrading..."
        helm upgrade prometheus prometheus-community/kube-prometheus-stack \
            --namespace $NAMESPACE \
            --values infra/k8s/monitoring/prometheus-values.yaml
    else
        log_info "Installing Prometheus..."
        helm install prometheus prometheus-community/kube-prometheus-stack \
            --namespace $NAMESPACE \
            --values infra/k8s/monitoring/prometheus-values.yaml \
            --create-namespace
    fi
    
    # Deploy Grafana
    if helm list -n $NAMESPACE | grep -q grafana; then
        log_warning "Grafana already deployed, upgrading..."
        helm upgrade grafana grafana/grafana \
            --namespace $NAMESPACE \
            --set adminPassword="${GRAFANA_PASSWORD:-admin}" \
            --set persistence.enabled=true \
            --set persistence.size=10Gi \
            --set persistence.storageClassName=fast-ssd
    else
        log_info "Installing Grafana..."
        helm install grafana grafana/grafana \
            --namespace $NAMESPACE \
            --set adminPassword="${GRAFANA_PASSWORD:-admin}" \
            --set persistence.enabled=true \
            --set persistence.size=10Gi \
            --set persistence.storageClassName=fast-ssd \
            --create-namespace
    fi
    
    # Deploy Loki
    if helm list -n $NAMESPACE | grep -q loki; then
        log_warning "Loki already deployed, upgrading..."
        helm upgrade loki grafana/loki \
            --namespace $NAMESPACE \
            --set persistence.enabled=true \
            --set persistence.size=10Gi \
            --set persistence.storageClassName=fast-ssd
    else
        log_info "Installing Loki..."
        helm install loki grafana/loki \
            --namespace $NAMESPACE \
            --set persistence.enabled=true \
            --set persistence.size=10Gi \
            --set persistence.storageClassName=fast-ssd \
            --create-namespace
    fi
    
    log_success "Monitoring stack deployed"
}

deploy_satsconnect() {
    log_info "Deploying SatsConnect services..."
    
    # Deploy with Helm
    if helm list -n $NAMESPACE | grep -q satsconnect; then
        log_warning "SatsConnect already deployed, upgrading..."
        helm upgrade satsconnect $CHART_PATH \
            --namespace $NAMESPACE \
            --values $VALUES_FILE
    else
        log_info "Installing SatsConnect..."
        helm install satsconnect $CHART_PATH \
            --namespace $NAMESPACE \
            --values $VALUES_FILE \
            --create-namespace
    fi
    
    log_success "SatsConnect services deployed"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Wait for pods to be ready
    log_info "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=satsconnect -n $NAMESPACE --timeout=300s
    
    # Check pod status
    log_info "Checking pod status..."
    kubectl get pods -n $NAMESPACE
    
    # Check services
    log_info "Checking services..."
    kubectl get svc -n $NAMESPACE
    
    # Check ingress
    log_info "Checking ingress..."
    kubectl get ingress -n $NAMESPACE
    
    log_success "Deployment verification completed"
}

show_access_info() {
    log_info "Deployment completed successfully!"
    echo ""
    echo "=== Access Information ==="
    echo ""
    
    # Get API Gateway external IP
    API_IP=$(kubectl get svc satsconnect-api-gateway -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
    echo "API Gateway: http://$API_IP"
    echo ""
    
    # Port forward commands
    echo "=== Port Forward Commands ==="
    echo "Grafana: kubectl port-forward svc/grafana 3000:80 -n $NAMESPACE"
    echo "Prometheus: kubectl port-forward svc/prometheus-server 9090:80 -n $NAMESPACE"
    echo "API Gateway: kubectl port-forward svc/satsconnect-api-gateway 4000:80 -n $NAMESPACE"
    echo ""
    
    # Health check commands
    echo "=== Health Check Commands ==="
    echo "API Health: curl -f http://$API_IP/health"
    echo "Wallet Health: curl -f http://$API_IP/api/wallet/health"
    echo "Exchange Rate: curl -f http://$API_IP/api/bitcoin/exchange-rate"
    echo ""
    
    log_success "SatsConnect is now running in production!"
}

# Main execution
main() {
    log_info "Starting SatsConnect production deployment..."
    
    check_prerequisites
    create_namespaces
    setup_secrets
    setup_configmap
    deploy_monitoring
    deploy_satsconnect
    verify_deployment
    show_access_info
}

# Run main function
main "$@"
