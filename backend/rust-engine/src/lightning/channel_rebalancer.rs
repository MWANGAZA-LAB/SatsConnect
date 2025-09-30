use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, warn, instrument};
use chrono::{DateTime, Utc};

/// Channel rebalancing service for optimal Lightning Network liquidity
#[derive(Debug)]
pub struct ChannelRebalancer {
    channels: Arc<RwLock<HashMap<String, ChannelInfo>>>,
    rebalance_threshold: f64, // 0.1 = 10% threshold
    min_rebalance_amount: u64, // Minimum sats to rebalance
    max_rebalance_amount: u64, // Maximum sats to rebalance
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelInfo {
    pub channel_id: String,
    pub local_balance: u64,
    pub remote_balance: u64,
    pub capacity: u64,
    pub is_active: bool,
    pub last_rebalance: Option<DateTime<Utc>>,
    pub rebalance_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebalanceOperation {
    pub operation_id: String,
    pub from_channel: String,
    pub to_channel: String,
    pub amount: u64,
    pub status: RebalanceStatus,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RebalanceStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

impl ChannelRebalancer {
    /// Create a new channel rebalancer
    pub fn new() -> Self {
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
            rebalance_threshold: 0.1, // 10% threshold
            min_rebalance_amount: 10000, // 10k sats
            max_rebalance_amount: 1000000, // 1M sats
        }
    }

    /// Add or update channel information
    #[instrument(skip(self))]
    pub async fn update_channel(&self, channel_info: ChannelInfo) -> Result<()> {
        let mut channels = self.channels.write().await;
        channels.insert(channel_info.channel_id.clone(), channel_info);
        Ok(())
    }

    /// Check if channels need rebalancing
    #[instrument(skip(self))]
    pub async fn check_rebalancing_needed(&self) -> Result<Vec<RebalanceOperation>> {
        let channels = self.channels.read().await;
        let mut rebalance_ops = Vec::new();

        // Find channels that are imbalanced
        let mut imbalanced_channels = Vec::new();
        for (channel_id, channel) in channels.iter() {
            if !channel.is_active {
                continue;
            }

            let balance_ratio = self.calculate_balance_ratio(channel);
            if balance_ratio > self.rebalance_threshold {
                imbalanced_channels.push((channel_id.clone(), channel.clone(), balance_ratio));
            }
        }

        // Sort by imbalance severity
        imbalanced_channels.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());

        // Create rebalance operations
        for (channel_id, channel, ratio) in imbalanced_channels {
            if let Some(operation) = self.create_rebalance_operation(&channel, ratio).await? {
                rebalance_ops.push(operation);
            }
        }

        info!("Found {} channels needing rebalancing", rebalance_ops.len());
        Ok(rebalance_ops)
    }

    /// Calculate balance ratio (0.0 = perfectly balanced, 1.0 = completely imbalanced)
    fn calculate_balance_ratio(&self, channel: &ChannelInfo) -> f64 {
        if channel.capacity == 0 {
            return 0.0;
        }

        let ideal_balance = channel.capacity / 2;
        let actual_balance = channel.local_balance;
        let difference = if actual_balance > ideal_balance {
            actual_balance - ideal_balance
        } else {
            ideal_balance - actual_balance
        };

        (difference as f64) / (ideal_balance as f64)
    }

    /// Create a rebalance operation
    async fn create_rebalance_operation(
        &self,
        channel: &ChannelInfo,
        ratio: f64,
    ) -> Result<Option<RebalanceOperation>> {
        let rebalance_amount = self.calculate_rebalance_amount(channel, ratio);
        
        if rebalance_amount < self.min_rebalance_amount {
            return Ok(None);
        }

        if rebalance_amount > self.max_rebalance_amount {
            return Ok(None);
        }

        // Find a suitable target channel
        let channels = self.channels.read().await;
        let target_channel = self.find_target_channel(&channels, channel, rebalance_amount).await?;

        if target_channel.is_none() {
            warn!("No suitable target channel found for rebalancing");
            return Ok(None);
        }

        let operation = RebalanceOperation {
            operation_id: format!("rebalance_{}", uuid::Uuid::new_v4()),
            from_channel: channel.channel_id.clone(),
            to_channel: target_channel.unwrap().channel_id.clone(),
            amount: rebalance_amount,
            status: RebalanceStatus::Pending,
            created_at: Utc::now(),
            completed_at: None,
        };

        Ok(Some(operation))
    }

    /// Calculate rebalance amount
    fn calculate_rebalance_amount(&self, channel: &ChannelInfo, ratio: f64) -> u64 {
        let ideal_balance = channel.capacity / 2;
        let current_balance = channel.local_balance;
        
        if current_balance > ideal_balance {
            // Need to send out
            let excess = current_balance - ideal_balance;
            (excess as f64 * 0.8) as u64 // Rebalance 80% of excess
        } else {
            // Need to receive
            let deficit = ideal_balance - current_balance;
            (deficit as f64 * 0.8) as u64 // Rebalance 80% of deficit
        }
    }

    /// Find a suitable target channel for rebalancing
    async fn find_target_channel(
        &self,
        channels: &HashMap<String, ChannelInfo>,
        source_channel: &ChannelInfo,
        amount: u64,
    ) -> Result<Option<&ChannelInfo>> {
        for (_, channel) in channels.iter() {
            if channel.channel_id == source_channel.channel_id {
                continue;
            }

            if !channel.is_active {
                continue;
            }

            // Check if this channel can receive the rebalance
            let ideal_balance = channel.capacity / 2;
            let current_balance = channel.local_balance;
            
            if current_balance < ideal_balance {
                let capacity = ideal_balance - current_balance;
                if capacity >= amount {
                    return Ok(Some(channel));
                }
            }
        }

        Ok(None)
    }

    /// Execute a rebalance operation
    #[instrument(skip(self))]
    pub async fn execute_rebalance(&self, operation: &mut RebalanceOperation) -> Result<bool> {
        operation.status = RebalanceStatus::InProgress;
        
        info!("Executing rebalance operation: {} ({} sats)", operation.operation_id, operation.amount);

        // In a real implementation, this would:
        // 1. Create a Lightning invoice on the target channel
        // 2. Send payment from source channel to target channel
        // 3. Update channel balances
        // 4. Handle errors and retries

        // Simulate rebalance execution
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // For now, assume success
        operation.status = RebalanceStatus::Completed;
        operation.completed_at = Some(Utc::now());

        // Update channel information
        self.update_channel_after_rebalance(operation).await?;

        info!("Rebalance operation completed: {}", operation.operation_id);
        Ok(true)
    }

    /// Update channel information after rebalance
    async fn update_channel_after_rebalance(&self, operation: &RebalanceOperation) -> Result<()> {
        let mut channels = self.channels.write().await;
        
        // Update source channel
        if let Some(source_channel) = channels.get_mut(&operation.from_channel) {
            source_channel.local_balance = source_channel.local_balance.saturating_sub(operation.amount);
            source_channel.last_rebalance = Some(Utc::now());
            source_channel.rebalance_count += 1;
        }

        // Update target channel
        if let Some(target_channel) = channels.get_mut(&operation.to_channel) {
            target_channel.local_balance += operation.amount;
            target_channel.last_rebalance = Some(Utc::now());
        }

        Ok(())
    }

    /// Get rebalancing statistics
    pub async fn get_rebalancing_stats(&self) -> Result<RebalancingStats> {
        let channels = self.channels.read().await;
        
        let total_channels = channels.len();
        let active_channels = channels.values().filter(|c| c.is_active).count();
        let imbalanced_channels = channels.values()
            .filter(|c| c.is_active && self.calculate_balance_ratio(c) > self.rebalance_threshold)
            .count();

        let total_rebalances: u32 = channels.values().map(|c| c.rebalance_count).sum();
        let avg_balance_ratio = if active_channels > 0 {
            let total_ratio: f64 = channels.values()
                .filter(|c| c.is_active)
                .map(|c| self.calculate_balance_ratio(c))
                .sum();
            total_ratio / active_channels as f64
        } else {
            0.0
        };

        Ok(RebalancingStats {
            total_channels,
            active_channels,
            imbalanced_channels,
            total_rebalances,
            avg_balance_ratio,
            rebalance_threshold: self.rebalance_threshold,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebalancingStats {
    pub total_channels: usize,
    pub active_channels: usize,
    pub imbalanced_channels: usize,
    pub total_rebalances: u32,
    pub avg_balance_ratio: f64,
    pub rebalance_threshold: f64,
}

impl Default for ChannelRebalancer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_channel_rebalancer() {
        let rebalancer = ChannelRebalancer::new();
        
        let channel = ChannelInfo {
            channel_id: "test_channel".to_string(),
            local_balance: 1000000, // 1M sats
            remote_balance: 0, // 0 sats (completely imbalanced)
            capacity: 1000000, // 1M sats total
            is_active: true,
            last_rebalance: None,
            rebalance_count: 0,
        };
        
        rebalancer.update_channel(channel).await.unwrap();
        
        let operations = rebalancer.check_rebalancing_needed().await.unwrap();
        assert!(!operations.is_empty());
    }

    #[test]
    fn test_balance_ratio_calculation() {
        let rebalancer = ChannelRebalancer::new();
        
        let channel = ChannelInfo {
            channel_id: "test".to_string(),
            local_balance: 100000,
            remote_balance: 900000,
            capacity: 1000000,
            is_active: true,
            last_rebalance: None,
            rebalance_count: 0,
        };
        
        let ratio = rebalancer.calculate_balance_ratio(&channel);
        assert!(ratio > 0.0);
    }
}
