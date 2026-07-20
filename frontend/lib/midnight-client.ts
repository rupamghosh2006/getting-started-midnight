import type { CompiledContract as CompiledContractType } from '@midnight-ntwrk/compact-js';
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
const { default: Contract } = await import('@contracts/managed/hello-world/contract/index.js');

export interface WalletSession {
  api: any;
  name: string;
  address: string;
  legacyLace?: boolean;
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
  // @ts-expect-error - Contract is a JS module without TS types
  return CompiledContract.make(contractName, Contract).pipe(CompiledContract.withVacantWitnesses);
}

function connectorCandidate(...candidates: any[]) {
  return candidates.find(
    (candidate) => typeof candidate?.connect === 'function' || typeof candidate?.enable === 'function',
  );
}

function laceConnector() {
  // The current Lace extension injects its Midnight connector here and uses
  // enable(), whereas 1AM uses connect('preprod').
  const currentLace = (globalThis as any).lace?.midnight;
  if (typeof currentLace?.enable === 'function') {
    return { connector: currentLace, mode: 'enable' as const };
  }

  const namedConnector = connectorCandidate(
    (globalThis as any).midnight?.mnLace,
    (globalThis as any).midnight?.lace,
    (globalThis as any).mnLace,
    (globalThis as any).lace,
  );
  if (namedConnector) {
    return {
      connector: namedConnector,
      mode: typeof namedConnector.connect === 'function' ? 'connect' as const : 'enable' as const,
    };
  }

  const anonymousConnectors = Object.entries((globalThis as any).midnight ?? {})
    .filter(([key, candidate]) => key !== '1am' && (
      typeof (candidate as any)?.connect === 'function' || typeof (candidate as any)?.enable === 'function'
    ));
  return anonymousConnectors.length === 1
    ? {
      connector: anonymousConnectors[0][1],
      mode: typeof (anonymousConnectors[0][1] as any).connect === 'function' ? 'connect' as const : 'enable' as const,
    }
    : undefined;
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
    if (preferred === 'lace' && lace) return { ...lace, name: 'Lace' };
    if (preferred === 'auto' && oneAm) return { connector: oneAm, name: '1AM', mode: 'connect' as const };
    if (preferred === 'auto' && lace) return { ...lace, name: 'Lace' };
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
  const { connector, name, mode } = await resolveWallet(preferred);
  if (name === 'Lace' && mode === 'enable') {
    const api = await connector.enable();
    const state = await api.state?.();
    const addresses = !state?.address && api.getUsedAddresses ? await api.getUsedAddresses() : [];
    const address = state?.address ?? addresses?.[0] ?? 'Lace connected';

    return {
      api: { ...api, disconnect: () => connector.disconnect?.() },
      name,
      address,
      legacyLace: true,
      providers: {} as any,
    };
  }

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
        const result = await api.submitTransaction(toHex(tx.serialize()));
        return typeof result === 'string'
          ? result
          : result?.transactionId ?? result?.id ?? toHex(tx.serialize()).slice(0, 64);
      },
    },
  };

  return { api, name, providers, address: unshielded.unshieldedAddress };
}

export async function deployPrivateProof(session: WalletSession): Promise<ProofReceipt> {
  const deployData = await createUnprovenDeployTx(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    { compiledContract: compiledContract(), args: [], signingKey: sampleSigningKey() },
  );
  const txId = await submitTxAsync(session.providers, { unprovenTx: deployData.private.unprovenTx });
  return { contractAddress: deployData.public.contractAddress, txId };
}

export async function provePrivateKnowledge(
  session: WalletSession,
  contractAddress: string,
  phrase: string,
): Promise<ProofReceipt> {
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
