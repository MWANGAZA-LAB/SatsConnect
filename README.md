# SatsConnect – Step One: Lightning Core Infrastructure

Monorepo with Rust Lightning engine (LDK), Node orchestrator, and React Native client.

## Directory Structure

```
backend/
  rust-engine/          # Rust gRPC server wrapping LDK Node
  node-orchestrator/    # REST API bridging to Rust via gRPC
mobile/                 # React Native app (Expo)
```

## Prerequisites
- Rust toolchain (stable), protoc
- Node.js >= 18, pnpm or npm
- Android Studio / Xcode for mobile
- For testnet: public Electrum/Esplora is set. For regtest: you must run a local Bitcoin + LND/LDK peers.

## Rust Engine

Build and run the gRPC server:
```bash
cd backend/rust-engine
cargo build
cargo run --bin engine_server
```
The server listens on `127.0.0.1:50051`.

Network:
- Default compiled with `testnet` feature in `Cargo.toml`. To use regtest:
```bash
cargo run --no-default-features --features regtest --bin engine_server
```

Funding:
- Get testnet coins to the address returned by `/wallet/create`.
- For regtest, generate blocks and send coins to the address.

## Node Orchestrator (REST)

```bash
cd backend/node-orchestrator
npm install
npm run dev
```
Environment:
- `RUST_ENGINE_ADDR` (default `127.0.0.1:50051`)

Routes:
- POST `/wallet/create` { mnemonic?, label? }
- GET `/wallet/balance`
- POST `/invoice/new` { amount_sats, memo? }
- POST `/payment/send` { invoice }

## Mobile App (Expo)

```bash
cd mobile
npm install
npm run start
```
Configure API base:
- Set `EXPO_PUBLIC_API_BASE` to your machine IP (Android emulator uses `http://10.0.2.2:4000`).

Screens:
- Onboarding: create wallet and shows seed phrase (backup it!)
- Home: displays on-chain and Lightning balances
- Send: pay a BOLT11 invoice
- Receive: create invoice and show QR code
- History: placeholder

## Test Flow
1. Start Rust engine.
2. Start Node orchestrator.
3. Launch mobile app.
4. Create wallet on mobile; fund the on-chain address (testnet faucet).
5. Generate invoice in app; pay from external wallet (Phoenix/Breez).
6. Pay invoice from app; confirm external wallet receives sats.
7. Check balances update.

## Notes
- State is stored under the OS data dir as JSON plus LDK SQLite for channel state.
- This is non-custodial; keep the mnemonic secure.
