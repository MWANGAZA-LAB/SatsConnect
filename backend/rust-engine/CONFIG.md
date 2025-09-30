# SatsConnect Lightning Engine Configuration

## Environment Variables

The Lightning Engine can be configured using the following environment variables:

### Network Configuration
- `BITCOIN_NETWORK`: Bitcoin network to use (`mainnet`, `testnet`, `regtest`, `signet`)
- `DATA_DIR`: Data directory for Lightning node storage
- `ESPLORA_URL`: Esplora server URL for blockchain data

### Bitcoin Core RPC Configuration
- `BITCOIN_RPC_URL`: Bitcoin Core RPC server URL
- `BITCOIN_RPC_USER`: Bitcoin Core RPC username
- `BITCOIN_RPC_PASS`: Bitcoin Core RPC password
- `BITCOIN_WALLET_NAME`: Bitcoin Core wallet name

### Lightning Node Configuration
- `LIGHTNING_CHANNEL_CONFIRMATION_TIMEOUT`: Channel confirmation timeout in blocks
- `LIGHTNING_MAX_CHANNEL_SIZE`: Maximum channel size in sats
- `LIGHTNING_MIN_CHANNEL_SIZE`: Minimum channel size in sats
- `LIGHTNING_CHANNEL_RESERVE`: Channel reserve amount in sats
- `LIGHTNING_ANNOUNCE_CHANNELS`: Whether to announce channels
- `LIGHTNING_ACCEPT_INCOMING_CHANNELS`: Whether to accept incoming channels

### Server Configuration
- `GRPC_SERVER_ADDRESS`: gRPC server address
- `RUST_LOG`: Logging level
- `RUST_LOG_STYLE`: Logging style

## Example Configuration

```bash
# Network Configuration
export BITCOIN_NETWORK=testnet
export DATA_DIR=./data
export ESPLORA_URL=https://blockstream.info/testnet/api

# Bitcoin Core RPC Configuration
export BITCOIN_RPC_URL=http://127.0.0.1:18332
export BITCOIN_RPC_USER=user
export BITCOIN_RPC_PASS=password
export BITCOIN_WALLET_NAME=satsconnect

# Lightning Node Configuration
export LIGHTNING_CHANNEL_CONFIRMATION_TIMEOUT=6
export LIGHTNING_MAX_CHANNEL_SIZE=10000000
export LIGHTNING_MIN_CHANNEL_SIZE=100000
export LIGHTNING_CHANNEL_RESERVE=10000
export LIGHTNING_ANNOUNCE_CHANNELS=true
export LIGHTNING_ACCEPT_INCOMING_CHANNELS=true

# Server Configuration
export GRPC_SERVER_ADDRESS=127.0.0.1:50051
export RUST_LOG=info
export RUST_LOG_STYLE=auto
```

## Configuration File

You can also create a `config.json` file in the data directory:

```json
{
  "network": "testnet",
  "data_dir": "./data",
  "esplora_url": "https://blockstream.info/testnet/api",
  "use_ldk_gossip": true,
  "persist_network_graph": false,
  "bitcoin_rpc": {
    "url": "http://127.0.0.1:18332",
    "username": "user",
    "password": "password",
    "wallet_name": "satsconnect"
  },
  "lightning_node": {
    "channel_confirmation_timeout": 6,
    "max_channel_size": 10000000,
    "min_channel_size": 100000,
    "channel_reserve": 10000,
    "announce_channels": true,
    "accept_incoming_channels": true
  }
}
```

## Network-Specific Defaults

### Mainnet
- Esplora URL: `https://blockstream.info/api`
- Bitcoin Core RPC: `http://127.0.0.1:8332`
- Derivation Path: `m/84'/0'/0'/0/0`

### Testnet
- Esplora URL: `https://blockstream.info/testnet/api`
- Bitcoin Core RPC: `http://127.0.0.1:18332`
- Derivation Path: `m/84'/1'/0'/0/0`

### Regtest
- Esplora URL: `http://127.0.0.1:3000`
- Bitcoin Core RPC: `http://127.0.0.1:18443`
- Derivation Path: `m/84'/1'/0'/0/0`

### Signet
- Esplora URL: `https://blockstream.info/signet/api`
- Bitcoin Core RPC: `http://127.0.0.1:38332`
- Derivation Path: `m/84'/1'/0'/0/0`

## Security Considerations

1. **Never commit real credentials** to version control
2. **Use environment variables** for sensitive data
3. **Validate configuration** before starting the node
4. **Use secure RPC credentials** for Bitcoin Core
5. **Backup wallet data** regularly
6. **Use testnet** for development and testing

## Troubleshooting

### Common Issues

1. **Connection refused**: Check Bitcoin Core RPC configuration
2. **Invalid network**: Ensure network configuration matches Bitcoin Core
3. **Permission denied**: Check data directory permissions
4. **Invalid mnemonic**: Ensure mnemonic is valid BIP39 format

### Debug Mode

Enable debug logging:
```bash
export RUST_LOG=debug
```

### Validation

The configuration is automatically validated on startup. Check logs for validation errors.
