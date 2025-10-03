use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub request_count: u64,
    pub error_count: u64,
    pub average_response_time_ms: f64,
    pub p95_response_time_ms: f64,
    pub p99_response_time_ms: f64,
    pub throughput_rps: f64,
    pub memory_usage_mb: f64,
    pub cpu_usage_percent: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestMetrics {
    pub endpoint: String,
    pub method: String,
    pub response_time_ms: u64,
    pub status_code: u16,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub memory_usage_mb: f64,
    pub cpu_usage_percent: f64,
    pub disk_usage_percent: f64,
    pub network_io_mb: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Performance monitor for tracking system performance
#[derive(Debug)]
pub struct PerformanceMonitor {
    request_metrics: Arc<RwLock<Vec<RequestMetrics>>>,
    system_metrics: Arc<RwLock<Vec<SystemMetrics>>>,
    max_metrics_history: usize,
    start_time: Instant,
}

impl PerformanceMonitor {
    pub fn new(max_metrics_history: usize) -> Self {
        Self {
            request_metrics: Arc::new(RwLock::new(Vec::new())),
            system_metrics: Arc::new(RwLock::new(Vec::new())),
            max_metrics_history,
            start_time: Instant::now(),
        }
    }

    pub async fn record_request(
        &self,
        endpoint: String,
        method: String,
        response_time_ms: u64,
        status_code: u16,
    ) {
        let request_metric = RequestMetrics {
            endpoint,
            method,
            response_time_ms,
            status_code,
            timestamp: chrono::Utc::now(),
        };

        let mut metrics = self.request_metrics.write().await;
        metrics.push(request_metric);

        // Keep only the most recent metrics
        if metrics.len() > self.max_metrics_history {
            metrics.drain(0..metrics.len() - self.max_metrics_history);
        }
    }

    pub async fn record_system_metrics(
        &self,
        memory_usage_mb: f64,
        cpu_usage_percent: f64,
        disk_usage_percent: f64,
        network_io_mb: f64,
    ) {
        let system_metric = SystemMetrics {
            memory_usage_mb,
            cpu_usage_percent,
            disk_usage_percent,
            network_io_mb,
            timestamp: chrono::Utc::now(),
        };

        let mut metrics = self.system_metrics.write().await;
        metrics.push(system_metric);

        // Keep only the most recent metrics
        if metrics.len() > self.max_metrics_history {
            metrics.drain(0..metrics.len() - self.max_metrics_history);
        }
    }

    pub async fn get_performance_metrics(&self) -> PerformanceMetrics {
        let request_metrics = self.request_metrics.read().await;
        let system_metrics = self.system_metrics.read().await;

        let request_count = request_metrics.len() as u64;
        let error_count = request_metrics
            .iter()
            .filter(|m| m.status_code >= 400)
            .count() as u64;

        let response_times: Vec<u64> = request_metrics.iter().map(|m| m.response_time_ms).collect();

        let average_response_time_ms = if !response_times.is_empty() {
            response_times.iter().sum::<u64>() as f64 / response_times.len() as f64
        } else {
            0.0
        };

        let mut sorted_times = response_times.clone();
        sorted_times.sort();

        let p95_response_time_ms = if !sorted_times.is_empty() {
            let p95_index = (sorted_times.len() as f64 * 0.95) as usize;
            sorted_times[p95_index.min(sorted_times.len() - 1)] as f64
        } else {
            0.0
        };

        let p99_response_time_ms = if !sorted_times.is_empty() {
            let p99_index = (sorted_times.len() as f64 * 0.99) as usize;
            sorted_times[p99_index.min(sorted_times.len() - 1)] as f64
        } else {
            0.0
        };

        let uptime_seconds = self.start_time.elapsed().as_secs() as f64;
        let throughput_rps = if uptime_seconds > 0.0 {
            request_count as f64 / uptime_seconds
        } else {
            0.0
        };

        let (memory_usage_mb, cpu_usage_percent) =
            if let Some(latest_system) = system_metrics.last() {
                (
                    latest_system.memory_usage_mb,
                    latest_system.cpu_usage_percent,
                )
            } else {
                (0.0, 0.0)
            };

        PerformanceMetrics {
            request_count,
            error_count,
            average_response_time_ms,
            p95_response_time_ms,
            p99_response_time_ms,
            throughput_rps,
            memory_usage_mb,
            cpu_usage_percent,
            timestamp: chrono::Utc::now(),
        }
    }

    pub async fn get_endpoint_metrics(&self) -> HashMap<String, PerformanceMetrics> {
        let request_metrics = self.request_metrics.read().await;
        let mut endpoint_metrics: HashMap<String, Vec<&RequestMetrics>> = HashMap::new();

        // Group metrics by endpoint
        for metric in request_metrics.iter() {
            endpoint_metrics
                .entry(metric.endpoint.clone())
                .or_insert_with(Vec::new)
                .push(metric);
        }

        let mut result = HashMap::new();

        for (endpoint, metrics) in endpoint_metrics {
            let request_count = metrics.len() as u64;
            let error_count = metrics.iter().filter(|m| m.status_code >= 400).count() as u64;

            let response_times: Vec<u64> = metrics.iter().map(|m| m.response_time_ms).collect();

            let average_response_time_ms = if !response_times.is_empty() {
                response_times.iter().sum::<u64>() as f64 / response_times.len() as f64
            } else {
                0.0
            };

            let mut sorted_times = response_times.clone();
            sorted_times.sort();

            let p95_response_time_ms = if !sorted_times.is_empty() {
                let p95_index = (sorted_times.len() as f64 * 0.95) as usize;
                sorted_times[p95_index.min(sorted_times.len() - 1)] as f64
            } else {
                0.0
            };

            let p99_response_time_ms = if !sorted_times.is_empty() {
                let p99_index = (sorted_times.len() as f64 * 0.99) as usize;
                sorted_times[p99_index.min(sorted_times.len() - 1)] as f64
            } else {
                0.0
            };

            let uptime_seconds = self.start_time.elapsed().as_secs() as f64;
            let throughput_rps = if uptime_seconds > 0.0 {
                request_count as f64 / uptime_seconds
            } else {
                0.0
            };

            result.insert(
                endpoint,
                PerformanceMetrics {
                    request_count,
                    error_count,
                    average_response_time_ms,
                    p95_response_time_ms,
                    p99_response_time_ms,
                    throughput_rps,
                    memory_usage_mb: 0.0,
                    cpu_usage_percent: 0.0,
                    timestamp: chrono::Utc::now(),
                },
            );
        }

        result
    }

    pub async fn clear_metrics(&self) {
        let mut request_metrics = self.request_metrics.write().await;
        request_metrics.clear();

        let mut system_metrics = self.system_metrics.write().await;
        system_metrics.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_performance_monitor() {
        let monitor = PerformanceMonitor::new(1000);

        // Record some request metrics
        monitor
            .record_request("/api/wallets".to_string(), "GET".to_string(), 100, 200)
            .await;

        monitor
            .record_request("/api/payments".to_string(), "POST".to_string(), 200, 201)
            .await;

        // Record system metrics
        monitor.record_system_metrics(512.0, 25.0, 60.0, 10.0).await;

        // Get performance metrics
        let metrics = monitor.get_performance_metrics().await;

        assert_eq!(metrics.request_count, 2);
        assert_eq!(metrics.error_count, 0);
        assert_eq!(metrics.memory_usage_mb, 512.0);
        assert_eq!(metrics.cpu_usage_percent, 25.0);
    }

    #[tokio::test]
    async fn test_endpoint_metrics() {
        let monitor = PerformanceMonitor::new(1000);

        // Record metrics for different endpoints
        monitor
            .record_request("/api/wallets".to_string(), "GET".to_string(), 100, 200)
            .await;
        monitor
            .record_request("/api/wallets".to_string(), "GET".to_string(), 150, 200)
            .await;
        monitor
            .record_request("/api/payments".to_string(), "POST".to_string(), 200, 201)
            .await;

        let endpoint_metrics = monitor.get_endpoint_metrics().await;

        assert_eq!(endpoint_metrics.len(), 2);
        assert!(endpoint_metrics.contains_key("/api/wallets"));
        assert!(endpoint_metrics.contains_key("/api/payments"));

        let wallets_metrics = endpoint_metrics.get("/api/wallets").unwrap();
        assert_eq!(wallets_metrics.request_count, 2);
    }
}
