# 🚀 SatsConnect Production Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying SatsConnect to production with proper security, monitoring, and scalability measures.

## Prerequisites

### 1. Infrastructure Requirements
- **Kubernetes Cluster**: v1.24+ with at least 3 nodes
- **Storage**: Fast SSD storage class for persistent volumes
- **Load Balancer**: For external API access
- **DNS**: Domain configured for API endpoints
- **SSL/TLS**: Certificate management (Let's Encrypt recommended)

### 2. Required Tools
```bash
# Install required tools
kubectl version --client
helm version
docker --version
git --version
```

### 3. Secrets Management
- **HashiCorp Vault** (recommended) or **Kubernetes Secrets**
- **MPesa Daraja API** credentials
- **Bitcoin RPC** credentials
- **Exchange Rate API** keys
- **JWT secrets** for authentication

## Deployment Steps

### Step 1: Environment Setup

#### 1.1 Create Kubernetes Namespaces
```bash
# Create production namespace
kubectl create namespace satsconnect-production

# Create staging namespace
kubectl create namespace satsconnect-staging

# Verify namespaces
kubectl get namespaces | grep satsconnect
```

#### 1.2 Configure Secrets
```bash
# Create secrets from environment variables
kubectl create secret generic rust-engine-secrets \
  --from-literal=bitcoin-rpc-url="$BITCOIN_RPC_URL" \
  --from-literal=bitcoin-rpc-user="$BITCOIN_RPC_USER" \
  --from-literal=bitcoin-rpc-password="$BITCOIN_RPC_PASSWORD" \
  -n satsconnect-production

kubectl create secret generic api-gateway-secrets \
  --from-literal=jwt-secret="$JWT_SECRET" \
  --from-literal=mpesa-consumer-key="$MPESA_CONSUMER_KEY" \
  --from-literal=mpesa-consumer-secret="$MPESA_CONSUMER_SECRET" \
  --from-literal=mpesa-shortcode="$MPESA_SHORTCODE" \
  --from-literal=mpesa-passkey="$MPESA_PASSKEY" \
  --from-literal=coinmarketcap-api-key="$COINMARKETCAP_API_KEY" \
  -n satsconnect-production
```

#### 1.3 Create ConfigMap
```bash
kubectl create configmap satsconnect-config \
  --from-literal=bitcoin-network=mainnet \
  --from-literal=log-level=info \
  --from-literal=rate-limit-window-ms=900000 \
  --from-literal=rate-limit-max-requests=100 \
  -n satsconnect-production
```

### Step 2: Deploy Monitoring Stack

#### 2.1 Install Prometheus and Grafana
```bash
# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace satsconnect-production \
  --values infra/k8s/monitoring/prometheus-values.yaml \
  --create-namespace

# Install Grafana
helm install grafana grafana/grafana \
  --namespace satsconnect-production \
  --set adminPassword=admin \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --set persistence.storageClassName=fast-ssd
```

#### 2.2 Install Loki for Log Aggregation
```bash
# Install Loki
helm install loki grafana/loki \
  --namespace satsconnect-production \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --set persistence.storageClassName=fast-ssd
```

### Step 3: Deploy SatsConnect Services

#### 3.1 Deploy Rust Lightning Engine
```bash
# Apply Rust engine deployment
kubectl apply -f infra/k8s/rust-engine-deployment.yaml

# Verify deployment
kubectl get pods -n satsconnect-production -l app=satsconnect-rust-engine
kubectl get svc -n satsconnect-production -l app=satsconnect-rust-engine
```

#### 3.2 Deploy API Gateway
```bash
# Apply API gateway deployment
kubectl apply -f infra/k8s/api-gateway-deployment.yaml

# Verify deployment
kubectl get pods -n satsconnect-production -l app=satsconnect-api-gateway
kubectl get svc -n satsconnect-production -l app=satsconnect-api-gateway
kubectl get ingress -n satsconnect-production
```

### Step 4: Deploy with Helm (Alternative)

#### 4.1 Install SatsConnect Helm Chart
```bash
# Install the chart
helm install satsconnect infra/k8s/helm/satsconnect \
  --namespace satsconnect-production \
  --values infra/k8s/helm/satsconnect/values.yaml \
  --create-namespace

# Verify installation
helm list -n satsconnect-production
kubectl get all -n satsconnect-production
```

### Step 5: Verify Deployment

#### 5.1 Check Service Health
```bash
# Check pod status
kubectl get pods -n satsconnect-production

# Check service endpoints
kubectl get endpoints -n satsconnect-production

# Check ingress
kubectl get ingress -n satsconnect-production
```

#### 5.2 Test API Endpoints
```bash
# Get API gateway external IP
API_IP=$(kubectl get svc satsconnect-api-gateway -n satsconnect-production -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test health endpoint
curl -f http://$API_IP/health

# Test API endpoints
curl -f http://$API_IP/api/wallet/health
curl -f http://$API_IP/api/bitcoin/exchange-rate
```

#### 5.3 Check Monitoring
```bash
# Access Grafana
kubectl port-forward svc/grafana 3000:80 -n satsconnect-production
# Open http://localhost:3000 (admin/admin)

# Access Prometheus
kubectl port-forward svc/prometheus-server 9090:80 -n satsconnect-production
# Open http://localhost:9090
```

## CI/CD Pipeline Setup

### 1. GitHub Actions Configuration

#### 1.1 Repository Secrets
Add the following secrets to your GitHub repository:
- `KUBE_CONFIG_PRODUCTION`: Base64 encoded kubeconfig
- `KUBE_CONFIG_STAGING`: Base64 encoded kubeconfig
- `SLACK_WEBHOOK_URL`: Slack webhook for notifications
- `DOCKER_REGISTRY_TOKEN`: Docker registry authentication

#### 1.2 Environment Protection Rules
- **Staging**: Auto-deploy on `develop` branch
- **Production**: Manual approval required for `main` branch

### 2. Deployment Pipeline
```bash
# The CI/CD pipeline will:
# 1. Run security scans
# 2. Run tests (Rust, Node.js, Mobile)
# 3. Build Docker images
# 4. Push to registry
# 5. Deploy to staging (auto)
# 6. Deploy to production (manual approval)
```

## Monitoring and Alerting

### 1. Grafana Dashboards
- **SatsConnect Overview**: System health, request rates, response times
- **Lightning Network**: Channel status, payment metrics, balance tracking
- **MPesa Integration**: Transaction rates, success rates, amount distributions

### 2. Prometheus Alerts
```yaml
# Example alert rules
groups:
- name: satsconnect.rules
  rules:
  - alert: SatsConnectDown
    expr: up{job="satsconnect-api-gateway"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "SatsConnect API Gateway is down"
      
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
```

### 3. Log Aggregation
- **Loki**: Centralized log collection
- **Promtail**: Log shipping from pods
- **Grafana**: Log visualization and querying

## Security Considerations

### 1. Network Security
- **Network Policies**: Restrict pod-to-pod communication
- **Ingress Security**: Rate limiting, SSL termination
- **Service Mesh**: Consider Istio for advanced traffic management

### 2. Secrets Management
- **Vault Integration**: Use HashiCorp Vault for secrets
- **Secret Rotation**: Implement automatic secret rotation
- **RBAC**: Proper role-based access control

### 3. Container Security
- **Image Scanning**: Regular vulnerability scans
- **Non-root Users**: Run containers as non-root
- **Read-only Filesystems**: Immutable container filesystems

## Scaling Considerations

### 1. Horizontal Scaling
- **HPA**: Horizontal Pod Autoscaler based on CPU/memory
- **VPA**: Vertical Pod Autoscaler for resource optimization
- **Cluster Autoscaler**: Automatic node scaling

### 2. Database Scaling
- **PostgreSQL**: Consider managed database service
- **Connection Pooling**: Implement connection pooling
- **Read Replicas**: For read-heavy workloads

### 3. Caching
- **Redis**: For session storage and caching
- **CDN**: For static assets and API responses

## Backup and Disaster Recovery

### 1. Data Backup
- **Persistent Volumes**: Regular volume snapshots
- **Database Backups**: Automated database backups
- **Configuration Backup**: GitOps for configuration management

### 2. Disaster Recovery
- **Multi-region**: Deploy across multiple regions
- **Backup Restore**: Tested restore procedures
- **RTO/RPO**: Define recovery time and point objectives

## Troubleshooting

### 1. Common Issues
```bash
# Check pod logs
kubectl logs -f deployment/satsconnect-rust-engine -n satsconnect-production

# Check service endpoints
kubectl describe svc satsconnect-api-gateway -n satsconnect-production

# Check ingress status
kubectl describe ingress satsconnect-api-gateway-ingress -n satsconnect-production
```

### 2. Performance Issues
- Check resource utilization
- Review application logs
- Monitor network latency
- Analyze database performance

## Maintenance

### 1. Regular Updates
- **Security Patches**: Regular security updates
- **Dependency Updates**: Keep dependencies current
- **Kubernetes Updates**: Stay current with K8s versions

### 2. Monitoring
- **Health Checks**: Regular health check validation
- **Performance Monitoring**: Continuous performance monitoring
- **Capacity Planning**: Regular capacity planning reviews

---

## 🎯 Production Checklist

- [ ] Kubernetes cluster configured
- [ ] Secrets properly configured
- [ ] Monitoring stack deployed
- [ ] SatsConnect services deployed
- [ ] CI/CD pipeline configured
- [ ] SSL/TLS certificates configured
- [ ] DNS records configured
- [ ] Health checks passing
- [ ] Monitoring dashboards configured
- [ ] Alerting rules configured
- [ ] Backup procedures tested
- [ ] Disaster recovery procedures documented

**🚀 SatsConnect is now ready for production deployment!**
