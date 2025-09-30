use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, warn, instrument};
use chrono::{DateTime, Utc};

/// Alert levels
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AlertLevel {
    Info,
    Warning,
    Critical,
    Emergency,
}

impl AlertLevel {
    pub fn priority(&self) -> u8 {
        match self {
            AlertLevel::Info => 1,
            AlertLevel::Warning => 2,
            AlertLevel::Critical => 3,
            AlertLevel::Emergency => 4,
        }
    }
}

/// Alert state
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertState {
    Firing,
    Resolved,
    Suppressed,
}

/// Alert rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    pub name: String,
    pub description: String,
    pub metric_name: String,
    pub condition: AlertCondition,
    pub level: AlertLevel,
    pub duration: Option<chrono::Duration>,
    pub labels: HashMap<String, String>,
    pub annotations: HashMap<String, String>,
}

/// Alert condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertCondition {
    GreaterThan(f64),
    LessThan(f64),
    EqualTo(f64),
    NotEqualTo(f64),
    GreaterThanOrEqual(f64),
    LessThanOrEqual(f64),
}

/// Alert instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: String,
    pub rule_name: String,
    pub level: AlertLevel,
    pub state: AlertState,
    pub message: String,
    pub description: String,
    pub labels: HashMap<String, String>,
    pub annotations: HashMap<String, String>,
    pub started_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub value: Option<f64>,
    pub threshold: Option<f64>,
}

/// Alert manager for SatsConnect
#[derive(Debug)]
pub struct AlertManager {
    alerts: Arc<RwLock<HashMap<String, Alert>>>,
    rules: Arc<RwLock<Vec<AlertRule>>>,
    notification_channels: Vec<Box<dyn NotificationChannel + Send + Sync>>,
}

/// Notification channel trait
pub trait NotificationChannel: Send + Sync {
    async fn send_alert(&self, alert: &Alert) -> Result<()>;
    fn get_name(&self) -> &'static str;
}

impl AlertManager {
    /// Create a new alert manager
    pub fn new() -> Self {
        Self {
            alerts: Arc::new(RwLock::new(HashMap::new())),
            rules: Arc::new(RwLock::new(Vec::new())),
            notification_channels: Vec::new(),
        }
    }

    /// Add a notification channel
    pub fn add_notification_channel(&mut self, channel: Box<dyn NotificationChannel + Send + Sync>) {
        self.notification_channels.push(channel);
    }

    /// Add an alert rule
    #[instrument(skip(self))]
    pub async fn add_rule(&self, rule: AlertRule) -> Result<()> {
        let mut rules = self.rules.write().await;
        rules.push(rule);
        info!("Added alert rule: {}", rules.last().unwrap().name);
        Ok(())
    }

    /// Evaluate metrics against alert rules
    #[instrument(skip(self))]
    pub async fn evaluate_metrics(&self, metrics: HashMap<String, f64>) -> Result<()> {
        let rules = self.rules.read().await;
        
        for rule in rules.iter() {
            if let Some(&value) = metrics.get(&rule.metric_name) {
                if self.evaluate_condition(&rule.condition, value) {
                    self.trigger_alert(rule, value).await?;
                } else {
                    self.resolve_alert(&rule.name).await?;
                }
            }
        }
        
        Ok(())
    }

    /// Evaluate alert condition
    fn evaluate_condition(&self, condition: &AlertCondition, value: f64) -> bool {
        match condition {
            AlertCondition::GreaterThan(threshold) => value > *threshold,
            AlertCondition::LessThan(threshold) => value < *threshold,
            AlertCondition::EqualTo(threshold) => (value - *threshold).abs() < f64::EPSILON,
            AlertCondition::NotEqualTo(threshold) => (value - *threshold).abs() >= f64::EPSILON,
            AlertCondition::GreaterThanOrEqual(threshold) => value >= *threshold,
            AlertCondition::LessThanOrEqual(threshold) => value <= *threshold,
        }
    }

    /// Trigger an alert
    async fn trigger_alert(&self, rule: &AlertRule, value: f64) -> Result<()> {
        let alert_id = format!("{}_{}", rule.name, uuid::Uuid::new_v4());
        
        let alert = Alert {
            id: alert_id.clone(),
            rule_name: rule.name.clone(),
            level: rule.level.clone(),
            state: AlertState::Firing,
            message: self.format_alert_message(rule, value),
            description: rule.description.clone(),
            labels: rule.labels.clone(),
            annotations: rule.annotations.clone(),
            started_at: Utc::now(),
            resolved_at: None,
            value: Some(value),
            threshold: self.get_threshold_value(rule),
        };

        // Store alert
        {
            let mut alerts = self.alerts.write().await;
            alerts.insert(alert_id.clone(), alert.clone());
        }

        // Send notifications
        for channel in &self.notification_channels {
            if let Err(e) = channel.send_alert(&alert).await {
                error!("Failed to send alert via {}: {}", channel.get_name(), e);
            }
        }

        info!("Triggered alert: {} (value: {})", rule.name, value);
        Ok(())
    }

    /// Resolve an alert
    async fn resolve_alert(&self, rule_name: &str) -> Result<()> {
        let mut alerts = self.alerts.write().await;
        
        if let Some(alert) = alerts.get_mut(rule_name) {
            if alert.state == AlertState::Firing {
                alert.state = AlertState::Resolved;
                alert.resolved_at = Some(Utc::now());
                
                info!("Resolved alert: {}", rule_name);
            }
        }
        
        Ok(())
    }

