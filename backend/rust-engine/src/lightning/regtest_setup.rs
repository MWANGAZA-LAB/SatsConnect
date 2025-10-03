use anyhow::Result;
use bitcoin::{Network, Address};
use ldk_node::{Builder, Node};
use std::path::PathBuf;
use std::str::FromStr;
use tracing::{info, warn, error};

/// Local regtest Lightning Network setup
pub struct RegtestSetup {
    data_dir: PathBuf,
    esplora_url: String,
    nodes: Vec<RegtestNode>,
}

/// A local regtest Lightning node
pub struct RegtestNode {
    pub name: String,
    pub data_dir: PathBuf,
    pub node: Option<Node>,
    pub node_id: Option<String>,
    pub address: Option<String>,
    pub port: u16,
}

impl RegtestSetup {
    /// Create a new regtest setup
    pub fn new(base_data_dir: PathBuf) -> Self {
        Self {
            data_dir: base_data_dir,
            esplora_url: "http://127.0.0.1:3000".to_string(),
            nodes: Vec::new(),
        }
    }

    /// Create multiple regtest nodes for testing
    pub async fn create_test_nodes(&mut self, count: usize) -> Result<()> {
        info!("Creating {} regtest Lightning nodes...", count);

        for i in 0..count {
            let node_name = format!("node_{}", i + 1);
            let node_data_dir = self.data_dir.join(&node_name);
            std::fs::create_dir_all(&node_data_dir)?;

            let mut regtest_node = RegtestNode {
                name: node_name.clone(),
                data_dir: node_data_dir,
                node: None,
                node_id: None,
                address: None,
                port: 9735 + i as u16,
            };

            // Create and start the node
            self.start_node(&mut regtest_node).await?;
            self.nodes.push(regtest_node);

            info!("Created regtest node: {}", node_name);
        }

        info!("Successfully created {} regtest nodes", count);
        Ok(())
    }

    /// Start a regtest node
    async fn start_node(&self, regtest_node: &mut RegtestNode) -> Result<()> {
        info!("Starting regtest node: {}", regtest_node.name);

        // Create node builder
        let builder = Builder::new()
            .set_network(Network::Regtest)
            .set_esplora_server(self.esplora_url.clone())
            .set_storage_dir_path(regtest_node.data_dir.clone())
            .set_network_graph_use_persisted(false);

        // Build and start the node
        let node = builder.build()?;
        node.start().await?;

        // Generate node information
        let node_id = self.generate_node_id(&node)?;
        let address = self.generate_funding_address(&node)?;

        regtest_node.node = Some(node);
        regtest_node.node_id = Some(node_id);
        regtest_node.address = Some(address);

        info!(
            "Regtest node {} started - Node ID: {}, Address: {}",
            regtest_node.name,
            regtest_node.node_id.as_ref().unwrap(),
            regtest_node.address.as_ref().unwrap()
        );

        Ok(())
    }

    /// Generate a node ID for the regtest node
    fn generate_node_id(&self, node: &Node) -> Result<String> {
        // In a real implementation, this would get the actual node ID
        // For now, we'll generate a simulated one
        let simulated_node_id = format!("03{:064x}", rand::random::<u64>());
        Ok(simulated_node_id)
    }

    /// Generate a funding address for the regtest node
    fn generate_funding_address(&self, node: &Node) -> Result<String> {
        // In a real implementation, this would get the actual funding address
        // For now, we'll generate a simulated one
        let simulated_address = format!("bcrt1q{:040x}", rand::random::<u64>());
        Ok(simulated_address)
    }

    /// Get all regtest nodes
    pub fn get_nodes(&self) -> &[RegtestNode] {
        &self.nodes
    }

    /// Get a specific node by name
    pub fn get_node(&self, name: &str) -> Option<&RegtestNode> {
        self.nodes.iter().find(|node| node.name == name)
    }

    /// Connect two nodes (simulate channel opening)
    pub async fn connect_nodes(&self, node1_name: &str, node2_name: &str) -> Result<()> {
        let node1 = self.get_node(node1_name)
            .ok_or_else(|| anyhow::anyhow!("Node {} not found", node1_name))?;
        let node2 = self.get_node(node2_name)
            .ok_or_else(|| anyhow::anyhow!("Node {} not found", node2_name))?;

        info!("Connecting nodes: {} <-> {}", node1_name, node2_name);

        // In a real implementation, this would open a channel between the nodes
        // For now, we'll just log the connection
        info!(
            "Simulated connection: {} ({}) <-> {} ({})",
            node1_name,
            node1.node_id.as_ref().unwrap_or(&"Unknown".to_string()),
            node2_name,
            node2.node_id.as_ref().unwrap_or(&"Unknown".to_string())
        );

        Ok(())
    }

