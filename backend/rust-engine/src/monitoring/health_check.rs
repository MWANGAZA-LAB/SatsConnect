use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub name: String,
    pub status: HealthStatus,
    pub message: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub overall_status: HealthStatus,
    pub checks: Vec<HealthCheck>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Health checker for monitoring system health
#[derive(Debug)]
pub struct HealthChecker {
    checks: Arc<RwLock<Vec<Box<dyn HealthCheckProvider + Send + Sync>>>>,
}

#[async_trait::async_trait]
pub trait HealthCheckProvider {
    async fn check_health(&self) -> Result<HealthCheck>;
    fn name(&self) -> &str;
}

impl HealthChecker {
    pub fn new() -> Self {
        Self {
            checks: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn add_check(&self, check: Box<dyn HealthCheckProvider + Send + Sync>) {
        let mut checks = self.checks.write().await;
        checks.push(check);
    }

    pub async fn run_health_checks(&self) -> SystemHealth {
        let checks = self.checks.read().await;
        let mut health_checks = Vec::new();
        let mut overall_status = HealthStatus::Healthy;

        for check in checks.iter() {
            let start = std::time::Instant::now();
            let result = check.check_health().await;
            let duration = start.elapsed().as_millis() as u64;

            let health_check = match result {
                Ok(health) => health,
                Err(e) => HealthCheck {
                    name: check.name().to_string(),
                    status: HealthStatus::Unhealthy,
                    message: Some(format!("Health check failed: {}", e)),
                    timestamp: chrono::Utc::now(),
                    duration_ms: duration,
                },
            };

            // Update overall status based on individual checks
            match health_check.status {
                HealthStatus::Unhealthy => overall_status = HealthStatus::Unhealthy,
                HealthStatus::Degraded => {
                    if overall_status != HealthStatus::Unhealthy {
                        overall_status = HealthStatus::Degraded;
                    }
                }
                HealthStatus::Healthy => {
                    // Keep current status if it's already degraded or unhealthy
                }
                HealthStatus::Unknown => {
                    if overall_status == HealthStatus::Healthy {
                        overall_status = HealthStatus::Unknown;
                    }
                }
            }

            health_checks.push(health_check);
        }

        SystemHealth {
            overall_status,
            checks: health_checks,
            timestamp: chrono::Utc::now(),
        }
    }
}

/// Database health check provider
pub struct DatabaseHealthCheck {
    connection_string: String,
}

impl DatabaseHealthCheck {
    pub fn new(connection_string: String) -> Self {
        Self { connection_string }
    }
}

#[async_trait::async_trait]
impl HealthCheckProvider for DatabaseHealthCheck {
    async fn check_health(&self) -> Result<HealthCheck> {
        let start = std::time::Instant::now();

        // Simulate database health check
        // In a real implementation, this would check database connectivity
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let duration = start.elapsed().as_millis() as u64;

        Ok(HealthCheck {
            name: "database".to_string(),
            status: HealthStatus::Healthy,
            message: Some("Database connection successful".to_string()),
            timestamp: chrono::Utc::now(),
            duration_ms: duration,
        })
    }

    fn name(&self) -> &str {
        "database"
    }
}

/// Lightning Network health check provider
pub struct LightningHealthCheck {
    node_endpoint: String,
}

impl LightningHealthCheck {
    pub fn new(node_endpoint: String) -> Self {
        Self { node_endpoint }
    }
}

#[async_trait::async_trait]
impl HealthCheckProvider for LightningHealthCheck {
    async fn check_health(&self) -> Result<HealthCheck> {
        let start = std::time::Instant::now();

        // Simulate Lightning Network health check
        // In a real implementation, this would check Lightning node status
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        let duration = start.elapsed().as_millis() as u64;

        Ok(HealthCheck {
            name: "lightning".to_string(),
            status: HealthStatus::Healthy,
            message: Some("Lightning node is operational".to_string()),
            timestamp: chrono::Utc::now(),
            duration_ms: duration,
        })
    }

    fn name(&self) -> &str {
        "lightning"
    }
}

/// API health check provider
pub struct ApiHealthCheck {
    api_endpoint: String,
}

impl ApiHealthCheck {
    pub fn new(api_endpoint: String) -> Self {
        Self { api_endpoint }
    }
}

#[async_trait::async_trait]
impl HealthCheckProvider for ApiHealthCheck {
    async fn check_health(&self) -> Result<HealthCheck> {
        let start = std::time::Instant::now();

        // Simulate API health check
        // In a real implementation, this would make an HTTP request
        tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;

        let duration = start.elapsed().as_millis() as u64;

        Ok(HealthCheck {
            name: "api".to_string(),
            status: HealthStatus::Healthy,
            message: Some("API is responding".to_string()),
            timestamp: chrono::Utc::now(),
            duration_ms: duration,
        })
    }

    fn name(&self) -> &str {
        "api"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_checker() {
        let checker = HealthChecker::new();

        let db_check = Box::new(DatabaseHealthCheck::new("test://db".to_string()));
        let lightning_check = Box::new(LightningHealthCheck::new("test://lightning".to_string()));

        checker.add_check(db_check).await;
        checker.add_check(lightning_check).await;

        let system_health = checker.run_health_checks().await;

        assert_eq!(system_health.overall_status, HealthStatus::Healthy);
        assert_eq!(system_health.checks.len(), 2);
    }

    #[tokio::test]
    async fn test_database_health_check() {
        let db_check = DatabaseHealthCheck::new("test://db".to_string());
        let result = db_check.check_health().await;

        assert!(result.is_ok());
        let health = result.unwrap();
        assert_eq!(health.name, "database");
        assert_eq!(health.status, HealthStatus::Healthy);
    }
}
