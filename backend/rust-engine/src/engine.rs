use anyhow::Result;
use bip39::{Language, Mnemonic};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};
use tokio::sync::{Mutex, RwLock};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletState {
    pub node_id_hex: String,
    pub label: String,
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerNode {
    pub node_id: String,
    pub address: String,
    pub is_online: bool,
    pub last_seen: u64,
    pub connection_attempts: u32,
    pub success_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub is_healthy: bool,
    pub last_check: u64,
    pub error_count: u32,
    pub last_error: Option<String>,
}

#[derive(Debug)]
pub struct LightningEngine {
    pub state_file: PathBuf,
    pub state: Mutex<WalletState>,
    pub mnemonic: String,
    pub peers: RwLock<HashMap<String, PeerNode>>,
    pub health: RwLock<HealthStatus>,
    pub primary_peer: RwLock<Option<String>>,
}

impl LightningEngine {
    pub async fn init(label: String, maybe_mnemonic: Option<String>) -> Result<Self> {
        let dirs = ProjectDirs::from("com", "SatsConnect", "engine").expect("dirs");
        let data_dir = dirs.data_dir().to_path_buf();
        fs::create_dir_all(&data_dir)?;
        let state_file = data_dir.join("state.json");

        let mnemonic = if let Some(m) = maybe_mnemonic { 
            // Validate the provided mnemonic
            Mnemonic::parse(&m)?;
            m 
        } else { 
            let m = Mnemonic::generate_in(Language::English, 12)?;
            m.to_string()
        };

        // Generate a mock node ID from the mnemonic
        let mut hasher = Sha256::new();
        hasher.update(mnemonic.as_bytes());
        let node_id_hex = format!("{:x}", hasher.finalize());

        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let state = WalletState { 
            node_id_hex: node_id_hex.clone(), 
            label: label.clone(),
            last_updated: now,
        };
        
        let health = HealthStatus {
            is_healthy: true,
            last_check: now,
            error_count: 0,
            last_error: None,
        };
        
        let engine = Self {
            state_file,
            state: Mutex::new(state),
            mnemonic,
            peers: RwLock::new(HashMap::new()),
            health: RwLock::new(health),
            primary_peer: RwLock::new(None),
        };
        
        engine.persist_state().await?;
        Ok(engine)
    }

    pub async fn persist_state(&self) -> Result<()> {
        let state = self.state.lock().await;
        let json = serde_json::to_string_pretty(&*state)?;
        fs::write(&self.state_file, json)?;
        Ok(())
    }

    pub async fn generate_invoice(&self, amount_sats: u64, memo: Option<String>) -> Result<(String, String)> {
        // Mock Lightning invoice generation
        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}", amount_sats, memo.unwrap_or_default()).as_bytes());
        let payment_hash = format!("{:x}", hasher.finalize());
        let invoice = format!("lnbc{}u1p3k2v5cpp5{}", amount_sats, payment_hash);
        Ok((invoice, payment_hash))
    }

    pub async fn send_payment(&self, invoice: String) -> Result<(String, String)> {
        // Mock payment processing
        if !invoice.starts_with("lnbc") {
            return Err(anyhow::anyhow!("Invalid Lightning invoice format"));
        }
        
        let mut hasher = Sha256::new();
        hasher.update(invoice.as_bytes());
        let payment_hash = format!("{:x}", hasher.finalize());
        let status = "SUCCEEDED".to_string();
        Ok((payment_hash, status))
    }

    pub async fn balances(&self) -> Result<(u64, u64)> {
        // Mock balances - return some test values
        let onchain = 1000000; // 1M sats
        let ln = 500000; // 500K sats
        Ok((onchain, ln))
    }

    pub fn new_address(&self) -> Result<String> {
        // Generate a mock Bitcoin address
        let mut hasher = Sha256::new();
        hasher.update(self.mnemonic.as_bytes());
        let hash = hasher.finalize();
        let address = format!("tb1q{}", hex::encode(&hash[..20]));
        Ok(address)
    }

    // Multi-peer management methods
    pub async fn add_peer(&self, node_id: String, address: String) -> Result<()> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let peer = PeerNode {
            node_id: node_id.clone(),
            address,
            is_online: true,
            last_seen: now,
            connection_attempts: 0,
            success_rate: 1.0,
        };
        
        let mut peers = self.peers.write().await;
        peers.insert(node_id, peer);
        Ok(())
    }

    pub async fn remove_peer(&self, node_id: &str) -> Result<()> {
        let mut peers = self.peers.write().await;
        peers.remove(node_id);
        Ok(())
    }

    pub async fn get_peers(&self) -> Vec<PeerNode> {
        let peers = self.peers.read().await;
        peers.values().cloned().collect()
    }

    pub async fn set_primary_peer(&self, node_id: Option<String>) -> Result<()> {
        let mut primary = self.primary_peer.write().await;
        *primary = node_id;
        Ok(())
    }

    pub async fn get_primary_peer(&self) -> Option<String> {
        let primary = self.primary_peer.read().await;
        primary.clone()
    }

    // Health monitoring methods
    pub async fn check_health(&self) -> HealthStatus {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        let mut health = self.health.write().await;
        health.last_check = now;
        
        // Check if we have any online peers
        let peers = self.peers.read().await;
        let has_online_peers = peers.values().any(|peer| peer.is_online);
        
        health.is_healthy = has_online_peers;
        
        if !health.is_healthy {
            health.error_count += 1;
            health.last_error = Some("No online peers available".to_string());
        }
        
        health.clone()
    }

    pub async fn update_peer_status(&self, node_id: &str, is_online: bool) -> Result<()> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let mut peers = self.peers.write().await;
        
        if let Some(peer) = peers.get_mut(node_id) {
            peer.is_online = is_online;
            peer.last_seen = now;
            
            if is_online {
                peer.connection_attempts = 0;
                peer.success_rate = (peer.success_rate * 0.9) + 0.1; // Moving average
            } else {
                peer.connection_attempts += 1;
                peer.success_rate = peer.success_rate * 0.9; // Decrease success rate
            }
        }
        
        Ok(())
    }

    // Failover methods
    pub async fn get_best_peer(&self) -> Option<String> {
        let peers = self.peers.read().await;
        let online_peers: Vec<_> = peers
            .iter()
            .filter(|(_, peer)| peer.is_online)
            .collect();
        
        if online_peers.is_empty() {
            return None;
        }
        
        // Return the peer with the highest success rate
        online_peers
            .iter()
            .max_by(|a, b| a.1.success_rate.partial_cmp(&b.1.success_rate).unwrap())
            .map(|(node_id, _)| node_id.clone())
    }

    pub async fn failover_to_next_peer(&self) -> Result<Option<String>> {
        let best_peer = self.get_best_peer().await;
        
        if let Some(peer_id) = best_peer {
            self.set_primary_peer(Some(peer_id.clone())).await?;
            Ok(Some(peer_id))
        } else {
            self.set_primary_peer(None).await?;
            Ok(None)
        }
    }

    // Enhanced payment methods with failover
    pub async fn send_payment_with_failover(&self, invoice: String) -> Result<(String, String)> {
        let mut last_error = None;
        
        // Try primary peer first
        if let Some(primary) = self.get_primary_peer().await {
            match self.send_payment_to_peer(&primary, &invoice).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    last_error = Some(e);
                    self.update_peer_status(&primary, false).await?;
                }
            }
        }
        
        // Try other peers
        let peers = self.get_peers().await;
        for peer in peers {
            if peer.is_online {
                match self.send_payment_to_peer(&peer.node_id, &invoice).await {
                    Ok(result) => {
                        self.set_primary_peer(Some(peer.node_id)).await?;
                        return Ok(result);
                    }
                    Err(e) => {
                        last_error = Some(e);
                        self.update_peer_status(&peer.node_id, false).await?;
                    }
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("All peers failed")))
    }

    async fn send_payment_to_peer(&self, peer_id: &str, invoice: &str) -> Result<(String, String)> {
        // Mock payment processing with peer
        if !invoice.starts_with("lnbc") {
            return Err(anyhow::anyhow!("Invalid Lightning invoice format"));
        }
        
        // Simulate network delay
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}", peer_id, invoice).as_bytes());
        let payment_hash = format!("{:x}", hasher.finalize());
        let status = "SUCCEEDED".to_string();
        
        // Update peer success rate
        self.update_peer_status(peer_id, true).await?;
        
        Ok((payment_hash, status))
    }

    // Persistence methods
    pub async fn persist_peers(&self) -> Result<()> {
        let peers = self.peers.read().await;
        let peers_json = serde_json::to_string_pretty(&*peers)?;
        let peers_file = self.state_file.with_extension("peers.json");
        fs::write(peers_file, peers_json)?;
        Ok(())
    }

    pub async fn load_peers(&self) -> Result<()> {
        let peers_file = self.state_file.with_extension("peers.json");
        if peers_file.exists() {
            let content = fs::read_to_string(peers_file)?;
            let peers: HashMap<String, PeerNode> = serde_json::from_str(&content)?;
            let mut current_peers = self.peers.write().await;
            *current_peers = peers;
        }
        Ok(())
    }
}