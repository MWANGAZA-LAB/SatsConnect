use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LspProviderType {
    AWS_CloudHSM,
    Azure_KeyVault,
    Google_CloudKMS,
    HashiCorp_Vault,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspProviderInfo {
    pub name: String,
    pub provider_type: LspProviderType,
    pub endpoint: String,
    pub is_active: bool,
    pub min_channel_size: u64,
    pub max_channel_size: u64,
    pub fee_rate: f64,
    pub reputation_score: f64,
    pub success_rate: f64,
    pub average_response_time_ms: u64,
    pub supported_features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspConfig {
    pub providers: Vec<LspProviderInfo>,
    pub default_provider: Option<String>,
    pub fallback_providers: Vec<String>,
    pub max_retries: u32,
    pub timeout_ms: u64,
}

impl Default for LspConfig {
    fn default() -> Self {
        Self {
            providers: vec![
                LspProviderInfo {
                    name: "AWS CloudHSM".to_string(),
                    provider_type: LspProviderType::AWS_CloudHSM,
                    endpoint: "https://hsm.aws.com".to_string(),
                    is_active: true,
                    min_channel_size: 100_000,
                    max_channel_size: 10_000_000,
                    fee_rate: 0.05,
                    reputation_score: 0.95,
                    success_rate: 0.98,
                    average_response_time_ms: 500,
                    supported_features: vec![
                        "channel_management".to_string(),
                        "payment_routing".to_string(),
                        "liquidity_provision".to_string(),
                    ],
                },
                LspProviderInfo {
                    name: "Azure KeyVault".to_string(),
                    provider_type: LspProviderType::Azure_KeyVault,
                    endpoint: "https://vault.azure.com".to_string(),
                    is_active: true,
                    min_channel_size: 50_000,
                    max_channel_size: 5_000_000,
                    fee_rate: 0.03,
                    reputation_score: 0.92,
                    success_rate: 0.96,
                    average_response_time_ms: 600,
                    supported_features: vec![
                        "channel_management".to_string(),
                        "payment_routing".to_string(),
                    ],
                },
            ],
            default_provider: Some("AWS CloudHSM".to_string()),
            fallback_providers: vec!["Azure KeyVault".to_string()],
            max_retries: 3,
            timeout_ms: 5000,
        }
    }
}

/// LSP Provider management
#[derive(Debug)]
pub struct LspProvider {
    config: LspConfig,
    provider_map: HashMap<String, LspProviderInfo>,
}

impl LspProvider {
    pub fn new(config: LspConfig) -> Self {
        let mut provider_map = HashMap::new();
        for provider in &config.providers {
            provider_map.insert(provider.name.clone(), provider.clone());
        }

        Self {
            config,
            provider_map,
        }
    }

    pub fn get_provider(&self, name: &str) -> Option<&LspProviderInfo> {
        self.provider_map.get(name)
    }

    pub fn get_active_providers(&self) -> Vec<&LspProviderInfo> {
        self.provider_map.values().filter(|p| p.is_active).collect()
    }

    pub fn get_best_provider(&self) -> Option<&LspProviderInfo> {
        self.get_active_providers()
            .iter()
            .max_by(|a, b| {
                // Sort by reputation score, then success rate, then response time
                a.reputation_score
                    .partial_cmp(&b.reputation_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then(
                        a.success_rate
                            .partial_cmp(&b.success_rate)
                            .unwrap_or(std::cmp::Ordering::Equal),
                    )
                    .then(b.average_response_time_ms.cmp(&a.average_response_time_ms))
            })
            .copied()
    }

    pub fn get_providers_by_feature(&self, feature: &str) -> Vec<&LspProviderInfo> {
        self.get_active_providers()
            .into_iter()
            .filter(|p| p.supported_features.contains(&feature.to_string()))
            .collect()
    }

    pub fn get_providers_by_capacity(
        &self,
        min_capacity: u64,
        max_capacity: u64,
    ) -> Vec<&LspProviderInfo> {
        self.get_active_providers()
            .into_iter()
            .filter(|p| p.min_channel_size <= min_capacity && p.max_channel_size >= max_capacity)
            .collect()
    }

    pub fn update_provider_reputation(&mut self, name: &str, reputation_score: f64) -> Result<()> {
        if let Some(provider) = self.provider_map.get_mut(name) {
            provider.reputation_score = reputation_score;
            info!(
                "Updated reputation score for provider {} to {}",
                name, reputation_score
            );
        } else {
            return Err(anyhow::anyhow!("Provider {} not found", name));
        }
        Ok(())
    }

    pub fn update_provider_success_rate(&mut self, name: &str, success_rate: f64) -> Result<()> {
        if let Some(provider) = self.provider_map.get_mut(name) {
            provider.success_rate = success_rate;
            info!(
                "Updated success rate for provider {} to {}",
                name, success_rate
            );
        } else {
            return Err(anyhow::anyhow!("Provider {} not found", name));
        }
        Ok(())
    }

    pub fn update_provider_response_time(
        &mut self,
        name: &str,
        response_time_ms: u64,
    ) -> Result<()> {
        if let Some(provider) = self.provider_map.get_mut(name) {
            provider.average_response_time_ms = response_time_ms;
            info!(
                "Updated response time for provider {} to {}ms",
                name, response_time_ms
            );
        } else {
            return Err(anyhow::anyhow!("Provider {} not found", name));
        }
        Ok(())
    }

    pub fn add_provider(&mut self, provider: LspProviderInfo) {
        self.provider_map.insert(provider.name.clone(), provider);
        info!("Added new LSP provider: {}", self.provider_map.len());
    }

    pub fn remove_provider(&mut self, name: &str) -> Result<()> {
        if self.provider_map.remove(name).is_some() {
            info!("Removed LSP provider: {}", name);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Provider {} not found", name))
        }
    }

    pub fn get_provider_stats(&self) -> LspProviderStats {
        let total_providers = self.provider_map.len();
        let active_providers = self.get_active_providers().len();
        let avg_reputation = self
            .get_active_providers()
            .iter()
            .map(|p| p.reputation_score)
            .sum::<f64>()
            / active_providers.max(1) as f64;
        let avg_success_rate = self
            .get_active_providers()
            .iter()
            .map(|p| p.success_rate)
            .sum::<f64>()
            / active_providers.max(1) as f64;
        let avg_response_time = self
            .get_active_providers()
            .iter()
            .map(|p| p.average_response_time_ms)
            .sum::<u64>()
            / active_providers.max(1) as u64;

        LspProviderStats {
            total_providers,
            active_providers,
            avg_reputation,
            avg_success_rate,
            avg_response_time,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspProviderStats {
    pub total_providers: usize,
    pub active_providers: usize,
    pub avg_reputation: f64,
    pub avg_success_rate: f64,
    pub avg_response_time: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lsp_provider_creation() {
        let config = LspConfig::default();
        let provider = LspProvider::new(config);

        assert!(provider.get_provider("AWS CloudHSM").is_some());
        assert!(provider.get_provider("Azure KeyVault").is_some());
    }

    #[test]
    fn test_get_active_providers() {
        let config = LspConfig::default();
        let provider = LspProvider::new(config);

        let active_providers = provider.get_active_providers();
        assert_eq!(active_providers.len(), 2);
    }

    #[test]
    fn test_get_best_provider() {
        let config = LspConfig::default();
        let provider = LspProvider::new(config);

        let best_provider = provider.get_best_provider();
        assert!(best_provider.is_some());
        assert_eq!(best_provider.unwrap().name, "AWS CloudHSM");
    }

    #[test]
    fn test_get_providers_by_feature() {
        let config = LspConfig::default();
        let provider = LspProvider::new(config);

        let providers = provider.get_providers_by_feature("channel_management");
        assert_eq!(providers.len(), 2);
    }

    #[test]
    fn test_provider_stats() {
        let config = LspConfig::default();
        let provider = LspProvider::new(config);

        let stats = provider.get_provider_stats();
        assert_eq!(stats.total_providers, 2);
        assert_eq!(stats.active_providers, 2);
    }
}
