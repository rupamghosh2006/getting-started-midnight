# 1AM Private Proof

1AM Private Proof is a Midnight Preprod DApp where a user proves knowledge of a private phrase without placing that phrase—or its random salt—on-chain. It connects to the Lace Midnight wallet, deploys a Compact contract, and submits the `provePrivateKnowledge` circuit through the connected wallet.

## What is private and what is public

At deployment, the Compact constructor receives a private 32-byte secret derived in the browser from the phrase, plus a random 32-byte salt stored only in that browser. It stores only `persistentCommit(secret, salt)` as an immutable, sealed commitment. Later, the proof circuit recomputes that commitment privately and accepts only an equal value.

| Browser-local data | Public, verifiable data |
| --- | --- |
| phrase-derived secret | immutable salted commitment |
| random 32-byte salt | latest accepted flag |
| wallet session state | successful-proof counter |

The observable privacy behavior is a changed public counter after a valid circuit call, without exposing the phrase or salt. `persistentCommit` is deliberately used rather than a hard-coded phrase predicate, so the contract proves knowledge of deployment-specific private material.

## Contract

The source is [contracts/hello-world.compact](contracts/hello-world.compact). Its deployed public API is:

```compact
constructor(secret: Bytes<32>, salt: Bytes<32>)
provePrivateKnowledge(secret: Bytes<32>, salt: Bytes<32>)
```

`secretCommitment` is a sealed ledger field and cannot be changed after deployment. `latestProofAccepted` and `successfulProofs` are the intentional public receipt.

## Run locally

Midnight development is supported on Linux and macOS. On Windows, use WSL: the Windows command named `compact.exe` performs NTFS compression and is **not** the Midnight Compact compiler.

```bash
# In WSL/Linux after installing the official Midnight Compact toolchain
compact update 0.31.1
npm ci
npm run compile
npm run sync:zk
npm --prefix frontend ci
npm --prefix frontend run dev
```

Open the local URL, select **Lace**, ensure Lace is set to **Midnight Preprod**, enter a unique phrase, and choose **Deploy**. The browser clears the phrase after deployment and retains only the salt in browser-local storage for subsequent proof calls.

For Lace, choose the local proof server in Lace's Midnight settings when testing locally. The DApp uses Lace's enabled wallet API for wallet keys, balancing, proving, and submission; it does not silently fall back to a different wallet for circuit calls.

## Deploy the frontend and contract

Vercel runs `frontend/vercel-build.sh`. That build installs Compact 0.31.1, compiles the contract from source, copies the generated ZK artifacts, then builds the Next.js frontend. This prevents stale generated bindings or proving keys from being deployed.

After deploying the contract with Lace on Preprod:

1. Copy the contract address and deployment transaction ID from the UI.
2. Add them to Vercel as `NEXT_PUBLIC_PRIVATE_PROOF_CONTRACT_ADDRESS` and `NEXT_PUBLIC_PRIVATE_PROOF_DEPLOYMENT_TX_ID`.
3. Add the same address, transaction ID, and explorer URL under `contracts.preprod` in `deployed-contracts.json`.
4. Redeploy the frontend and verify with `npm run verify:preprod` from WSL/Linux.

Do not reuse the former Preprod address: it was deployed from an older hard-coded-phrase contract and is not evidence for this commitment-based contract.

## Verification and CI

The GitHub Actions workflow in [.github/workflows/contract.yml](.github/workflows/contract.yml) installs the official Compact toolchain on Linux, compiles the source, verifies required generated files exist, synchronizes proving artifacts, and builds the frontend.

```bash
npm run verify:preprod
```

The verification command queries the official public Preprod indexer and prints the contract receipt. It intentionally fails if `deployed-contracts.json` does not yet contain a current deployment.

## Submission checklist

- [x] Lace connect and disconnect
- [x] Lace-backed Compact deployment and circuit call path
- [x] Commitment-based observable privacy behavior
- [x] Public source contract and reproducible Linux CI compile
- [ ] Deploy this revised contract to Preprod and record its new address
- [ ] Capture a new video: Lace connect, deploy/join, valid proof, and public receipt
- [ ] Push the revised source and CI result before resubmission
