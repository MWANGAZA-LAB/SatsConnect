pub mod behavioral_analysis;
pub mod fraud_detection;
pub mod machine_learning;

pub use behavioral_analysis::{AnomalyScore, BehaviorPattern, BehavioralAnalyzer, UserBehavior};
pub use fraud_detection::{FraudDetectionService, FraudPattern, FraudScore, RiskLevel};
pub use machine_learning::{MLModel, ModelConfig, ModelType, PredictionResult};
