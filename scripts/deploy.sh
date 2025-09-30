#!/bin/bash

# SatsConnect Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
COMPOSE_FILE="docker-compose.yml"
if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.yml -f docker-compose.prod.yml"
fi

echo -e "${GREEN}🚀 Starting SatsConnect deployment for $ENVIRONMENT environment${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose and try again.${NC}"
    exit 1
fi

# Create necessary directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p nginx/ssl
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources
mkdir -p monitoring/logstash
mkdir -p logs

# Check for required environment variables
echo -e "${YELLOW}🔍 Checking environment variables...${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
    required_vars=("JWT_SECRET" "REDIS_PASSWORD" "GRAFANA_PASSWORD" "MPESA_CONSUMER_KEY" "MPESA_CONSUMER_SECRET")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}❌ Required environment variable $var is not set${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✅ All required environment variables are set${NC}"
fi

# Build images
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker-compose -f $COMPOSE_FILE build --no-cache

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f $COMPOSE_FILE down

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 30

# Health checks
echo -e "${YELLOW}🏥 Performing health checks...${NC}"

# Check orchestrator
if curl -f http://localhost:4000/health/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Orchestrator is healthy${NC}"
else
    echo -e "${RED}❌ Orchestrator health check failed${NC}"
    docker-compose -f $COMPOSE_FILE logs node-orchestrator
    exit 1
fi

# Check Redis
if docker-compose -f $COMPOSE_FILE exec redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is healthy${NC}"
else
    echo -e "${RED}❌ Redis health check failed${NC}"
    exit 1
fi

# Check Nginx
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nginx is healthy${NC}"
else
    echo -e "${RED}❌ Nginx health check failed${NC}"
    exit 1
fi

# Show service status
echo -e "${YELLOW}📊 Service status:${NC}"
docker-compose -f $COMPOSE_FILE ps

# Show service URLs
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}📋 Service URLs:${NC}"
echo -e "  • API: http://localhost:4000"
echo -e "  • Nginx: http://localhost"
echo -e "  • Grafana: http://localhost:3000"
echo -e "  • Prometheus: http://localhost:9090"
echo -e "  • Kibana: http://localhost:5601"

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${YELLOW}⚠️  Production deployment detected. Please ensure:${NC}"
    echo -e "  • SSL certificates are properly configured"
    echo -e "  • Firewall rules are set up correctly"
    echo -e "  • Monitoring alerts are configured"
    echo -e "  • Backup procedures are in place"
fi

echo -e "${GREEN}✨ SatsConnect is now running!${NC}"
