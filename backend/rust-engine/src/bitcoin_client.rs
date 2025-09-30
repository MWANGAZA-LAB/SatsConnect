use anyhow::Result;
use bitcoin::{Network, Address, Txid, Transaction, BlockHash};
use bitcoincore_rpc::{Client, RpcApi};
use bitcoincore_rpc_json::{GetBlockchainInfoResult, GetNetworkInfoResult, GetWalletInfoResult};
use std::sync::Arc;
use std::str::FromStr;
use tokio::sync::RwLock;
use tracing::{info, error, warn};

/// Bitcoin Core RPC Client for SatsConnect
/// Handles all on-chain Bitcoin operations including wallet management,
/// transaction broadcasting, and balance queries.
pub struct BitcoinClient {
    client: Arc<RwLock<Option<Client>>>,
    network: Network,
    rpc_url: String,
    rpc_user: String,
    rpc_password: String,
}

impl BitcoinClient {
    /// Create a new Bitcoin Core client
    pub fn new(
        network: Network,
        rpc_url: String,
        rpc_user: String,
        rpc_password: String,
    ) -> Self {
        Self {
            client: Arc::new(RwLock::new(None)),
            network,
            rpc_url,
            rpc_user,
            rpc_password,
        }
    }

    /// Initialize connection to Bitcoin Core
    pub async fn initialize(&self) -> Result<()> {
        info!("Initializing Bitcoin Core client for network: {:?}", self.network);
        
        // Create RPC client
        let client = Client::new(&self.rpc_url, &self.rpc_user, &self.rpc_password)?;
        
        // Test connection
        let _info = client.get_blockchain_info()?;
        info!("Bitcoin Core connection established successfully");
        
        // Store the client
        let mut client_guard = self.client.write().await;
        *client_guard = Some(client);
        
        Ok(())
    }

    /// Get blockchain information
    pub async fn get_blockchain_info(&self) -> Result<GetBlockchainInfoResult> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.get_blockchain_info()?)
    }

    /// Get network information
    pub async fn get_network_info(&self) -> Result<GetNetworkInfoResult> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.get_network_info()?)
    }

    /// Get wallet information
    pub async fn get_wallet_info(&self) -> Result<GetWalletInfoResult> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.get_wallet_info()?)
    }

    /// Get balance for a specific address
    pub async fn get_address_balance(&self, address: &str) -> Result<f64> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        // Parse address
        let addr = Address::from_str(address)?.require_network(self.network)?;
        
        // Get unspent outputs for the address
        let utxos = client.list_unspent(Some(0), None, Some(&[addr]))?;
        
        // Calculate total balance
        let balance: f64 = utxos.iter().map(|utxo| utxo.amount).sum();
        
        info!("Address {} balance: {} BTC", address, balance);
        Ok(balance)
    }

    /// Generate a new address
    pub async fn generate_address(&self, label: Option<&str>) -> Result<String> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        // Generate a new address
        let address = client.get_new_address(label)?;
        
        info!("Generated new address: {}", address);
        Ok(address.to_string())
    }

    /// Send Bitcoin to an address
    pub async fn send_to_address(
        &self,
        address: &str,
        amount: f64,
        comment: Option<&str>,
    ) -> Result<Txid> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        // Parse address
        let addr = Address::from_str(address)?.require_network(self.network)?;
        
        // Send transaction
        let txid = client.send_to_address(&addr, amount, comment, None, false)?;
        
        info!("Sent {} BTC to {} - TXID: {}", amount, address, txid);
        Ok(txid)
    }

    /// Get transaction by ID
    pub async fn get_transaction(&self, txid: &Txid) -> Result<Transaction> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.get_transaction(txid, None)?.transaction)
    }

    /// Get raw transaction by ID
    pub async fn get_raw_transaction(&self, txid: &Txid) -> Result<Transaction> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.get_raw_transaction(txid, None)?)
    }

    /// Get block hash by height
    pub async fn get_block_hash(&self, height: u64) -> Result<BlockHash> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.get_block_hash(height)?)
    }

    /// Get block by hash
    pub async fn get_block(&self, hash: &BlockHash) -> Result<bitcoin::Block> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.get_block(hash)?)
    }

    /// Estimate transaction fee
    pub async fn estimate_fee(&self, blocks: u16) -> Result<f64> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.estimate_smart_fee(blocks, None)?.fee_rate.unwrap_or_default().to_btc())
    }

    /// Get mempool information
    pub async fn get_mempool_info(&self) -> Result<bitcoincore_rpc_json::GetMempoolInfoResult> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.get_mempool_info()?)
    }

    /// List unspent outputs
    pub async fn list_unspent(
        &self,
        minconf: Option<u32>,
        maxconf: Option<u32>,
        addresses: Option<&[Address]>,
    ) -> Result<Vec<bitcoincore_rpc_json::ListUnspentResultEntry>> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Bitcoin Core client not initialized"))?;
        
        Ok(client.list_unspent(minconf, maxconf, addresses)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_bitcoin_client_creation() {
        let client = BitcoinClient::new(
            Network::Regtest,
            "http://127.0.0.1:18443".to_string(),
            "user".to_string(),
            "password".to_string(),
        );
        
        // Test that the client can be created
        assert!(client.client.read().await.is_none());
    }
}