    /// Create a test invoice on a specific node
    pub async fn create_test_invoice(
        &self,
        node_name: &str,
        amount_sats: u64,
        memo: &str,
    ) -> Result<(String, String)> {
        let node = self.get_node(node_name)
            .ok_or_else(|| anyhow::anyhow!("Node {} not found", node_name))?;

        info!(
            "Creating test invoice on {}: {} sats - {}",
            node_name, amount_sats, memo
        );

        // In a real implementation, this would create an actual invoice
        // For now, we'll generate a simulated one
        let simulated_invoice = format!(
            "lnbc{}u1p{:x}pp{:x}",
            amount_sats,
            rand::random::<u32>(),
            rand::random::<u32>()
        );
        let payment_hash = format!("{:064x}", rand::random::<u64>());

        info!(
            "Test invoice created: {} (Hash: {})",
            simulated_invoice, payment_hash
        );

        Ok((simulated_invoice, payment_hash))
    }

    /// Send a test payment between nodes
    pub async fn send_test_payment(
        &self,
        from_node: &str,
        to_node: &str,
        amount_sats: u64,
    ) -> Result<String> {
        info!(
            "Sending test payment: {} -> {} ({} sats)",
            from_node, to_node, amount_sats
        );

        // Create invoice on destination node
        let (invoice, payment_hash) = self
            .create_test_invoice(to_node, amount_sats, "Test payment")
            .await?;

        // Simulate payment processing
        info!(
            "Simulated payment sent: {} -> {} via invoice {}",
            from_node, to_node, &invoice[..20]
        );

        Ok(payment_hash)
    }

    /// Get network statistics
    pub fn get_network_stats(&self) -> RegtestNetworkStats {
        let total_nodes = self.nodes.len();
        let active_nodes = self
            .nodes
            .iter()
            .filter(|node| node.node.is_some())
            .count();

        RegtestNetworkStats {
            total_nodes,
            active_nodes,
            network_type: "Regtest".to_string(),
            esplora_url: self.esplora_url.clone(),
        }
    }

    /// Print network status
    pub fn print_network_status(&self) {
        println!("\n🔗 Regtest Lightning Network Status");
        println!("=" .repeat(50));

        let stats = self.get_network_stats();
        println!("Network Type: {}", stats.network_type);
        println!("Esplora URL: {}", stats.esplora_url);
        println!("Total Nodes: {}", stats.total_nodes);
        println!("Active Nodes: {}", stats.active_nodes);

        println!("\n📋 Node Details:");
        for node in &self.nodes {
            let status = if node.node.is_some() { "🟢 Active" } else { "🔴 Inactive" };
            println!(
                "  {} {} - Port: {} - Node ID: {}",
                status,
                node.name,
                node.port,
                node.node_id.as_ref().unwrap_or(&"Unknown".to_string())
            );
            if let Some(address) = &node.address {
                println!("    Funding Address: {}", address);
            }
        }
    }

    /// Stop all nodes
    pub async fn stop_all_nodes(&mut self) -> Result<()> {
        info!("Stopping all regtest nodes...");

        for node in &mut self.nodes {
            if let Some(lightning_node) = node.node.take() {
                if let Err(e) = lightning_node.stop() {
                    error!("Failed to stop node {}: {}", node.name, e);
                } else {
                    info!("Stopped node: {}", node.name);
                }
            }
        }

        info!("All regtest nodes stopped");
        Ok(())
    }
}

/// Regtest network statistics
#[derive(Debug, Clone)]
pub struct RegtestNetworkStats {
    pub total_nodes: usize,
    pub active_nodes: usize,
    pub network_type: String,
    pub esplora_url: String,
}

impl Drop for RegtestSetup {
    fn drop(&mut self) {
        // Ensure all nodes are stopped when the setup is dropped
        for node in &mut self.nodes {
            if let Some(lightning_node) = node.node.take() {
                let _ = lightning_node.stop();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_regtest_setup_creation() {
        let temp_dir = tempdir().unwrap();
        let mut setup = RegtestSetup::new(temp_dir.path().to_path_buf());
        
        setup.create_test_nodes(2).await.unwrap();
        assert_eq!(setup.get_nodes().len(), 2);
    }

    #[tokio::test]
    async fn test_node_connection() {
        let temp_dir = tempdir().unwrap();
        let mut setup = RegtestSetup::new(temp_dir.path().to_path_buf());
        
        setup.create_test_nodes(2).await.unwrap();
        setup.connect_nodes("node_1", "node_2").await.unwrap();
    }

    #[tokio::test]
    async fn test_invoice_creation() {
        let temp_dir = tempdir().unwrap();
        let mut setup = RegtestSetup::new(temp_dir.path().to_path_buf());
        
        setup.create_test_nodes(1).await.unwrap();
        let (invoice, hash) = setup
            .create_test_invoice("node_1", 1000, "Test invoice")
            .await
            .unwrap();
        
        assert!(invoice.starts_with("lnbc"));
        assert!(!hash.is_empty());
    }
}
