import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { CostModel, LedgerParameters, Transaction, ZswapChainState } from '@midnight-ntwrk/ledger-v8';
import { ContractState, sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import {
  createUnprovenCallTx,
  createUnprovenDeployTx,
  submitTxAsync,
} from '@midnight-ntwrk/midnight-js-contracts';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Contract } from '../../contracts/managed/hello-world/contract/index.js';

const contractName = 'hello-world';
const contractPath = '/contract/hello-world';

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value) {
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  if (hex.length % 2) throw new Error('Wallet returned an invalid transaction encoding.');
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

function createPublicDataProvider(queryUrl) {
  const latestAction = async (query, address) => {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { address } }),
    });
    if (!response.ok) throw new Error(`Indexer request failed (${response.status}).`);
    const result = await response.json();
    if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join('; '));
    return result.data?.contractAction ?? null;
  };

  return {
    async queryContractState(address) {
      const action = await latestAction(
        'query LatestContractState($address: HexEncoded!) { contractAction(address: $address) { state } }',
        address,
      );
      return action ? ContractState.deserialize(fromHex(action.state)) : null;
    },
    async queryZSwapAndContractState(address) {
      const action = await latestAction(
        'query LatestState($address: HexEncoded!) { contractAction(address: $address) { state zswapState transaction { block { ledgerParameters } } } }',
        address,
      );
      if (!action?.zswapState) return null;
      return [
        ZswapChainState.deserialize(fromHex(action.zswapState)),
        ContractState.deserialize(fromHex(action.state)),
        action.transaction?.block?.ledgerParameters
          ? LedgerParameters.deserialize(fromHex(action.transaction.block.ledgerParameters))
          : LedgerParameters.initialParameters(),
      ];
    },
  };
}

function compiledContract() {
  // ZK artifacts are fetched by FetchZkConfigProvider from public/contract.
  return CompiledContract.make(contractName, Contract).pipe(CompiledContract.withVacantWitnesses);
}

async function resolveWallet() {
  const started = Date.now();
  while (Date.now() - started < 6000) {
    const oneAm = globalThis.midnight?.['1am'];
    if (oneAm) return { connector: oneAm, name: '1AM' };
    const lace = globalThis.midnight?.mnLace;
    if (lace) return { connector: lace, name: 'Lace' };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Install and unlock 1AM or Lace with Midnight Preprod enabled, then refresh this page.');
}

export async function connectWallet() {
  const { connector, name } = await resolveWallet();
  const api = await connector.connect('preprod');
  const [config, shielded, unshielded] = await Promise.all([
    api.getConfiguration(),
    api.getShieldedAddresses(),
    api.getUnshieldedAddress(),
  ]);
  setNetworkId(config.networkId);

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL(contractPath, globalThis.location.origin).toString(),
    globalThis.fetch.bind(globalThis),
  );
  const provingProvider = await api.getProvingProvider(zkConfigProvider);

  const walletProvider = {
    getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
    async balanceTx(tx) {
      const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      if (!balanced?.tx) throw new Error('The wallet could not balance the proof transaction.');
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };
  const providers = {
    zkConfigProvider,
    publicDataProvider: createPublicDataProvider(config.indexerUri),
    proofProvider: {
      proveTx: (unprovenTx) => unprovenTx.prove(provingProvider, CostModel.initialCostModel()),
    },
    walletProvider,
    midnightProvider: {
      async submitTx(tx) {
        const result = await api.submitTransaction(toHex(tx.serialize()));
        return typeof result === 'string' ? result : result?.transactionId ?? result?.id ?? toHex(tx.serialize()).slice(0, 64);
      },
    },
  };
  return { api, name, providers, address: unshielded.unshieldedAddress };
}

export async function deployPrivateProof(session) {
  const deployData = await createUnprovenDeployTx(
    { zkConfigProvider: session.providers.zkConfigProvider, walletProvider: session.providers.walletProvider },
    { compiledContract: compiledContract(), args: [], signingKey: sampleSigningKey() },
  );
  const txId = await submitTxAsync(session.providers, { unprovenTx: deployData.private.unprovenTx });
  return { contractAddress: deployData.public.contractAddress, txId };
}

export async function provePrivateKnowledge(session, contractAddress, phrase) {
  const accessPhrase = new TextEncoder().encode(phrase);
  if (accessPhrase.byteLength !== 21) throw new Error('The demo phrase must be exactly 21 ASCII bytes.');
  const callData = await createUnprovenCallTx(session.providers, {
    compiledContract: compiledContract(),
    contractAddress,
    circuitId: 'provePrivateKnowledge',
    args: [accessPhrase],
  });
  const txId = await submitTxAsync(session.providers, {
    unprovenTx: callData.private.unprovenTx,
    circuitId: 'provePrivateKnowledge',
  });
  return { txId };
}
