use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, instrument, warn};

/// Lightning Service Provider client for liquidity management
#[derive(Debug)]
pub struct LSPClient {
    providers: Arc<RwLock<HashMap<String, LSPProvider>>>,
    active_provider: Arc<RwLock<Option<String>>>,
    config: LSPConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPProvider {
    pub name: String,
    pub endpoint: String,
    pub api_key: String,
    pub is_active: bool,
    pub min_channel_size: u64,
    pub max_channel_size: u64,
    pub fee_rate: f64,         // sats per 1000 sats
    pub reputation_score: f64, // 0.0 to 1.0
    pub last_used: Option<DateTime<Utc>>,
    pub success_rate: f64,          // 0.0 to 1.0
    pub average_response_time: u64, // milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPConfig {
    pub auto_select_provider: bool,
    pub max_fee_rate: f64,
    pub min_reputation_score: f64,
    pub max_response_time: u64,
    pub retry_attempts: u32,
    pub retry_delay: u64, // milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPChannel {
    pub channel_id: String,
    pub provider: String,
    pub capacity: u64,
    pub local_balance: u64,
    pub remote_balance: u64,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub fee_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPInvoice {
    pub invoice: String,
    pub amount: u64,
    pub provider: String,
    pub expires_at: DateTime<Utc>,
    pub fee: u64,
    pub payment_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPChannelRequest {
    pub capacity: u64,
    pub push_amount: Option<u64>,
    pub fee_rate: Option<f64>,
    pub preferred_provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPChannelResponse {
    pub success: bool,
    pub channel: Option<LSPChannel>,
    pub invoice: Option<LSPInvoice>,
    pub error: Option<String>,
    pub provider: String,
}

impl LSPClient {
    /// Create a new LSP client
    pub fn new(config: LSPConfig) -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            active_provider: Arc::new(RwLock::new(None)),
            config,
        }
    }

    /// Add an LSP provider
    #[instrument(skip(self))]
    pub async fn add_provider(&self, provider: LSPProvider) -> Result<()> {
        let mut providers = self.providers.write().await;
        providers.insert(provider.name.clone(), provider);
        info!("Added LSP provider: {}", providers.last().unwrap().0);
        Ok(())
    }

    /// Get the best available LSP provider
    #[instrument(skip(self))]
    pub async fn get_best_provider(&self) -> Result<Option<LSPProvider>> {
        let providers = self.providers.read().await;

        let mut eligible_providers: Vec<&LSPProvider> = providers
            .values()
            .filter(|p| {
                p.is_active
                    && p.fee_rate <= self.config.max_fee_rate
                    && p.reputation_score >= self.config.min_reputation_score
                    && p.average_response_time <= self.config.max_response_time
            })
            .collect();

        if eligible_providers.is_empty() {
            return Ok(None);
        }

        // Sort by score (combination of reputation, fee rate, and response time)
        eligible_providers.sort_by(|a, b| {
            let score_a = self.calculate_provider_score(a);
            let score_b = self.calculate_provider_score(b);
            score_b.partial_cmp(&score_a).unwrap()
        });

        Ok(Some(eligible_providers[0].clone()))
    }

    /// Calculate provider score for selection
    fn calculate_provider_score(&self, provider: &LSPProvider) -> f64 {
        let reputation_weight = 0.4;
        let fee_weight = 0.3;
        let response_time_weight = 0.3;

        let reputation_score = provider.reputation_score;
        let fee_score = 1.0 - (provider.fee_rate / self.config.max_fee_rate);
        let response_time_score =
            1.0 - (provider.average_response_time as f64 / self.config.max_response_time as f64);

        reputation_score * reputation_weight
            + fee_score * fee_weight
            + response_time_score * response_time_weight
    }

    /// Request a new channel from LSP
    #[instrument(skip(self))]
    pub async fn request_channel(&self, request: LSPChannelRequest) -> Result<LSPChannelResponse> {
        let provider = if let Some(preferred) = &request.preferred_provider {
            self.get_provider(preferred).await?
        } else {
            self.get_best_provider().await?
        };

        let provider = match provider {
            Some(p) => p,
            None => {
                return Ok(LSPChannelResponse {
                    success: false,
                    channel: None,
                    invoice: None,
                    error: Some("No suitable LSP provider available".to_string()),
                    provider: "none".to_string(),
                });
            }
        };

        info!("Requesting channel from LSP provider: {}", provider.name);

        // Simulate LSP channel request
        let response = self
            .simulate_lsp_channel_request(&provider, &request)
            .await?;

        // Update provider statistics
        self.update_provider_stats(&provider.name, response.success)
            .await?;

        Ok(response)
    }

    /// Simulate LSP channel request (in real implementation, this would call LSP API)
    async fn simulate_lsp_channel_request(
        &self,
        provider: &LSPProvider,
        request: &LSPChannelRequest,
    ) -> Result<LSPChannelResponse> {
        // Simulate API call delay
        tokio::time::sleep(tokio::time::Duration::from_millis(
            provider.average_response_time,
        ))
        .await;

        // Simulate success/failure based on provider reputation
        let success_probability = provider.reputation_score;
        let success = rand::random::<f64>() < success_probability;

        if success {
            let channel = LSPChannel {
                channel_id: format!("lsp_{}_{}", provider.name, uuid::Uuid::new_v4()),
                provider: provider.name.clone(),
                capacity: request.capacity,
                local_balance: request.push_amount.unwrap_or(0),
                remote_balance: request.capacity - request.push_amount.unwrap_or(0),
                is_active: true,
                created_at: Utc::now(),
                fee_rate: provider.fee_rate,
            };

            let invoice = LSPInvoice {
                invoice: format!("lnbc{}n1...", request.capacity),
                amount: request.capacity,
                provider: provider.name.clone(),
                expires_at: Utc::now() + chrono::Duration::hours(1),
                fee: (request.capacity as f64 * provider.fee_rate / 1000.0) as u64,
                payment_hash: format!("hash_{}", uuid::Uuid::new_v4()),
            };

            Ok(LSPChannelResponse {
                success: true,
                channel: Some(channel),
                invoice: Some(invoice),
                error: None,
                provider: provider.name.clone(),
            })
        } else {
            Ok(LSPChannelResponse {
                success: false,
                channel: None,
                invoice: None,
                error: Some("LSP channel request failed".to_string()),
                provider: provider.name.clone(),
            })
        }
    }

    /// Get a specific provider
    async fn get_provider(&self, name: &str) -> Result<Option<LSPProvider>> {
        let providers = self.providers.read().await;
        Ok(providers.get(name).cloned())
    }

    /// Update provider statistics
    async fn update_provider_stats(&self, provider_name: &str, success: bool) -> Result<()> {
        let mut providers = self.providers.write().await;
        if let Some(provider) = providers.get_mut(provider_name) {
            provider.last_used = Some(Utc::now());

            // Update success rate (simple moving average)
            let alpha = 0.1; // Learning rate
            provider.success_rate =
                alpha * (success as f64) + (1.0 - alpha) * provider.success_rate;

            // Update reputation score based on success rate
            provider.reputation_score = (provider.reputation_score + provider.success_rate) / 2.0;
        }
        Ok(())
    }

    /// Get all providers
    pub async fn get_providers(&self) -> Vec<LSPProvider> {
        let providers = self.providers.read().await;
        providers.values().cloned().collect()
    }

    /// Get provider statistics
    pub async fn get_provider_stats(&self) -> Result<LSPStats> {
        let providers = self.providers.read().await;

        let total_providers = providers.len();
        let active_providers = providers.values().filter(|p| p.is_active).count();
        let avg_fee_rate = if total_providers > 0 {
            providers.values().map(|p| p.fee_rate).sum::<f64>() / total_providers as f64
        } else {
            0.0
        };
        let avg_reputation = if total_providers > 0 {
            providers.values().map(|p| p.reputation_score).sum::<f64>() / total_providers as f64
        } else {
            0.0
        };

        Ok(LSPStats {
            total_providers,
            active_providers,
            avg_fee_rate,
            avg_reputation,
            providers: providers.values().cloned().collect(),
        })
    }

    /// Set active provider
    pub async fn set_active_provider(&self, provider_name: &str) -> Result<()> {
        let providers = self.providers.read().await;
        if providers.contains_key(provider_name) {
            let mut active = self.active_provider.write().await;
            *active = Some(provider_name.to_string());
            info!("Set active LSP provider: {}", provider_name);
        } else {
            return Err(anyhow::anyhow!("Provider not found: {}", provider_name));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPStats {
    pub total_providers: usize,
    pub active_providers: usize,
    pub avg_fee_rate: f64,
    pub avg_reputation: f64,
    pub providers: Vec<LSPProvider>,
}

impl Default for LSPConfig {
    fn default() -> Self {
        Self {
            auto_select_provider: true,
            max_fee_rate: 0.1, // 0.1 sats per 1000 sats
            min_reputation_score: 0.7,
            max_response_time: 5000, // 5 seconds
            retry_attempts: 3,
            retry_delay: 1000, // 1 second
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_lsp_client_creation() {
        let config = LSPConfig::default();
        let client = LSPClient::new(config);

        let stats = client.get_provider_stats().await.unwrap();
        assert_eq!(stats.total_providers, 0);
    }

    #[tokio::test]
    async fn test_add_provider() {
        let client = LSPClient::new(LSPConfig::default());

        let provider = LSPProvider {
            name: "test_provider".to_string(),
            endpoint: "https://test.lsp.com".to_string(),
            api_key: "test_key".to_string(),
            is_active: true,
            min_channel_size: 100000,
            max_channel_size: 10000000,
            fee_rate: 0.05,
            reputation_score: 0.9,
            last_used: None,
            success_rate: 0.95,
            average_response_time: 1000,
        };

        client.add_provider(provider).await.unwrap();

        let stats = client.get_provider_stats().await.unwrap();
        assert_eq!(stats.total_providers, 1);
    }
}
