import type { CompiledContract as CompiledContractType } from '@midnight-ntwrk/compact-js';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
const { CompiledContract } = await import('@midnight-ntwrk/compact-js');
const { CostModel, LedgerParameters, Transaction, ZswapChainState } = await import('@midnight-ntwrk/ledger-v8');
const { ContractState, sampleSigningKey } = await import('@midnight-ntwrk/compact-runtime');
const {
  createUnprovenCallTx,
  createUnprovenDeployTx,
  submitTxAsync,
} = await import('@midnight-ntwrk/midnight-js-contracts');
const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
// Compact emits a named `Contract` class. Importing `default` works in some
// dev bundlers through interop, but is undefined in the production ESM build.
// `CompiledContract.make` requires this constructor to build its context.
const { Contract } = await import('@contracts/managed/hello-world/contract/index.js');

export interface WalletSession {
  api: any;
  name: string;
  address: string;
  providers: {
    zkConfigProvider: any;
    publicDataProvider: any;
    proofProvider: any;
    walletProvider: any;
    midnightProvider: {
      submitTx: (tx: any) => Promise<string>;
    };
  };
}

export interface ProofReceipt {
  txId: string;
  contractAddress?: string;
}

type ProofMaterial = {
  secret: Uint8Array;
  salt: Uint8Array;
};

const contractName = 'hello-world';
const contractPath = '/contract/hello-world';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array {
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  if (hex.length % 2) throw new Error('Wallet returned an invalid transaction encoding.');
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

const saltStoragePrefix = '1am-private-proof:salt:';

function storageKey(contractAddress: string): string {
  return `${saltStoragePrefix}${contractAddress.toLowerCase()}`;
}

async function privateSecret(phrase: string): Promise<Uint8Array> {
  const normalized = phrase.trim();
  if (normalized.length < 12) {
    throw new Error('Use a unique private phrase with at least 12 characters.');
  }
  const input = new TextEncoder().encode(`1AM Private Proof secret v1\u0000${normalized}`);
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input));
}

function randomSalt(): Uint8Array {
  const salt = new Uint8Array(32);
  globalThis.crypto.getRandomValues(salt);
  return salt;
}

function rememberSalt(contractAddress: string, salt: Uint8Array): void {
  globalThis.localStorage.setItem(storageKey(contractAddress), toHex(salt));
}

function savedSalt(contractAddress: string): Uint8Array {
  const value = globalThis.localStorage.getItem(storageKey(contractAddress));
  if (!value) {
    throw new Error(
      'This browser has no local proof state for the contract. Deploy it here, or restore the browser-local salt before proving.',
    );
  }
  const salt = fromHex(value);
  if (salt.byteLength !== 32) throw new Error('The saved local proof state is invalid. Deploy a new contract.');
  return salt;
}

