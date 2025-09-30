pub mod fraud_detection;
pub mod machine_learning;
pub mod behavioral_analysis;

pub use fraud_detection::{FraudDetectionService, FraudScore, RiskLevel, FraudPattern};
pub use machine_learning::{MLModel, ModelType, ModelConfig, PredictionResult};
pub use behavioral_analysis::{BehavioralAnalyzer, UserBehavior, BehaviorPattern, AnomalyScore};