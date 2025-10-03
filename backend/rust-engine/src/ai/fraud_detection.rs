use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, instrument, warn};

/// AI-powered fraud detection system for SatsConnect
#[derive(Debug)]
pub struct FraudDetector {
    models: Arc<RwLock<Vec<MLModel>>>,
    patterns: Arc<RwLock<Vec<FraudPattern>>>,
    transaction_history: Arc<RwLock<Vec<TransactionRecord>>>,
    config: FraudDetectionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudDetectionConfig {
    pub risk_threshold: f64, // 0.0 to 1.0
    pub max_transaction_amount: u64,
    pub max_daily_volume: u64,
    pub max_hourly_transactions: u32,
    pub enable_ml_detection: bool,
    pub enable_pattern_detection: bool,
    pub enable_behavioral_analysis: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRecord {
    pub transaction_id: String,
    pub user_id: String,
    pub amount: u64,
    pub timestamp: DateTime<Utc>,
    pub from_address: String,
    pub to_address: String,
    pub transaction_type: TransactionType,
    pub risk_score: f64,
    pub is_fraudulent: bool,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransactionType {
    Payment,
    ChannelOpen,
    ChannelClose,
    Swap,
    Airtime,
    FiatOnRamp,
    FiatOffRamp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudScore {
    pub transaction_id: String,
    pub overall_score: f64, // 0.0 to 1.0
    pub ml_score: f64,
    pub pattern_score: f64,
    pub behavioral_score: f64,
    pub risk_level: RiskLevel,
    pub factors: Vec<FraudFactor>,
    pub confidence: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Low,      // 0.0 - 0.3
    Medium,   // 0.3 - 0.7
    High,     // 0.7 - 0.9
    Critical, // 0.9 - 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudFactor {
    pub factor_name: String,
    pub score: f64,
    pub weight: f64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudPattern {
    pub pattern_id: String,
    pub name: String,
    pub description: String,
    pub pattern_type: PatternType,
    pub conditions: Vec<PatternCondition>,
    pub risk_weight: f64,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_triggered: Option<DateTime<Utc>>,
    pub trigger_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PatternType {
    Velocity,
    Amount,
    Geographic,
    Temporal,
    Network,
    Behavioral,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternCondition {
    pub field: String,
    pub operator: ConditionOperator,
    pub value: serde_json::Value,
    pub weight: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConditionOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
    Contains,
    In,
    NotIn,
    Between,
}

impl FraudDetector {
    /// Create a new fraud detector
    pub fn new(config: FraudDetectionConfig) -> Self {
        Self {
            models: Arc::new(RwLock::new(Vec::new())),
            patterns: Arc::new(RwLock::new(Vec::new())),
            transaction_history: Arc::new(RwLock::new(Vec::new())),
            config,
        }
    }

    /// Analyze transaction for fraud
    #[instrument(skip(self, transaction))]
    pub async fn analyze_transaction(&self, transaction: &TransactionRecord) -> Result<FraudScore> {
        info!(
            "Analyzing transaction for fraud: {}",
            transaction.transaction_id
        );

        let mut factors = Vec::new();
        let mut ml_score = 0.0;
        let mut pattern_score = 0.0;
        let mut behavioral_score = 0.0;

        // ML-based detection
        if self.config.enable_ml_detection {
            ml_score = self.calculate_ml_score(transaction).await?;
            factors.push(FraudFactor {
                factor_name: "ML Detection".to_string(),
                score: ml_score,
                weight: 0.4,
                description: "Machine learning model prediction".to_string(),
            });
        }

        // Pattern-based detection
        if self.config.enable_pattern_detection {
            pattern_score = self.calculate_pattern_score(transaction).await?;
            factors.push(FraudFactor {
                factor_name: "Pattern Detection".to_string(),
                score: pattern_score,
                weight: 0.3,
                description: "Known fraud pattern matching".to_string(),
            });
        }

        // Behavioral analysis
        if self.config.enable_behavioral_analysis {
            behavioral_score = self.calculate_behavioral_score(transaction).await?;
            factors.push(FraudFactor {
                factor_name: "Behavioral Analysis".to_string(),
                score: behavioral_score,
                weight: 0.3,
                description: "User behavior analysis".to_string(),
            });
        }

        // Calculate overall score
        let overall_score = self.calculate_overall_score(&factors);
        let risk_level = self.determine_risk_level(overall_score);
        let confidence = self.calculate_confidence(&factors);

        let fraud_score = FraudScore {
            transaction_id: transaction.transaction_id.clone(),
            overall_score,
            ml_score,
            pattern_score,
            behavioral_score,
            risk_level,
            factors,
            confidence,
            timestamp: Utc::now(),
        };

        // Store transaction for future analysis
        self.store_transaction(transaction.clone()).await?;

        info!(
            "Fraud analysis completed for transaction: {} (score: {:.2})",
            transaction.transaction_id, overall_score
        );

        Ok(fraud_score)
    }

    /// Calculate ML-based fraud score
    async fn calculate_ml_score(&self, transaction: &TransactionRecord) -> Result<f64> {
        let models = self.models.read().await;

        if models.is_empty() {
            return Ok(0.0);
        }

        // Use the most accurate model
        let best_model = models
            .iter()
            .max_by(|a, b| a.accuracy.partial_cmp(&b.accuracy).unwrap())
            .unwrap();

        // Extract features for ML model
        let features = self.extract_features(transaction).await?;

        // Simulate ML prediction (in real implementation, this would use actual ML model)
        let score = self.simulate_ml_prediction(&features, best_model).await?;

        Ok(score)
    }

    /// Calculate pattern-based fraud score
    async fn calculate_pattern_score(&self, transaction: &TransactionRecord) -> Result<f64> {
        let patterns = self.patterns.read().await;
        let mut max_score = 0.0;

        for pattern in patterns.iter().filter(|p| p.is_active) {
            let pattern_score = self.evaluate_pattern(transaction, pattern).await?;
            if pattern_score > max_score {
                max_score = pattern_score;
            }
        }

        Ok(max_score)
    }

    /// Calculate behavioral fraud score
    async fn calculate_behavioral_score(&self, transaction: &TransactionRecord) -> Result<f64> {
        let history = self.transaction_history.read().await;
        let user_transactions: Vec<&TransactionRecord> = history
            .iter()
            .filter(|t| t.user_id == transaction.user_id)
            .collect();

        if user_transactions.is_empty() {
            return Ok(0.1); // New user, low risk
        }

        // Analyze transaction patterns
        let velocity_score = self
            .calculate_velocity_score(transaction, &user_transactions)
            .await?;
        let amount_score = self
            .calculate_amount_score(transaction, &user_transactions)
            .await?;
        let temporal_score = self
            .calculate_temporal_score(transaction, &user_transactions)
            .await?;

        // Weighted average
        let behavioral_score =
            (velocity_score * 0.4) + (amount_score * 0.3) + (temporal_score * 0.3);

        Ok(behavioral_score)
    }

    /// Calculate velocity score (transactions per time period)
    async fn calculate_velocity_score(
        &self,
        transaction: &TransactionRecord,
        user_transactions: &[&TransactionRecord],
    ) -> Result<f64> {
        let now = transaction.timestamp;
        let one_hour_ago = now - chrono::Duration::hours(1);
        let one_day_ago = now - chrono::Duration::days(1);

        let hourly_count = user_transactions
            .iter()
            .filter(|t| t.timestamp > one_hour_ago)
            .count() as u32;

        let daily_count = user_transactions
            .iter()
            .filter(|t| t.timestamp > one_day_ago)
            .count() as u32;

        let hourly_score = if hourly_count > self.config.max_hourly_transactions {
            (hourly_count as f64 / self.config.max_hourly_transactions as f64).min(1.0)
        } else {
            0.0
        };

        let daily_score = if daily_count > (self.config.max_daily_volume / 1000) as u32 {
            (daily_count as f64 / (self.config.max_daily_volume / 1000) as f64).min(1.0)
        } else {
            0.0
        };

        Ok((hourly_score + daily_score) / 2.0)
    }

    /// Calculate amount score (unusual transaction amounts)
    async fn calculate_amount_score(
        &self,
        transaction: &TransactionRecord,
        user_transactions: &[&TransactionRecord],
    ) -> Result<f64> {
        if user_transactions.is_empty() {
            return Ok(0.0);
        }

        let amounts: Vec<u64> = user_transactions.iter().map(|t| t.amount).collect();
        let avg_amount = amounts.iter().sum::<u64>() as f64 / amounts.len() as f64;
        let max_amount = *amounts.iter().max().unwrap() as f64;

        let current_amount = transaction.amount as f64;

        // Check if amount is unusually high
        let amount_score = if current_amount > self.config.max_transaction_amount as f64 {
            1.0
        } else if current_amount > max_amount * 2.0 {
            0.8
        } else if current_amount > avg_amount * 3.0 {
            0.6
        } else {
            0.0
        };

        Ok(amount_score)
    }

    /// Calculate temporal score (unusual timing patterns)
    async fn calculate_temporal_score(
        &self,
        transaction: &TransactionRecord,
        user_transactions: &[&TransactionRecord],
    ) -> Result<f64> {
        if user_transactions.is_empty() {
            return Ok(0.0);
        }

        let hour = transaction.timestamp.hour();
        let day_of_week = transaction.timestamp.weekday().num_days_from_monday();

        // Analyze user's typical transaction times
        let mut hour_counts = [0; 24];
        let mut day_counts = [0; 7];

        for t in user_transactions {
            hour_counts[t.timestamp.hour() as usize] += 1;
            day_counts[t.timestamp.weekday().num_days_from_monday() as usize] += 1;
        }

        let total_transactions = user_transactions.len() as f64;
        let hour_frequency = hour_counts[hour as usize] as f64 / total_transactions;
        let day_frequency = day_counts[day_of_week as usize] as f64 / total_transactions;

        // Score based on how unusual the timing is
        let temporal_score = if hour_frequency < 0.05 && day_frequency < 0.1 {
            0.8 // Very unusual timing
        } else if hour_frequency < 0.1 || day_frequency < 0.2 {
            0.4 // Somewhat unusual
        } else {
            0.0 // Normal timing
        };

        Ok(temporal_score)
    }

    /// Evaluate a fraud pattern against a transaction
    async fn evaluate_pattern(
        &self,
        transaction: &TransactionRecord,
        pattern: &FraudPattern,
    ) -> Result<f64> {
        let mut score = 0.0;
        let mut total_weight = 0.0;

        for condition in &pattern.conditions {
            let condition_score = self.evaluate_condition(transaction, condition).await?;
            score += condition_score * condition.weight;
            total_weight += condition.weight;
        }

        if total_weight > 0.0 {
            Ok((score / total_weight) * pattern.risk_weight)
        } else {
            Ok(0.0)
        }
    }

    /// Evaluate a single condition
    async fn evaluate_condition(
        &self,
        transaction: &TransactionRecord,
        condition: &PatternCondition,
    ) -> Result<f64> {
        let field_value = self.get_field_value(transaction, &condition.field).await?;

        match condition.operator {
            ConditionOperator::Equals => Ok(if field_value == condition.value {
                1.0
            } else {
                0.0
            }),
            ConditionOperator::NotEquals => Ok(if field_value != condition.value {
                1.0
            } else {
                0.0
            }),
            ConditionOperator::GreaterThan => {
                if let (Some(field_num), Some(value_num)) =
                    (field_value.as_f64(), condition.value.as_f64())
                {
                    Ok(if field_num > value_num { 1.0 } else { 0.0 })
                } else {
                    Ok(0.0)
                }
            }
            ConditionOperator::LessThan => {
                if let (Some(field_num), Some(value_num)) =
                    (field_value.as_f64(), condition.value.as_f64())
                {
                    Ok(if field_num < value_num { 1.0 } else { 0.0 })
                } else {
                    Ok(0.0)
                }
            }
            _ => Ok(0.0), // Implement other operators as needed
        }
    }

    /// Get field value from transaction
    async fn get_field_value(
        &self,
        transaction: &TransactionRecord,
        field: &str,
    ) -> Result<serde_json::Value> {
        match field {
            "amount" => Ok(serde_json::Value::Number(serde_json::Number::from(
                transaction.amount,
            ))),
            "user_id" => Ok(serde_json::Value::String(transaction.user_id.clone())),
            "transaction_type" => Ok(serde_json::Value::String(format!(
                "{:?}",
                transaction.transaction_type
            ))),
            "timestamp" => Ok(serde_json::Value::String(
                transaction.timestamp.to_rfc3339(),
            )),
            _ => Ok(serde_json::Value::Null),
        }
    }

    /// Extract features for ML model
    async fn extract_features(&self, transaction: &TransactionRecord) -> Result<Vec<f64>> {
        let history = self.transaction_history.read().await;
        let user_transactions: Vec<&TransactionRecord> = history
            .iter()
            .filter(|t| t.user_id == transaction.user_id)
            .collect();

        let mut features = Vec::new();

        // Basic features
        features.push(transaction.amount as f64);
        features.push(transaction.timestamp.hour() as f64);
        features.push(transaction.timestamp.weekday().num_days_from_monday() as f64);

        // User behavior features
        if !user_transactions.is_empty() {
            let avg_amount = user_transactions.iter().map(|t| t.amount).sum::<u64>() as f64
                / user_transactions.len() as f64;
            let max_amount = user_transactions.iter().map(|t| t.amount).max().unwrap() as f64;
            let transaction_count = user_transactions.len() as f64;

            features.push(avg_amount);
            features.push(max_amount);
            features.push(transaction_count);
        } else {
            features.extend(vec![0.0, 0.0, 0.0]);
        }

        Ok(features)
    }

    /// Simulate ML prediction (in real implementation, this would use actual ML model)
    async fn simulate_ml_prediction(&self, features: &[f64], _model: &MLModel) -> Result<f64> {
        // Simple heuristic-based simulation
        let mut score = 0.0;

        // Amount-based scoring
        if features[0] > 1000000.0 {
            // 1M sats
            score += 0.3;
        }

        // Time-based scoring (unusual hours)
        if features[1] < 6.0 || features[1] > 22.0 {
            score += 0.2;
        }

        // Frequency-based scoring
        if features.len() > 5 && features[5] > 10.0 {
            score += 0.2;
        }

        Ok(score.min(1.0))
    }

    /// Calculate overall fraud score
    fn calculate_overall_score(&self, factors: &[FraudFactor]) -> f64 {
        if factors.is_empty() {
            return 0.0;
        }

        let total_weighted_score: f64 = factors.iter().map(|f| f.score * f.weight).sum();

        let total_weight: f64 = factors.iter().map(|f| f.weight).sum();

        if total_weight > 0.0 {
            total_weighted_score / total_weight
        } else {
            0.0
        }
    }

    /// Determine risk level from score
    fn determine_risk_level(&self, score: f64) -> RiskLevel {
        match score {
            s if s < 0.3 => RiskLevel::Low,
            s if s < 0.7 => RiskLevel::Medium,
            s if s < 0.9 => RiskLevel::High,
            _ => RiskLevel::Critical,
        }
    }

    /// Calculate confidence in the fraud score
    fn calculate_confidence(&self, factors: &[FraudFactor]) -> f64 {
        if factors.is_empty() {
            return 0.0;
        }

        // Confidence based on number of factors and their consistency
        let factor_count = factors.len() as f64;
        let score_variance = self.calculate_score_variance(factors);

        let consistency = 1.0 - score_variance;
        let factor_confidence = (factor_count / 3.0).min(1.0); // Max confidence with 3+ factors

        (consistency + factor_confidence) / 2.0
    }

    /// Calculate variance in factor scores
    fn calculate_score_variance(&self, factors: &[FraudFactor]) -> f64 {
        if factors.len() < 2 {
            return 0.0;
        }

        let scores: Vec<f64> = factors.iter().map(|f| f.score).collect();
        let mean = scores.iter().sum::<f64>() / scores.len() as f64;
        let variance = scores
            .iter()
            .map(|&score| (score - mean).powi(2))
            .sum::<f64>()
            / scores.len() as f64;

        variance.sqrt() / mean.max(0.001) // Normalize by mean to get coefficient of variation
    }

    /// Store transaction for future analysis
    async fn store_transaction(&self, transaction: TransactionRecord) -> Result<()> {
        let mut history = self.transaction_history.write().await;
        history.push(transaction);

        // Keep only last 10000 transactions to manage memory
        if history.len() > 10000 {
            history.drain(0..1000);
        }

        Ok(())
    }

    /// Add fraud pattern
    pub async fn add_fraud_pattern(&self, pattern: FraudPattern) -> Result<()> {
        let mut patterns = self.patterns.write().await;
        patterns.push(pattern);
        Ok(())
    }

    /// Get fraud detection statistics
    pub async fn get_fraud_stats(&self) -> Result<FraudStats> {
        let history = self.transaction_history.read().await;
        let patterns = self.patterns.read().await;

        let total_transactions = history.len();
        let fraudulent_transactions = history.iter().filter(|t| t.is_fraudulent).count();
        let avg_risk_score = if total_transactions > 0 {
            history.iter().map(|t| t.risk_score).sum::<f64>() / total_transactions as f64
        } else {
            0.0
        };

        Ok(FraudStats {
            total_transactions,
            fraudulent_transactions,
            fraud_rate: if total_transactions > 0 {
                fraudulent_transactions as f64 / total_transactions as f64
            } else {
                0.0
            },
            avg_risk_score,
            active_patterns: patterns.iter().filter(|p| p.is_active).count(),
            total_patterns: patterns.len(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLModel {
    pub model_id: String,
    pub model_type: ModelType,
    pub accuracy: f64,
    pub created_at: DateTime<Utc>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModelType {
    RandomForest,
    NeuralNetwork,
    GradientBoosting,
    LogisticRegression,
    IsolationForest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelAccuracy {
    pub precision: f64,
    pub recall: f64,
    pub f1_score: f64,
    pub auc_roc: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudStats {
    pub total_transactions: usize,
    pub fraudulent_transactions: usize,
    pub fraud_rate: f64,
    pub avg_risk_score: f64,
    pub active_patterns: usize,
    pub total_patterns: usize,
}

impl Default for FraudDetectionConfig {
    fn default() -> Self {
        Self {
            risk_threshold: 0.7,
            max_transaction_amount: 10_000_000, // 10M sats
            max_daily_volume: 100_000_000,      // 100M sats
            max_hourly_transactions: 10,
            enable_ml_detection: true,
            enable_pattern_detection: true,
            enable_behavioral_analysis: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_fraud_detector_creation() {
        let config = FraudDetectionConfig::default();
        let detector = FraudDetector::new(config);

        let stats = detector.get_fraud_stats().await.unwrap();
        assert_eq!(stats.total_transactions, 0);
    }

    #[tokio::test]
    async fn test_fraud_analysis() {
        let config = FraudDetectionConfig::default();
        let detector = FraudDetector::new(config);

        let transaction = TransactionRecord {
            transaction_id: "test_tx".to_string(),
            user_id: "user123".to_string(),
            amount: 1000,
            timestamp: Utc::now(),
            from_address: "from_addr".to_string(),
            to_address: "to_addr".to_string(),
            transaction_type: TransactionType::Payment,
            risk_score: 0.0,
            is_fraudulent: false,
            metadata: HashMap::new(),
        };

        let fraud_score = detector.analyze_transaction(&transaction).await.unwrap();
        assert_eq!(fraud_score.transaction_id, "test_tx");
    }
}