function createPublicDataProvider(queryUrl: string) {
  const latestAction = async (query: string, address: string) => {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { address } }),
    });
    if (!response.ok) throw new Error(`Indexer request failed (${response.status}).`);
    const result = await response.json();
    if (result.errors?.length) throw new Error(result.errors.map((e: any) => e.message).join('; '));
    return result.data?.contractAction ?? null;
  };

  return {
    async queryContractState(address: string) {
      const action = await latestAction(
        'query LatestContractState($address: HexEncoded!) { contractAction(address: $address) { state } }',
        address,
      );
      return action ? ContractState.deserialize(fromHex(action.state)) : null;
    },
    async queryZSwapAndContractState(address: string) {
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

function compiledContract(): any {
  return CompiledContract.make(contractName, Contract).pipe(CompiledContract.withVacantWitnesses);
}

function connectorCandidate(...candidates: any[]): InitialAPI | undefined {
  return candidates.find((candidate) => typeof candidate?.connect === 'function') as InitialAPI | undefined;
}

function laceConnector(): InitialAPI | undefined {
  // DApp Connector API v4 wallets expose `connect(networkId)`. This keeps
  // Lace's proof, balance, and submit methods in the same real wallet session
  // instead of treating a cosmetic `enable()` result as a usable provider.
  const namedConnector = connectorCandidate(
    (globalThis as any).midnight?.mnLace,
    (globalThis as any).midnight?.lace,
    (globalThis as any).mnLace,
    (globalThis as any).lace,
  );
  if (namedConnector) return namedConnector;

  const anonymousConnectors = Object.entries((globalThis as any).midnight ?? {})
    .filter(([key, candidate]) => key !== '1am' && typeof (candidate as any)?.connect === 'function');
  return anonymousConnectors.length === 1 ? anonymousConnectors[0][1] as InitialAPI : undefined;
}

function detectedMidnightProviders(): string {
  const namespace = (globalThis as any).midnight;
  if (!namespace || typeof namespace !== 'object') return 'none';
  const keys = Object.keys(namespace);
  return keys.length ? keys.join(', ') : 'namespace present, no providers';
}

async function resolveWallet(preferred: string = 'auto') {
  const started = Date.now();
  while (Date.now() - started < 6000) {
    const oneAm = (globalThis as any).midnight?.['1am'];
    const lace = laceConnector();
    if (preferred === '1am' && oneAm) return { connector: oneAm, name: '1AM', mode: 'connect' as const };
    if (preferred === 'lace' && lace) return { connector: lace, name: 'Lace' };
    if (preferred === 'auto' && oneAm) return { connector: oneAm, name: '1AM', mode: 'connect' as const };
    if (preferred === 'auto' && lace) return { connector: lace, name: 'Lace' };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const walletName = preferred === 'lace' ? 'Lace' : preferred === '1am' ? '1AM' : '1AM or Lace';
  const providers = detectedMidnightProviders();
  throw new Error(
    `${walletName} was not injected into this page. Detected Midnight providers: ${providers}.` +
    ` Allow the Lace extension on localhost in its browser extension site-access settings, then reload.`,
  );
}

export async function connectWallet(preferred: string = 'auto'): Promise<WalletSession> {
  const { connector, name } = await resolveWallet(preferred);
  const api: ConnectedAPI = await (connector as InitialAPI).connect('preprod');
  await api.hintUsage([
    'getConfiguration',
    'getShieldedAddresses',
    'getUnshieldedAddress',
    'getProvingProvider',
    'balanceUnsealedTransaction',
    'submitTransaction',
  ]);
  const [config, shielded, unshielded] = await Promise.all([
    api.getConfiguration(),
    api.getShieldedAddresses(),
    api.getUnshieldedAddress(),
  ]);
  if (config.networkId !== 'preprod') {
    throw new Error(`Lace is connected to ${config.networkId}; switch the wallet to Midnight Preprod and reconnect.`);
  }
  setNetworkId(config.networkId);

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL(contractPath, globalThis.location.origin).toString(),
    globalThis.fetch.bind(globalThis),
  );
  const provingProvider = await api.getProvingProvider(zkConfigProvider);

  const walletProvider = {
    getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
    async balanceTx(tx: any) {
      const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      if (!balanced?.tx) throw new Error('The wallet could not balance the proof transaction.');
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };

  const providers = {
    zkConfigProvider,
    publicDataProvider: createPublicDataProvider(config.indexerUri),
    proofProvider: {
      proveTx: (unprovenTx: any) => unprovenTx.prove(provingProvider, CostModel.initialCostModel()),
    },
    walletProvider,
    midnightProvider: {
      async submitTx(tx: any) {
        // Connector API v4 specifies no return value for submission. Some
        // wallets additionally return an ID, so preserve it when available
        // and otherwise retain a deterministic local receipt identifier.
        const result = await (api as any).submitTransaction(toHex(tx.serialize()));
        return typeof result === 'string'
          ? result
          : result?.transactionId ?? result?.id ?? toHex(tx.serialize()).slice(0, 64);
      },
    },
  };

  return { api, name, providers, address: unshielded.unshieldedAddress };
}

export async function deployPrivateProof(session: WalletSession, phrase: string): Promise<ProofReceipt> {
  const material: ProofMaterial = { secret: await privateSecret(phrase), salt: randomSalt() };
  const deployData = await createUnprovenDeployTx(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: compiledContract(),
      args: [material.secret, material.salt],
      signingKey: sampleSigningKey(),
    },
  );
  const txId = await submitTxAsync(session.providers, { unprovenTx: deployData.private.unprovenTx });
  rememberSalt(deployData.public.contractAddress, material.salt);
  return { contractAddress: deployData.public.contractAddress, txId };
}

export async function provePrivateKnowledge(
  session: WalletSession,
  contractAddress: string,
  phrase: string,
): Promise<ProofReceipt> {
  const material: ProofMaterial = {
    secret: await privateSecret(phrase),
    salt: savedSalt(contractAddress),
  };
  const callData = await createUnprovenCallTx(session.providers, {
    compiledContract: compiledContract(),
    contractAddress,
    circuitId: 'provePrivateKnowledge',
    args: [material.secret, material.salt],
  });
  const txId = await submitTxAsync(session.providers, {
    unprovenTx: callData.private.unprovenTx,
    circuitId: 'provePrivateKnowledge',
  });
  return { txId };
}
