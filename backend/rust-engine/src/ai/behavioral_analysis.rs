use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, error, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserBehavior {
    pub user_id: String,
    pub session_duration: u64,
    pub transaction_frequency: f64,
    pub average_transaction_amount: f64,
    pub preferred_payment_methods: Vec<String>,
    pub time_patterns: TimePatterns,
    pub location_patterns: LocationPatterns,
    pub device_patterns: DevicePatterns,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimePatterns {
    pub most_active_hours: Vec<u8>,
    pub most_active_days: Vec<u8>,
    pub timezone: String,
    pub session_timing: SessionTiming,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTiming {
    pub average_session_length: u64,
    pub typical_session_start: u8,
    pub typical_session_end: u8,
    pub session_frequency: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationPatterns {
    pub primary_country: String,
    pub primary_city: String,
    pub location_consistency: f64,
    pub travel_frequency: f64,
    pub ip_addresses: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevicePatterns {
    pub device_types: Vec<String>,
    pub operating_systems: Vec<String>,
    pub browsers: Vec<String>,
    pub device_consistency: f64,
    pub new_device_frequency: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorPattern {
    pub pattern_id: String,
    pub pattern_type: PatternType,
    pub description: String,
    pub confidence: f64,
    pub frequency: f64,
    pub last_observed: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternType {
    Normal,
    Suspicious,
    Anomalous,
    HighRisk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyScore {
    pub overall_score: f64,
    pub time_anomaly: f64,
    pub location_anomaly: f64,
    pub device_anomaly: f64,
    pub transaction_anomaly: f64,
    pub behavioral_anomaly: f64,
    pub risk_level: RiskLevel,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Behavioral analyzer for detecting anomalies and patterns
#[derive(Debug)]
pub struct BehavioralAnalyzer {
    user_behaviors: HashMap<String, UserBehavior>,
    behavior_patterns: HashMap<String, BehaviorPattern>,
    anomaly_thresholds: AnomalyThresholds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyThresholds {
    pub time_anomaly_threshold: f64,
    pub location_anomaly_threshold: f64,
    pub device_anomaly_threshold: f64,
    pub transaction_anomaly_threshold: f64,
    pub behavioral_anomaly_threshold: f64,
    pub overall_anomaly_threshold: f64,
}

impl Default for AnomalyThresholds {
    fn default() -> Self {
        Self {
            time_anomaly_threshold: 0.7,
            location_anomaly_threshold: 0.8,
            device_anomaly_threshold: 0.6,
            transaction_anomaly_threshold: 0.75,
            behavioral_anomaly_threshold: 0.65,
            overall_anomaly_threshold: 0.7,
        }
    }
}

impl BehavioralAnalyzer {
    pub fn new(thresholds: AnomalyThresholds) -> Self {
        Self {
            user_behaviors: HashMap::new(),
            behavior_patterns: HashMap::new(),
            anomaly_thresholds: thresholds,
        }
    }

    pub fn update_user_behavior(&mut self, behavior: UserBehavior) {
        let user_id = behavior.user_id.clone();
        self.user_behaviors.insert(user_id.clone(), behavior);
        info!("Updated behavior for user: {}", user_id);
    }

    pub fn get_user_behavior(&self, user_id: &str) -> Option<&UserBehavior> {
        self.user_behaviors.get(user_id)
    }

    pub fn analyze_anomaly(&self, user_id: &str, current_behavior: &UserBehavior) -> Result<AnomalyScore> {
        let baseline_behavior = match self.user_behaviors.get(user_id) {
            Some(behavior) => behavior,
            None => {
                // If no baseline, create a new one
                return Ok(AnomalyScore {
                    overall_score: 0.0,
                    time_anomaly: 0.0,
                    location_anomaly: 0.0,
                    device_anomaly: 0.0,
                    transaction_anomaly: 0.0,
                    behavioral_anomaly: 0.0,
                    risk_level: RiskLevel::Low,
                    timestamp: chrono::Utc::now(),
                });
            }
        };

        let time_anomaly = self.calculate_time_anomaly(baseline_behavior, current_behavior);
        let location_anomaly = self.calculate_location_anomaly(baseline_behavior, current_behavior);
        let device_anomaly = self.calculate_device_anomaly(baseline_behavior, current_behavior);
        let transaction_anomaly = self.calculate_transaction_anomaly(baseline_behavior, current_behavior);
        let behavioral_anomaly = self.calculate_behavioral_anomaly(baseline_behavior, current_behavior);

        let overall_score = (time_anomaly + location_anomaly + device_anomaly + transaction_anomaly + behavioral_anomaly) / 5.0;

        let risk_level = self.determine_risk_level(overall_score);

        Ok(AnomalyScore {
            overall_score,
            time_anomaly,
            location_anomaly,
            device_anomaly,
            transaction_anomaly,
            behavioral_anomaly,
            risk_level,
            timestamp: chrono::Utc::now(),
        })
    }

    pub fn detect_patterns(&mut self, user_id: &str) -> Result<Vec<BehaviorPattern>> {
        let behavior = match self.user_behaviors.get(user_id) {
            Some(behavior) => behavior,
            None => return Ok(Vec::new()),
        };

        let mut patterns = Vec::new();

        // Detect time patterns
        if self.is_unusual_time_pattern(behavior) {
            patterns.push(BehaviorPattern {
                pattern_id: format!("time_pattern_{}", uuid::Uuid::new_v4()),
                pattern_type: PatternType::Suspicious,
                description: "Unusual time pattern detected".to_string(),
                confidence: 0.8,
                frequency: 0.3,
                last_observed: chrono::Utc::now(),
            });
        }

        // Detect location patterns
        if self.is_unusual_location_pattern(behavior) {
            patterns.push(BehaviorPattern {
                pattern_id: format!("location_pattern_{}", uuid::Uuid::new_v4()),
                pattern_type: PatternType::Suspicious,
                description: "Unusual location pattern detected".to_string(),
                confidence: 0.9,
                frequency: 0.2,
                last_observed: chrono::Utc::now(),
            });
        }

        // Detect device patterns
        if self.is_unusual_device_pattern(behavior) {
            patterns.push(BehaviorPattern {
                pattern_id: format!("device_pattern_{}", uuid::Uuid::new_v4()),
                pattern_type: PatternType::Suspicious,
                description: "Unusual device pattern detected".to_string(),
                confidence: 0.7,
                frequency: 0.4,
                last_observed: chrono::Utc::now(),
            });
        }

        // Store patterns
        for pattern in &patterns {
            self.behavior_patterns.insert(pattern.pattern_id.clone(), pattern.clone());
        }

        Ok(patterns)
    }

    pub fn get_user_patterns(&self, user_id: &str) -> Vec<&BehaviorPattern> {
        self.behavior_patterns.values()
            .filter(|pattern| pattern.description.contains(user_id))
            .collect()
    }

    fn calculate_time_anomaly(&self, baseline: &UserBehavior, current: &UserBehavior) -> f64 {
        let time_diff = self.calculate_time_difference(&baseline.time_patterns, &current.time_patterns);
        let session_diff = self.calculate_session_difference(&baseline.time_patterns.session_timing, &current.time_patterns.session_timing);
        
        (time_diff + session_diff) / 2.0
    }

    fn calculate_location_anomaly(&self, baseline: &UserBehavior, current: &UserBehavior) -> f64 {
        let country_diff = if baseline.location_patterns.primary_country != current.location_patterns.primary_country {
            1.0
        } else {
            0.0
        };
        
        let city_diff = if baseline.location_patterns.primary_city != current.location_patterns.primary_city {
            0.8
        } else {
            0.0
        };
        
        let consistency_diff = (baseline.location_patterns.location_consistency - current.location_patterns.location_consistency).abs();
        
        (country_diff + city_diff + consistency_diff) / 3.0
    }

    fn calculate_device_anomaly(&self, baseline: &UserBehavior, current: &UserBehavior) -> f64 {
        let device_type_diff = self.calculate_string_list_difference(
            &baseline.device_patterns.device_types,
            &current.device_patterns.device_types,
        );
        
        let os_diff = self.calculate_string_list_difference(
            &baseline.device_patterns.operating_systems,
            &current.device_patterns.operating_systems,
        );
        
        let browser_diff = self.calculate_string_list_difference(
            &baseline.device_patterns.browsers,
            &current.device_patterns.browsers,
        );
        
        (device_type_diff + os_diff + browser_diff) / 3.0
    }

    fn calculate_transaction_anomaly(&self, baseline: &UserBehavior, current: &UserBehavior) -> f64 {
        let frequency_diff = (baseline.transaction_frequency - current.transaction_frequency).abs() / baseline.transaction_frequency.max(0.1);
        let amount_diff = (baseline.average_transaction_amount - current.average_transaction_amount).abs() / baseline.average_transaction_amount.max(1.0);
        
        (frequency_diff + amount_diff) / 2.0
    }

    fn calculate_behavioral_anomaly(&self, baseline: &UserBehavior, current: &UserBehavior) -> f64 {
        let session_diff = (baseline.session_duration as f64 - current.session_duration as f64).abs() / baseline.session_duration.max(1) as f64;
        let payment_diff = self.calculate_string_list_difference(
            &baseline.preferred_payment_methods,
            &current.preferred_payment_methods,
        );
        
        (session_diff + payment_diff) / 2.0
    }

    fn calculate_time_difference(&self, baseline: &TimePatterns, current: &TimePatterns) -> f64 {
        let hour_diff = self.calculate_u8_list_difference(&baseline.most_active_hours, &current.most_active_hours);
        let day_diff = self.calculate_u8_list_difference(&baseline.most_active_days, &current.most_active_days);
        
        (hour_diff + day_diff) / 2.0
    }

    fn calculate_session_difference(&self, baseline: &SessionTiming, current: &SessionTiming) -> f64 {
        let length_diff = (baseline.average_session_length as f64 - current.average_session_length as f64).abs() / baseline.average_session_length.max(1) as f64;
        let start_diff = (baseline.typical_session_start as f64 - current.typical_session_start as f64).abs() / 24.0;
        let end_diff = (baseline.typical_session_end as f64 - current.typical_session_end as f64).abs() / 24.0;
        let freq_diff = (baseline.session_frequency - current.session_frequency).abs() / baseline.session_frequency.max(0.1);
        
        (length_diff + start_diff + end_diff + freq_diff) / 4.0
    }

    fn calculate_string_list_difference(&self, baseline: &[String], current: &[String]) -> f64 {
        let baseline_set: std::collections::HashSet<&String> = baseline.iter().collect();
        let current_set: std::collections::HashSet<&String> = current.iter().collect();
        
        let intersection = baseline_set.intersection(&current_set).count();
        let union = baseline_set.union(&current_set).count();
        
        if union == 0 {
            0.0
        } else {
            1.0 - (intersection as f64 / union as f64)
        }
    }

    fn calculate_u8_list_difference(&self, baseline: &[u8], current: &[u8]) -> f64 {
        let baseline_set: std::collections::HashSet<&u8> = baseline.iter().collect();
        let current_set: std::collections::HashSet<&u8> = current.iter().collect();
        
        let intersection = baseline_set.intersection(&current_set).count();
        let union = baseline_set.union(&current_set).count();
        
        if union == 0 {
            0.0
        } else {
            1.0 - (intersection as f64 / union as f64)
        }
    }

    fn is_unusual_time_pattern(&self, behavior: &UserBehavior) -> bool {
        // Check if user is active at unusual hours
        let current_hour = chrono::Utc::now().hour() as u8;
        !behavior.time_patterns.most_active_hours.contains(&current_hour)
    }

    fn is_unusual_location_pattern(&self, behavior: &UserBehavior) -> bool {
        // Check if location consistency is low
        behavior.location_patterns.location_consistency < 0.5
    }

    fn is_unusual_device_pattern(&self, behavior: &UserBehavior) -> bool {
        // Check if device consistency is low
        behavior.device_patterns.device_consistency < 0.6
    }

    fn determine_risk_level(&self, score: f64) -> RiskLevel {
        if score >= 0.9 {
            RiskLevel::Critical
        } else if score >= 0.7 {
            RiskLevel::High
        } else if score >= 0.4 {
            RiskLevel::Medium
        } else {
            RiskLevel::Low
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_behavioral_analyzer_creation() {
        let thresholds = AnomalyThresholds::default();
        let analyzer = BehavioralAnalyzer::new(thresholds);
        assert_eq!(analyzer.user_behaviors.len(), 0);
    }

    #[test]
    fn test_anomaly_analysis() {
        let thresholds = AnomalyThresholds::default();
        let analyzer = BehavioralAnalyzer::new(thresholds);
        
        let behavior = UserBehavior {
            user_id: "test_user".to_string(),
            session_duration: 3600,
            transaction_frequency: 5.0,
            average_transaction_amount: 1000.0,
            preferred_payment_methods: vec!["bitcoin".to_string()],
            time_patterns: TimePatterns {
                most_active_hours: vec![9, 10, 11],
                most_active_days: vec![1, 2, 3, 4, 5],
                timezone: "UTC".to_string(),
                session_timing: SessionTiming {
                    average_session_length: 1800,
                    typical_session_start: 9,
                    typical_session_end: 17,
                    session_frequency: 2.0,
                },
            },
            location_patterns: LocationPatterns {
                primary_country: "US".to_string(),
                primary_city: "New York".to_string(),
                location_consistency: 0.9,
                travel_frequency: 0.1,
                ip_addresses: vec!["192.168.1.1".to_string()],
            },
            device_patterns: DevicePatterns {
                device_types: vec!["mobile".to_string()],
                operating_systems: vec!["iOS".to_string()],
                browsers: vec!["Safari".to_string()],
                device_consistency: 0.95,
                new_device_frequency: 0.05,
            },
            last_updated: chrono::Utc::now(),
        };
        
        let anomaly = analyzer.analyze_anomaly("test_user", &behavior).unwrap();
        assert_eq!(anomaly.risk_level, RiskLevel::Low);
    }
}