    /// Format alert message
    fn format_alert_message(&self, rule: &AlertRule, value: f64) -> String {
        let threshold = self.get_threshold_value(rule);
        let threshold_str = threshold.map(|t| format!(" (threshold: {})", t)).unwrap_or_default();
        
        format!(
            "Alert '{}': {} = {}{}",
            rule.name,
            rule.metric_name,
            value,
            threshold_str
        )
    }

    /// Get threshold value from condition
    fn get_threshold_value(&self, rule: &AlertRule) -> Option<f64> {
        match &rule.condition {
            AlertCondition::GreaterThan(t) | AlertCondition::GreaterThanOrEqual(t) => Some(*t),
            AlertCondition::LessThan(t) | AlertCondition::LessThanOrEqual(t) => Some(*t),
            AlertCondition::EqualTo(t) | AlertCondition::NotEqualTo(t) => Some(*t),
        }
    }

    /// Get all active alerts
    pub async fn get_active_alerts(&self) -> Vec<Alert> {
        let alerts = self.alerts.read().await;
        alerts.values()
            .filter(|alert| alert.state == AlertState::Firing)
            .cloned()
            .collect()
    }

    /// Get alerts by level
    pub async fn get_alerts_by_level(&self, level: AlertLevel) -> Vec<Alert> {
        let alerts = self.alerts.read().await;
        alerts.values()
            .filter(|alert| alert.level == level)
            .cloned()
            .collect()
    }

    /// Suppress an alert
    pub async fn suppress_alert(&self, alert_id: &str) -> Result<()> {
        let mut alerts = self.alerts.write().await;
        if let Some(alert) = alerts.get_mut(alert_id) {
            alert.state = AlertState::Suppressed;
            info!("Suppressed alert: {}", alert_id);
        }
        Ok(())
    }

    /// Get alert statistics
    pub async fn get_alert_stats(&self) -> AlertStats {
        let alerts = self.alerts.read().await;
        let rules = self.rules.read().await;
        
        let total_alerts = alerts.len();
        let active_alerts = alerts.values().filter(|a| a.state == AlertState::Firing).count();
        let resolved_alerts = alerts.values().filter(|a| a.state == AlertState::Resolved).count();
        let suppressed_alerts = alerts.values().filter(|a| a.state == AlertState::Suppressed).count();
        
        let mut alerts_by_level = HashMap::new();
        for alert in alerts.values() {
            *alerts_by_level.entry(alert.level.clone()).or_insert(0) += 1;
        }
        
        AlertStats {
            total_alerts,
            active_alerts,
            resolved_alerts,
            suppressed_alerts,
            total_rules: rules.len(),
            alerts_by_level,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertStats {
    pub total_alerts: usize,
    pub active_alerts: usize,
    pub resolved_alerts: usize,
    pub suppressed_alerts: usize,
    pub total_rules: usize,
    pub alerts_by_level: HashMap<AlertLevel, usize>,
}

impl Default for AlertManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Predefined alert rules for SatsConnect
pub struct SatsConnectAlerts;

impl SatsConnectAlerts {
    /// Create default alert rules
    pub fn create_default_rules() -> Vec<AlertRule> {
        vec![
            // Payment failure rate
            AlertRule {
                name: "high_payment_failure_rate".to_string(),
                description: "Payment failure rate is too high".to_string(),
                metric_name: "satsconnect_payment_failure_rate".to_string(),
                condition: AlertCondition::GreaterThan(0.1), // 10%
                level: AlertLevel::Critical,
                duration: Some(chrono::Duration::minutes(5)),
                labels: HashMap::new(),
                annotations: HashMap::new(),
            },
            
            // Lightning channel balance low
            AlertRule {
                name: "lightning_balance_low".to_string(),
                description: "Lightning channel balance is too low".to_string(),
                metric_name: "satsconnect_lightning_balance_sats".to_string(),
                condition: AlertCondition::LessThan(100000.0), // 100k sats
                level: AlertLevel::Warning,
                duration: None,
                labels: HashMap::new(),
                annotations: HashMap::new(),
            },
            
            // High memory usage
            AlertRule {
                name: "high_memory_usage".to_string(),
                description: "Memory usage is too high".to_string(),
                metric_name: "satsconnect_memory_usage_bytes".to_string(),
                condition: AlertCondition::GreaterThan(1_000_000_000.0), // 1GB
                level: AlertLevel::Warning,
                duration: Some(chrono::Duration::minutes(2)),
                labels: HashMap::new(),
                annotations: HashMap::new(),
            },
            
            // Exchange rate stale
            AlertRule {
                name: "exchange_rate_stale".to_string(),
                description: "Exchange rate is stale".to_string(),
                metric_name: "satsconnect_exchange_rate_age_seconds".to_string(),
                condition: AlertCondition::GreaterThan(300.0), // 5 minutes
                level: AlertLevel::Warning,
                duration: None,
                labels: HashMap::new(),
                annotations: HashMap::new(),
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_alert_manager() {
        let manager = AlertManager::new();
        
        let rule = AlertRule {
            name: "test_alert".to_string(),
            description: "Test alert".to_string(),
            metric_name: "test_metric".to_string(),
            condition: AlertCondition::GreaterThan(10.0),
            level: AlertLevel::Warning,
            duration: None,
            labels: HashMap::new(),
            annotations: HashMap::new(),
        };
        
        manager.add_rule(rule).await.unwrap();
        
        let mut metrics = HashMap::new();
        metrics.insert("test_metric".to_string(), 15.0);
        
        manager.evaluate_metrics(metrics).await.unwrap();
        
        let active_alerts = manager.get_active_alerts().await;
        assert_eq!(active_alerts.len(), 1);
        assert_eq!(active_alerts[0].rule_name, "test_alert");
    }
}
