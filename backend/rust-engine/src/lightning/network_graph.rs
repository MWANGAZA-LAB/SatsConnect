use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Network graph for Lightning Network topology
#[derive(Debug, Clone)]
pub struct NetworkGraph {
    nodes: HashMap<String, NodeInfo>,
    channels: HashMap<String, NetworkChannelInfo>,
}

/// Information about a Lightning Network node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    pub node_id: String,
    pub alias: Option<String>,
    pub color: Option<String>,
    pub last_seen: u64,
    pub features: Vec<u32>,
    pub addresses: Vec<String>,
}

/// Information about a Lightning Network channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkChannelInfo {
    pub channel_id: String,
    pub node1: String,
    pub node2: String,
    pub capacity_sat: u64,
    pub is_enabled: bool,
    pub last_update: u64,
    pub base_fee_msat: u32,
    pub fee_rate_ppm: u32,
}

impl NetworkGraph {
    /// Create a new network graph
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            channels: HashMap::new(),
        }
    }

    /// Add a node to the network graph
    pub fn add_node(&mut self, node_info: NodeInfo) {
        self.nodes.insert(node_info.node_id.clone(), node_info);
    }

    /// Add a channel to the network graph
    pub fn add_channel(&mut self, channel_info: NetworkChannelInfo) {
        self.channels
            .insert(channel_info.channel_id.clone(), channel_info);
    }

    /// Get node information
    pub fn get_node(&self, node_id: &str) -> Option<&NodeInfo> {
        self.nodes.get(node_id)
    }

    /// Get channel information
    pub fn get_channel(&self, channel_id: &str) -> Option<&NetworkChannelInfo> {
        self.channels.get(channel_id)
    }

    /// Get all nodes
    pub fn get_all_nodes(&self) -> Vec<&NodeInfo> {
        self.nodes.values().collect()
    }

    /// Get all channels
    pub fn get_all_channels(&self) -> Vec<&NetworkChannelInfo> {
        self.channels.values().collect()
    }

    /// Get channels for a specific node
    pub fn get_node_channels(&self, node_id: &str) -> Vec<&NetworkChannelInfo> {
        self.channels
            .values()
            .filter(|ch| ch.node1 == node_id || ch.node2 == node_id)
            .collect()
    }

    /// Get enabled channels only
    pub fn get_enabled_channels(&self) -> Vec<&NetworkChannelInfo> {
        self.channels.values().filter(|ch| ch.is_enabled).collect()
    }

    /// Update channel information
    pub fn update_channel(
        &mut self,
        channel_id: &str,
        updates: ChannelUpdate,
    ) -> Result<(), String> {
        if let Some(channel) = self.channels.get_mut(channel_id) {
            if let Some(is_enabled) = updates.is_enabled {
                channel.is_enabled = is_enabled;
            }
            if let Some(base_fee_msat) = updates.base_fee_msat {
                channel.base_fee_msat = base_fee_msat;
            }
            if let Some(fee_rate_ppm) = updates.fee_rate_ppm {
                channel.fee_rate_ppm = fee_rate_ppm;
            }
            channel.last_update = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            Ok(())
        } else {
            Err("Channel not found".to_string())
        }
    }

    /// Find shortest path between two nodes
    pub fn find_shortest_path(&self, from: &str, to: &str) -> Option<Vec<String>> {
        // Simple BFS implementation for path finding
        use std::collections::{HashSet, VecDeque};

        if from == to {
            return Some(vec![from.to_string()]);
        }

        let mut queue = VecDeque::new();
        let mut visited = HashSet::new();
        let mut parent = HashMap::new();

        queue.push_back(from.to_string());
        visited.insert(from.to_string());

        while let Some(current) = queue.pop_front() {
            if current == to {
                // Reconstruct path
                let mut path = Vec::new();
                let mut node = to.to_string();
                while let Some(p) = parent.get(&node) {
                    path.push(node);
                    node = p.clone();
                }
                path.push(from.to_string());
                path.reverse();
                return Some(path);
            }

            // Get all channels for current node
            for channel in self.get_node_channels(&current) {
                let next_node = if channel.node1 == current {
                    &channel.node2
                } else {
                    &channel.node1
                };

                if !visited.contains(next_node) && channel.is_enabled {
                    visited.insert(next_node.clone());
                    parent.insert(next_node.clone(), current.clone());
                    queue.push_back(next_node.clone());
                }
            }
        }

        None
    }

    /// Get network statistics
    pub fn get_network_stats(&self) -> NetworkStats {
        let total_nodes = self.nodes.len();
        let total_channels = self.channels.len();
        let enabled_channels = self.get_enabled_channels().len();
        let total_capacity: u64 = self.channels.values().map(|ch| ch.capacity_sat).sum();

        NetworkStats {
            total_nodes,
            total_channels,
            enabled_channels,
            total_capacity_sat: total_capacity,
        }
    }
}

