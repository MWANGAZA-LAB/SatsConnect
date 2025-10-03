use anyhow::Result;
use bitcoin::Network;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;

/// Configuration for SatsConnect Lightning Engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightningConfig {
    /// Bitcoin network to use
    pub network: Network,
    /// Data directory for Lightning node
    pub data_dir: PathBuf,
    /// Esplora server URL for blockchain data
    pub esplora_url: String,
    /// Whether to use LDK gossip source
    pub use_ldk_gossip: bool,
    /// Whether to persist network graph
    pub persist_network_graph: bool,
    /// Bitcoin Core RPC configuration
    pub bitcoin_rpc: BitcoinRpcConfig,
    /// Lightning node configuration
    pub lightning_node: LightningNodeConfig,
}

/// Bitcoin Core RPC configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitcoinRpcConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    pub wallet_name: Option<String>,
}

/// Lightning node specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightningNodeConfig {
    /// Channel confirmation timeout in blocks
    pub channel_confirmation_timeout: u32,
    /// Maximum channel size in sats
    pub max_channel_size: u64,
    /// Minimum channel size in sats
    pub min_channel_size: u64,
    /// Channel reserve amount in sats
    pub channel_reserve: u64,
    /// Whether to announce channels
    pub announce_channels: bool,
    /// Whether to accept incoming channels
    pub accept_incoming_channels: bool,
}

impl Default for LightningConfig {
    fn default() -> Self {
        Self {
            network: Network::Testnet,
            data_dir: Self::default_data_dir(),
            esplora_url: Self::default_esplora_url(),
            use_ldk_gossip: true,
            persist_network_graph: false,
            bitcoin_rpc: BitcoinRpcConfig::default(),
            lightning_node: LightningNodeConfig::default(),
        }
    }
}

impl Default for BitcoinRpcConfig {
    fn default() -> Self {
        Self {
            url: "http://127.0.0.1:18332".to_string(),
            username: "user".to_string(),
            password: "password".to_string(),
            wallet_name: Some("satsconnect".to_string()),
        }
    }
}

impl Default for LightningNodeConfig {
    fn default() -> Self {
        Self {
            channel_confirmation_timeout: 6,
            max_channel_size: 10_000_000, // 10M sats
            min_channel_size: 100_000,    // 100K sats
            channel_reserve: 10_000,      // 10K sats
            announce_channels: true,
            accept_incoming_channels: true,
        }
    }
}

impl LightningConfig {
    /// Create configuration from environment variables
    pub fn from_env() -> Result<Self> {
        let mut config = Self::default();

        // Override with environment variables if present
        if let Ok(network_str) = env::var("BITCOIN_NETWORK") {
            config.network = match network_str.to_lowercase().as_str() {
                "mainnet" => Network::Bitcoin,
                "testnet" => Network::Testnet,
                "regtest" => Network::Regtest,
                "signet" => Network::Signet,
                _ => Network::Testnet,
            };
        }

        if let Ok(data_dir) = env::var("DATA_DIR") {
            config.data_dir = PathBuf::from(data_dir);
        }

        if let Ok(esplora_url) = env::var("ESPLORA_URL") {
            config.esplora_url = esplora_url;
        }

        // Bitcoin RPC configuration
        if let Ok(rpc_url) = env::var("BITCOIN_RPC_URL") {
            config.bitcoin_rpc.url = rpc_url;
        }

        if let Ok(rpc_user) = env::var("BITCOIN_RPC_USER") {
            config.bitcoin_rpc.username = rpc_user;
        }

        if let Ok(rpc_pass) = env::var("BITCOIN_RPC_PASS") {
            config.bitcoin_rpc.password = rpc_pass;
        }

        if let Ok(wallet_name) = env::var("BITCOIN_WALLET_NAME") {
            config.bitcoin_rpc.wallet_name = Some(wallet_name);
        }

        Ok(config)
    }

    /// Get the default data directory
    fn default_data_dir() -> PathBuf {
        if let Some(dirs) = directories::ProjectDirs::from("com", "SatsConnect", "engine") {
            dirs.data_dir().to_path_buf()
        } else {
            PathBuf::from("./data")
        }
    }

    /// Get the default Esplora URL based on network
    fn default_esplora_url() -> String {
        match env::var("BITCOIN_NETWORK")
            .unwrap_or_default()
            .to_lowercase()
            .as_str()
        {
            "mainnet" => "https://blockstream.info/api".to_string(),
            "testnet" => "https://blockstream.info/testnet/api".to_string(),
            "regtest" => "http://127.0.0.1:3000".to_string(),
            "signet" => "https://blockstream.info/signet/api".to_string(),
            _ => "https://blockstream.info/testnet/api".to_string(),
        }
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<()> {
        // Ensure data directory exists
        std::fs::create_dir_all(&self.data_dir)?;

        // Validate network configuration
        match self.network {
            Network::Bitcoin => {
                if self.esplora_url.contains("testnet") || self.esplora_url.contains("regtest") {
                    return Err(anyhow::anyhow!(
                        "Mainnet configuration with testnet Esplora URL"
                    ));
                }
            }
            Network::Testnet => {
                if !self.esplora_url.contains("testnet") && !self.esplora_url.contains("regtest") {
                    return Err(anyhow::anyhow!(
                        "Testnet configuration with mainnet Esplora URL"
                    ));
                }
            }
            Network::Regtest => {
                if !self.esplora_url.contains("127.0.0.1")
                    && !self.esplora_url.contains("localhost")
                {
                    return Err(anyhow::anyhow!(
                        "Regtest configuration with remote Esplora URL"
                    ));
                }
            }
            Network::Signet => {
                if !self.esplora_url.contains("signet") {
                    return Err(anyhow::anyhow!(
                        "Signet configuration with non-signet Esplora URL"
                    ));
                }
            }
        }

        // Validate Lightning node configuration
        if self.lightning_node.min_channel_size >= self.lightning_node.max_channel_size {
            return Err(anyhow::anyhow!(
                "Minimum channel size must be less than maximum channel size"
            ));
        }

        if self.lightning_node.channel_reserve >= self.lightning_node.min_channel_size {
            return Err(anyhow::anyhow!(
                "Channel reserve must be less than minimum channel size"
            ));
        }

        Ok(())
    }

    /// Save configuration to file
    pub fn save_to_file(&self, path: &PathBuf) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    /// Load configuration from file
    pub fn load_from_file(path: &PathBuf) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: Self = serde_json::from_str(&content)?;
        config.validate()?;
        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_default_config() {
        let config = LightningConfig::default();
        assert_eq!(config.network, Network::Testnet);
        assert!(config.use_ldk_gossip);
        assert!(!config.persist_network_graph);
    }

    #[test]
    fn test_config_validation() {
        let mut config = LightningConfig::default();
        assert!(config.validate().is_ok());

        // Test invalid channel sizes
        config.lightning_node.min_channel_size = 1_000_000;
        config.lightning_node.max_channel_size = 500_000;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_config_serialization() {
        let config = LightningConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: LightningConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.network, deserialized.network);
    }

    #[test]
    fn test_config_file_operations() {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let config = LightningConfig::default();
        config.save_to_file(&config_path).unwrap();

        let loaded_config = LightningConfig::load_from_file(&config_path).unwrap();
        assert_eq!(config.network, loaded_config.network);
    }
}
