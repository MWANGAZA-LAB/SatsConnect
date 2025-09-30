use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, warn};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChannelState {
    Pending,
    Open,
    Closing,
    Closed,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelInfo {
    pub channel_id: String,
    pub peer_id: String,
    pub capacity_sats: u64,
    pub local_balance_sats: u64,
    pub remote_balance_sats: u64,
    pub state: ChannelState,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfig {
    pub min_channel_size: u64,
    pub max_channel_size: u64,
    pub max_channels_per_peer: u32,
    pub channel_fee_rate: u64,
    pub channel_timeout: u64,
}

impl Default for ChannelConfig {
    fn default() -> Self {
        Self {
            min_channel_size: 100_000, // 100k sats
            max_channel_size: 10_000_000, // 10M sats
            max_channels_per_peer: 5,
            channel_fee_rate: 1, // 1 sat per vbyte
            channel_timeout: 144, // 24 hours
        }
    }
}

/// Manages Lightning Network channels
#[derive(Debug)]
pub struct ChannelManager {
    channels: Arc<RwLock<HashMap<String, ChannelInfo>>>,
    config: ChannelConfig,
}

impl ChannelManager {
    pub fn new(config: ChannelConfig) -> Self {
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    /// Create a new channel with a peer
    pub async fn create_channel(
        &self,
        peer_id: String,
        capacity_sats: u64,
    ) -> Result<String> {
        // Validate channel size
        if capacity_sats < self.config.min_channel_size {
            return Err(anyhow::anyhow!(
                "Channel size {} sats is below minimum {} sats",
                capacity_sats,
                self.config.min_channel_size
            ));
        }

        if capacity_sats > self.config.max_channel_size {
            return Err(anyhow::anyhow!(
                "Channel size {} sats exceeds maximum {} sats",
                capacity_sats,
                self.config.max_channel_size
            ));
        }

        // Check existing channels with this peer
        let channels = self.channels.read().await;
        let peer_channel_count = channels.values()
            .filter(|ch| ch.peer_id == peer_id)
            .count();

        if peer_channel_count >= self.config.max_channels_per_peer as usize {
            return Err(anyhow::anyhow!(
                "Maximum channels per peer ({}) exceeded",
                self.config.max_channels_per_peer
            ));
        }
        drop(channels);

        // Generate channel ID
        let channel_id = format!("ch_{}", uuid::Uuid::new_v4());

        // Create channel info
        let channel_info = ChannelInfo {
            channel_id: channel_id.clone(),
            peer_id: peer_id.clone(),
            capacity_sats,
            local_balance_sats: 0,
            remote_balance_sats: capacity_sats,
            state: ChannelState::Pending,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        // Store channel
        let mut channels = self.channels.write().await;
        channels.insert(channel_id.clone(), channel_info);

        info!(
            "Created channel {} with peer {} (capacity: {} sats)",
            channel_id, peer_id, capacity_sats
        );

        Ok(channel_id)
    }

    /// Get channel information
    pub async fn get_channel(&self, channel_id: &str) -> Result<Option<ChannelInfo>> {
        let channels = self.channels.read().await;
        Ok(channels.get(channel_id).cloned())
    }

    /// Get all channels
    pub async fn get_all_channels(&self) -> Vec<ChannelInfo> {
        let channels = self.channels.read().await;
        channels.values().cloned().collect()
    }

    /// Get channels by peer
    pub async fn get_channels_by_peer(&self, peer_id: &str) -> Vec<ChannelInfo> {
        let channels = self.channels.read().await;
        channels.values()
            .filter(|ch| ch.peer_id == peer_id)
            .cloned()
            .collect()
    }

    /// Update channel state
    pub async fn update_channel_state(
        &self,
        channel_id: &str,
        state: ChannelState,
    ) -> Result<()> {
        let mut channels = self.channels.write().await;
        if let Some(channel) = channels.get_mut(channel_id) {
            channel.state = state;
            channel.updated_at = chrono::Utc::now();
            info!("Updated channel {} state to {:?}", channel_id, state);
        } else {
            return Err(anyhow::anyhow!("Channel {} not found", channel_id));
        }
        Ok(())
    }

    /// Update channel balance
    pub async fn update_channel_balance(
        &self,
        channel_id: &str,
        local_balance_sats: u64,
        remote_balance_sats: u64,
    ) -> Result<()> {
        let mut channels = self.channels.write().await;
        if let Some(channel) = channels.get_mut(channel_id) {
            channel.local_balance_sats = local_balance_sats;
            channel.remote_balance_sats = remote_balance_sats;
            channel.updated_at = chrono::Utc::now();
            info!(
                "Updated channel {} balance: local={}, remote={}",
                channel_id, local_balance_sats, remote_balance_sats
            );
        } else {
            return Err(anyhow::anyhow!("Channel {} not found", channel_id));
        }
        Ok(())
    }

    /// Close a channel
    pub async fn close_channel(&self, channel_id: &str) -> Result<()> {
        let mut channels = self.channels.write().await;
        if let Some(channel) = channels.get_mut(channel_id) {
            channel.state = ChannelState::Closing;
            channel.updated_at = chrono::Utc::now();
            info!("Closing channel {}", channel_id);
        } else {
            return Err(anyhow::anyhow!("Channel {} not found", channel_id));
        }
        Ok(())
    }

    /// Get total channel capacity
    pub async fn get_total_capacity(&self) -> u64 {
        let channels = self.channels.read().await;
        channels.values()
            .filter(|ch| ch.state == ChannelState::Open)
            .map(|ch| ch.capacity_sats)
            .sum()
    }

    /// Get total local balance
    pub async fn get_total_local_balance(&self) -> u64 {
        let channels = self.channels.read().await;
        channels.values()
            .filter(|ch| ch.state == ChannelState::Open)
            .map(|ch| ch.local_balance_sats)
            .sum()
    }

    /// Get total remote balance
    pub async fn get_total_remote_balance(&self) -> u64 {
        let channels = self.channels.read().await;
        channels.values()
            .filter(|ch| ch.state == ChannelState::Open)
            .map(|ch| ch.remote_balance_sats)
            .sum()
    }

    /// Get channel statistics
    pub async fn get_channel_stats(&self) -> ChannelStats {
        let channels = self.channels.read().await;
        
        let total_channels = channels.len();
        let open_channels = channels.values()
            .filter(|ch| ch.state == ChannelState::Open)
            .count();
        let pending_channels = channels.values()
            .filter(|ch| ch.state == ChannelState::Pending)
            .count();
        let closing_channels = channels.values()
            .filter(|ch| ch.state == ChannelState::Closing)
            .count();
        let closed_channels = channels.values()
            .filter(|ch| ch.state == ChannelState::Closed)
            .count();

        let total_capacity: u64 = channels.values()
            .filter(|ch| ch.state == ChannelState::Open)
            .map(|ch| ch.capacity_sats)
            .sum();

        let total_local_balance: u64 = channels.values()
            .filter(|ch| ch.state == ChannelState::Open)
            .map(|ch| ch.local_balance_sats)
            .sum();

        let total_remote_balance: u64 = channels.values()
            .filter(|ch| ch.state == ChannelState::Open)
            .map(|ch| ch.remote_balance_sats)
            .sum();

        ChannelStats {
            total_channels,
            open_channels,
            pending_channels,
            closing_channels,
            closed_channels,
            total_capacity,
            total_local_balance,
            total_remote_balance,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelStats {
    pub total_channels: usize,
    pub open_channels: usize,
    pub pending_channels: usize,
    pub closing_channels: usize,
    pub closed_channels: usize,
    pub total_capacity: u64,
    pub total_local_balance: u64,
    pub total_remote_balance: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_channel() {
        let config = ChannelConfig::default();
        let manager = ChannelManager::new(config);
        
        let channel_id = manager.create_channel("peer123".to_string(), 1_000_000).await.unwrap();
        assert!(!channel_id.is_empty());
        
        let channel = manager.get_channel(&channel_id).await.unwrap();
        assert!(channel.is_some());
        let channel = channel.unwrap();
        assert_eq!(channel.peer_id, "peer123");
        assert_eq!(channel.capacity_sats, 1_000_000);
        assert_eq!(channel.state, ChannelState::Pending);
    }

    #[tokio::test]
    async fn test_channel_validation() {
        let config = ChannelConfig::default();
        let manager = ChannelManager::new(config);
        
        // Test minimum channel size
        let result = manager.create_channel("peer123".to_string(), 50_000).await;
        assert!(result.is_err());
        
        // Test maximum channel size
        let result = manager.create_channel("peer123".to_string(), 20_000_000).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_channel_stats() {
        let config = ChannelConfig::default();
        let manager = ChannelManager::new(config);
        
        // Create some channels
        manager.create_channel("peer1".to_string(), 1_000_000).await.unwrap();
        manager.create_channel("peer2".to_string(), 2_000_000).await.unwrap();
        
        let stats = manager.get_channel_stats().await;
        assert_eq!(stats.total_channels, 2);
        assert_eq!(stats.pending_channels, 2);
    }
}
