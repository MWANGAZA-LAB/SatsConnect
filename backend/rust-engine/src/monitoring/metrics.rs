use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, warn, instrument};
use chrono::{DateTime, Utc};

/// Metric types supported by the monitoring system
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MetricType {
    Counter,
    Gauge,
    Histogram,
    Summary,
}

/// Metric value with timestamp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricValue {
    pub value: f64,
    pub timestamp: DateTime<Utc>,
    pub labels: HashMap<String, String>,
}

/// Individual metric
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metric {
    pub name: String,
    pub metric_type: MetricType,
    pub description: String,
    pub values: Vec<MetricValue>,
    pub unit: Option<String>,
}

/// Metrics collector for SatsConnect
#[derive(Debug)]
pub struct MetricsCollector {
    metrics: Arc<RwLock<HashMap<String, Metric>>>,
    retention_period: chrono::Duration,
    max_values_per_metric: usize,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(HashMap::new())),
            retention_period: chrono::Duration::hours(24),
            max_values_per_metric: 1000,
        }
    }

    /// Record a counter metric
    #[instrument(skip(self))]
    pub async fn increment_counter(&self, name: &str, labels: HashMap<String, String>) -> Result<()> {
        self.record_metric(name, MetricType::Counter, 1.0, labels, None).await
    }

    /// Record a gauge metric
    #[instrument(skip(self))]
    pub async fn set_gauge(&self, name: &str, value: f64, labels: HashMap<String, String>, unit: Option<String>) -> Result<()> {
        self.record_metric(name, MetricType::Gauge, value, labels, unit).await
    }

    /// Record a histogram metric
    #[instrument(skip(self))]
    pub async fn record_histogram(&self, name: &str, value: f64, labels: HashMap<String, String>, unit: Option<String>) -> Result<()> {
        self.record_metric(name, MetricType::Histogram, value, labels, unit).await
    }

    /// Record a summary metric
    #[instrument(skip(self))]
    pub async fn record_summary(&self, name: &str, value: f64, labels: HashMap<String, String>, unit: Option<String>) -> Result<()> {
        self.record_metric(name, MetricType::Summary, value, labels, unit).await
    }

    /// Record a metric value
    async fn record_metric(
        &self,
        name: &str,
        metric_type: MetricType,
        value: f64,
        labels: HashMap<String, String>,
        unit: Option<String>,
    ) -> Result<()> {
        let mut metrics = self.metrics.write().await;
        
        let metric_value = MetricValue {
            value,
            timestamp: Utc::now(),
            labels,
        };

        if let Some(metric) = metrics.get_mut(name) {
            metric.values.push(metric_value);
            
            // Enforce retention policy
            if metric.values.len() > self.max_values_per_metric {
                metric.values.drain(0..metric.values.len() - self.max_values_per_metric);
            }
        } else {
            let metric = Metric {
                name: name.to_string(),
                metric_type,
                description: format!("{} metric", name),
                values: vec![metric_value],
                unit,
            };
            metrics.insert(name.to_string(), metric);
        }

        Ok(())
    }

    /// Get all metrics
    pub async fn get_metrics(&self) -> HashMap<String, Metric> {
        let metrics = self.metrics.read().await;
        metrics.clone()
    }

    /// Get a specific metric
    pub async fn get_metric(&self, name: &str) -> Option<Metric> {
        let metrics = self.metrics.read().await;
        metrics.get(name).cloned()
    }

    /// Get metric summary
    pub async fn get_metric_summary(&self, name: &str) -> Option<MetricSummary> {
        let metrics = self.metrics.read().await;
        if let Some(metric) = metrics.get(name) {
            if metric.values.is_empty() {
                return None;
            }

            let values: Vec<f64> = metric.values.iter().map(|v| v.value).collect();
            let count = values.len();
            let sum: f64 = values.iter().sum();
            let avg = sum / count as f64;
            let min = values.iter().fold(f64::INFINITY, |a, &b| a.min(b));
            let max = values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));

            Some(MetricSummary {
                name: name.to_string(),
                metric_type: metric.metric_type.clone(),
                count,
                sum,
                avg,
                min,
                max,
                latest_value: values.last().copied(),
                latest_timestamp: metric.values.last().map(|v| v.timestamp),
            })
        } else {
            None
        }
    }

    /// Clean up old metrics
    #[instrument(skip(self))]
    pub async fn cleanup_old_metrics(&self) -> Result<()> {
        let cutoff_time = Utc::now() - self.retention_period;
        let mut metrics = self.metrics.write().await;
        
        for (_, metric) in metrics.iter_mut() {
            metric.values.retain(|v| v.timestamp > cutoff_time);
        }

        info!("Cleaned up old metrics");
        Ok(())
    }

    /// Export metrics in Prometheus format
    pub async fn export_prometheus(&self) -> String {
        let metrics = self.metrics.read().await;
        let mut output = String::new();

        for (_, metric) in metrics.iter() {
            if metric.values.is_empty() {
                continue;
            }

            // Add HELP line
            output.push_str(&format!("# HELP {} {}\n", metric.name, metric.description));
            
            // Add TYPE line
            let type_str = match metric.metric_type {
                MetricType::Counter => "counter",
                MetricType::Gauge => "gauge",
                MetricType::Histogram => "histogram",
                MetricType::Summary => "summary",
            };
            output.push_str(&format!("# TYPE {} {}\n", metric.name, type_str));

            // Add metric values
            for value in &metric.values {
                let labels_str = if value.labels.is_empty() {
                    String::new()
                } else {
                    let label_pairs: Vec<String> = value.labels
                        .iter()
                        .map(|(k, v)| format!("{}=\"{}\"", k, v))
                        .collect();
                    format!("{{{}}}", label_pairs.join(","))
                };

                let unit_suffix = metric.unit.as_ref().map(|u| format!("_{}", u)).unwrap_or_default();
                output.push_str(&format!(
                    "{}{} {} {}\n",
                    metric.name,
                    unit_suffix,
                    labels_str,
                    value.value
                ));
            }
        }

        output
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSummary {
    pub name: String,
    pub metric_type: MetricType,
    pub count: usize,
    pub sum: f64,
    pub avg: f64,
    pub min: f64,
    pub max: f64,
    pub latest_value: Option<f64>,
    pub latest_timestamp: Option<DateTime<Utc>>,
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Predefined metrics for SatsConnect
pub struct SatsConnectMetrics;

impl SatsConnectMetrics {
    /// Payment metrics
    pub const PAYMENT_TOTAL: &'static str = "satsconnect_payments_total";
    pub const PAYMENT_SUCCESS: &'static str = "satsconnect_payments_success_total";
    pub const PAYMENT_FAILED: &'static str = "satsconnect_payments_failed_total";
    pub const PAYMENT_AMOUNT: &'static str = "satsconnect_payment_amount_sats";
    pub const PAYMENT_DURATION: &'static str = "satsconnect_payment_duration_seconds";

    /// Lightning Network metrics
    pub const LIGHTNING_CHANNELS: &'static str = "satsconnect_lightning_channels_total";
    pub const LIGHTNING_BALANCE: &'static str = "satsconnect_lightning_balance_sats";
    pub const LIGHTNING_FEES: &'static str = "satsconnect_lightning_fees_sats";

    /// Exchange rate metrics
    pub const EXCHANGE_RATE: &'static str = "satsconnect_exchange_rate";
    pub const EXCHANGE_RATE_AGE: &'static str = "satsconnect_exchange_rate_age_seconds";

    /// System metrics
    pub const MEMORY_USAGE: &'static str = "satsconnect_memory_usage_bytes";
    pub const CPU_USAGE: &'static str = "satsconnect_cpu_usage_percent";
    pub const ACTIVE_CONNECTIONS: &'static str = "satsconnect_active_connections";

    /// Fiat provider metrics
    pub const MPESA_REQUESTS: &'static str = "satsconnect_mpesa_requests_total";
    pub const MPESA_SUCCESS: &'static str = "satsconnect_mpesa_success_total";
    pub const MPESA_FAILED: &'static str = "satsconnect_mpesa_failed_total";
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_metrics_collector() {
        let collector = MetricsCollector::new();
        
        let mut labels = HashMap::new();
        labels.insert("currency".to_string(), "KES".to_string());
        
        collector.increment_counter("test_counter", labels).await.unwrap();
        
        let metrics = collector.get_metrics().await;
        assert!(metrics.contains_key("test_counter"));
    }

    #[tokio::test]
    async fn test_metric_summary() {
        let collector = MetricsCollector::new();
        
        let mut labels = HashMap::new();
        labels.insert("test".to_string(), "value".to_string());
        
        collector.set_gauge("test_gauge", 10.0, labels.clone(), Some("bytes".to_string())).await.unwrap();
        collector.set_gauge("test_gauge", 20.0, labels.clone(), Some("bytes".to_string())).await.unwrap();
        collector.set_gauge("test_gauge", 30.0, labels, Some("bytes".to_string())).await.unwrap();
        
        let summary = collector.get_metric_summary("test_gauge").await.unwrap();
        assert_eq!(summary.count, 3);
        assert_eq!(summary.avg, 20.0);
        assert_eq!(summary.min, 10.0);
        assert_eq!(summary.max, 30.0);
    }
}