/// Channel update information
#[derive(Debug, Clone)]
pub struct ChannelUpdate {
    pub is_enabled: Option<bool>,
    pub base_fee_msat: Option<u32>,
    pub fee_rate_ppm: Option<u32>,
}

/// Network statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStats {
    pub total_nodes: usize,
    pub total_channels: usize,
    pub enabled_channels: usize,
    pub total_capacity_sat: u64,
}

impl Default for NetworkGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_graph_creation() {
        let graph = NetworkGraph::new();
        assert_eq!(graph.get_all_nodes().len(), 0);
        assert_eq!(graph.get_all_channels().len(), 0);
    }

    #[test]
    fn test_add_node_and_channel() {
        let mut graph = NetworkGraph::new();

        let node1 = NodeInfo {
            node_id: "node1".to_string(),
            alias: Some("Alice".to_string()),
            color: Some("#FF0000".to_string()),
            last_seen: 1234567890,
            features: vec![1, 2, 3],
            addresses: vec!["1.2.3.4:9735".to_string()],
        };

        let node2 = NodeInfo {
            node_id: "node2".to_string(),
            alias: Some("Bob".to_string()),
            color: Some("#00FF00".to_string()),
            last_seen: 1234567890,
            features: vec![1, 2, 3],
            addresses: vec!["5.6.7.8:9735".to_string()],
        };

        graph.add_node(node1);
        graph.add_node(node2);

        let channel = NetworkChannelInfo {
            channel_id: "channel1".to_string(),
            node1: "node1".to_string(),
            node2: "node2".to_string(),
            capacity_sat: 1000000,
            is_enabled: true,
            last_update: 1234567890,
            base_fee_msat: 1000,
            fee_rate_ppm: 1,
        };

        graph.add_channel(channel);

        assert_eq!(graph.get_all_nodes().len(), 2);
        assert_eq!(graph.get_all_channels().len(), 1);
        assert_eq!(graph.get_node_channels("node1").len(), 1);
    }

    #[test]
    fn test_find_shortest_path() {
        let mut graph = NetworkGraph::new();

        // Add nodes
        graph.add_node(NodeInfo {
            node_id: "A".to_string(),
            alias: None,
            color: None,
            last_seen: 0,
            features: vec![],
            addresses: vec![],
        });

        graph.add_node(NodeInfo {
            node_id: "B".to_string(),
            alias: None,
            color: None,
            last_seen: 0,
            features: vec![],
            addresses: vec![],
        });

        graph.add_node(NodeInfo {
            node_id: "C".to_string(),
            alias: None,
            color: None,
            last_seen: 0,
            features: vec![],
            addresses: vec![],
        });

        // Add channels
        graph.add_channel(NetworkChannelInfo {
            channel_id: "AB".to_string(),
            node1: "A".to_string(),
            node2: "B".to_string(),
            capacity_sat: 1000000,
            is_enabled: true,
            last_update: 0,
            base_fee_msat: 1000,
            fee_rate_ppm: 1,
        });

        graph.add_channel(NetworkChannelInfo {
            channel_id: "BC".to_string(),
            node1: "B".to_string(),
            node2: "C".to_string(),
            capacity_sat: 1000000,
            is_enabled: true,
            last_update: 0,
            base_fee_msat: 1000,
            fee_rate_ppm: 1,
        });

        let path = graph.find_shortest_path("A", "C");
        assert!(path.is_some());
        assert_eq!(path.unwrap(), vec!["A", "B", "C"]);
    }
}
