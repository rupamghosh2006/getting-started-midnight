# 1AM Private Proof

**1AM Private Proof** is a Midnight DApp that lets a user prove knowledge of a private access phrase without publishing the phrase, their identity, or a recoverable secret on-chain. The browser UI connects to **Lace on Midnight Preprod**, supports a wallet-provided circuit submission flow, and shows only a public proof receipt.

## Links

- Live demo: [https://1am-private-proof.vercel.app](https://1am-private-proof.vercel.app)
- Preprod deployment: [`c456ed849e1e2be80e8e571ec1a8830ef98d87c324659a0ba44aded5361dbc8d`](https://explorer.1am.xyz/tx/6581c87b19eb8ef8357b6d0ad7a96e0981d0f5051f1bbdb1cd4649f056da3b4f?network=preprod)
- Demo video: [Watch on YouTube](https://youtu.be/WBN1WQ87dzY)

## What it does

1. Connect a Lace wallet (or 1AM wallet) to Midnight Preprod.
2. Enter the private proof input in the DApp.
3. Call the `provePrivateKnowledge` Compact circuit.
4. Receive an on-chain confirmation while the private input remains outside public ledger state.
5. Disconnect the wallet; the app clears the private form input from the UI.

## Privacy claim

The circuit accepts a private `Bytes<21>` input and verifies it against the proof predicate. The secret itself is **not stored in public ledger state** and is not shown in the transaction receipt.

The only public outputs are:

- `latestProofAccepted` — whether the latest proof was accepted.
- `successfulProofs` — a counter of accepted proofs.

This makes the privacy behavior observable: anyone can verify that a valid proof was accepted, but they cannot see the access phrase supplied to produce it. The current predicate is intentionally a demonstration; a production system should use a credential or commitment-based predicate.

## Preprod contract

| Item | Value |
| --- | --- |
| Network | Midnight Preprod |
| Contract address | `c456ed849e1e2be80e8e571ec1a8830ef98d87c324659a0ba44aded5361dbc8d` |
| Deployment transaction | [`6581c87b…056da3b4f`](https://explorer.1am.xyz/tx/6581c87b19eb8ef8357b6d0ad7a96e0981d0f5051f1bbdb1cd4649f056da3b4f?network=preprod) |

Verify the recorded deployment and current public receipt with:

```bash
npm run verify:preprod
```

## Lace wallet flow

The frontend detects Lace's Midnight connector and requests access through the connector API. When connected, the dashboard displays the wallet state and enables proof actions. The Disconnect control clears the local session and private input from the application UI.

For best results, install Lace with Midnight support, switch it to **Preprod**, allow the extension access to the demo site, then reload the page.

## Run locally

### Prerequisites

- Node.js 22+
- Lace wallet with Midnight Preprod enabled (for browser wallet testing)
- Docker with Compose v2 (for the local contract/proof-server workflow)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, then connect Lace and choose the Preprod flow.

### Contract tooling

From the repository root:

```bash
npm install
npm run compile
npm run verify:preprod
```

To start a local Midnight development environment and deploy locally:

```bash
npm run setup
```

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run compile` | Compile the Compact contract and generate proving artifacts. |
| `npm run verify:preprod` | Read the public Preprod indexer and verify the recorded deployment. |
| `npm run setup` | Start local services, compile, and deploy to the local devnet. |
| `npm run test:e2e` | Run the local end-to-end smoke test. |
| `npm run web:dev` | Start the browser frontend. |
| `npm run web:build` | Build the frontend with its ZK artifacts. |

## Project structure

```text
contracts/hello-world.compact    Compact circuit and public receipt ledger
frontend/                        Browser DApp with Lace/1AM wallet controls
frontend/lib/midnight-client.ts  Wallet connector and circuit-call integration
src/verify-preprod.ts            Public Preprod deployment verifier
deployed-contracts.json          Recorded deployment address and transaction
```

## Level 2 checklist

- [x] Lace wallet connect and disconnect controls
- [x] Circuit call from the frontend with result handling
- [x] Observable privacy behavior: accepted-proof receipt without revealing the private input
- [x] Contract deployed to Preprod with a verifiable address
- [x] Public live demo
- [x] Demo video link

## Demo video

[Watch on YouTube](https://youtu.be/WBN1WQ87dzY)
