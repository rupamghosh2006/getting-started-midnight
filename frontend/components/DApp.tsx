'use client';

import '../lib/bootstrap';
import { useState, useCallback, useEffect } from 'react';
import Topbar from './Topbar';
import BalanceGrid from './BalanceGrid';
import QuickActions from './QuickActions';
import ProofConsole from './ProofConsole';
import TransactionsPanel from './TransactionsPanel';
import { connectWallet, deployPrivateProof, provePrivateKnowledge } from '../lib/midnight-client';
import type { WalletSession } from '../lib/midnight-client';

const VERIFIED_DEPLOYMENT = {
  address: 'c456ed849e1e2be80e8e571ec1a8830ef98d87c324659a0ba44aded5361dbc8d',
  txId: '6581c87b19eb8ef8357b6d0ad7a96e0981d0f5051f1bbdb1cd4649f056da3b4f',
};

interface Transaction {
  type: 'deployment' | 'proof';
  txId: string;
  timestamp: string;
  status: 'confirmed' | 'pending';
}

interface DAppState {
  session: WalletSession | null;
  contractAddress: string;
  deploymentTxId: string;
  proofCount: number;
  status: string;
  isError: boolean;
  transactions: Transaction[];
  secretPhrase: string;
}

function getInitialContractAddress(): string {
  if (typeof window === 'undefined') return VERIFIED_DEPLOYMENT.address;
  return localStorage.getItem('midnight-private-proof:preprod') || VERIFIED_DEPLOYMENT.address;
}

function getInitialDeploymentTxId(): string {
  if (typeof window === 'undefined') return VERIFIED_DEPLOYMENT.txId;
  return localStorage.getItem('midnight-private-proof:deployment-tx') || VERIFIED_DEPLOYMENT.txId;
}

export default function DApp() {
  const [state, setState] = useState<DAppState>({
    session: null,
    contractAddress: getInitialContractAddress(),
    deploymentTxId: getInitialDeploymentTxId(),
    proofCount: 0,
    status: 'Connect 1AM or Lace on Preprod to continue.',
    isError: false,
    transactions: [],
    secretPhrase: '',
  });

  useEffect(() => {
    if (state.deploymentTxId && state.deploymentTxId !== VERIFIED_DEPLOYMENT.txId) {
      const now = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      setState((s) => ({
        ...s,
        transactions: [
          {
            type: 'deployment',
            txId: state.deploymentTxId,
            timestamp: now,
            status: 'confirmed',
          },
        ],
      }));
    }
  }, []);

  const showStatus = useCallback((message: string, isError = false) => {
    setState((s) => ({ ...s, status: message, isError }));
  }, []);

  const handleConnect = useCallback(async (preferred: string = '1am') => {
    try {
      const walletName = preferred === 'lace' ? 'Lace' : '1AM';
      showStatus(`Waiting for ${walletName} wallet permission...`);
      const session = await connectWallet(preferred);
      setState((s) => ({
        ...s,
        session,
        status: session.legacyLace
          ? 'Lace connected on Preprod. Disconnect is available from this page.'
          : `${session.name} connected. Your proof input remains local to the proving flow.`,
        isError: false,
      }));
    } catch (error) {
      setState((s) => ({
        ...s,
        session: null,
        status: error instanceof Error ? error.message : String(error),
        isError: true,
      }));
    }
  }, [showStatus]);

  const handleDisconnect = useCallback(async () => {
    await state.session?.api?.disconnect?.();
    setState((s) => ({
      ...s,
      session: null,
      secretPhrase: '',
      status: 'Wallet disconnected and private input cleared.',
      isError: false,
    }));
  }, [state.session]);

  const handleDeploy = useCallback(async () => {
    if (!state.session) {
      showStatus('Connect a wallet first.', true);
      return;
    }
    if (state.session.legacyLace) {
      showStatus('Lace is connected. This existing v4 deployment flow is provided by 1AM; reconnect with 1AM to deploy.', true);
      return;
    }
    try {
      showStatus('Building, proving, and submitting the deployment through your wallet...');
      const receipt = await deployPrivateProof(state.session);
      const now = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      setState((s) => ({
        ...s,
        contractAddress: receipt.contractAddress!,
        deploymentTxId: receipt.txId,
        status: 'Deployment submitted. Wait for Preprod indexing, then submit a private proof.',
        isError: false,
        transactions: [
          {
            type: 'deployment',
            txId: receipt.txId,
            timestamp: now,
            status: 'confirmed',
          },
          ...s.transactions.filter((t) => t.type === 'proof'),
        ],
      }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('midnight-private-proof:preprod', receipt.contractAddress!);
        localStorage.setItem('midnight-private-proof:deployment-tx', receipt.txId);
      }
    } catch (error) {
      showStatus(error instanceof Error ? error.message : String(error), true);
    }
  }, [state.session, showStatus]);

  const handleProve = useCallback(async () => {
    if (!state.secretPhrase) {
      showStatus('Enter the private phrase first.', true);
      return;
    }
    if (!state.contractAddress) {
      showStatus('Deploy the Preprod contract first.', true);
      return;
    }
    if (state.session?.legacyLace) {
      showStatus('Lace is connected. This existing v4 circuit flow is provided by 1AM; reconnect with 1AM to submit the proof.', true);
      return;
    }
    try {
      showStatus('Creating a zero-knowledge proof in the wallet-provided proving flow...');
      if (!state.session) throw new Error('Connect a wallet first.');
      const receipt = await provePrivateKnowledge(state.session, state.contractAddress, state.secretPhrase);
      const now = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      setState((s) => ({
        ...s,
        secretPhrase: '',
        proofCount: s.proofCount + 1,
        status:
          'Circuit call submitted. After indexing, the public receipt changes without revealing the phrase.',
        isError: false,
        transactions: [
          {
            type: 'proof',
            txId: receipt.txId,
            timestamp: 'JUST NOW',
            status: 'pending',
          },
          ...s.transactions,
        ],
      }));
    } catch (error) {
      showStatus(error instanceof Error ? error.message : String(error), true);
    }
  }, [state.session, state.contractAddress, state.secretPhrase, showStatus]);

  const isConnected = state.session !== null;
  const walletAddress = state.session?.address ?? '';
  const walletName = state.session?.name ?? '';
  const connectDisabled = isConnected;
  const deployDisabled = !isConnected || state.deploymentTxId !== VERIFIED_DEPLOYMENT.txId;
  const proveDisabled = !isConnected || !state.contractAddress;

  return (
    <div className="app-shell">
      <Topbar
        isConnected={isConnected}
        address={walletAddress}
        walletName={walletName}
        onConnect1AM={() => handleConnect('1am')}
        onConnectLace={() => handleConnect('lace')}
        onDisconnect={handleDisconnect}
        connectDisabled={connectDisabled}
      />

      <main id="top" className="wallet-dashboard">
        <BalanceGrid
          proofCount={state.proofCount}
          contractAddress={state.contractAddress}
          isConnected={isConnected}
          walletAddress={walletAddress}
        />

        <QuickActions
          isConnected={isConnected}
          onConnect1AM={() => handleConnect('1am')}
          onConnectLace={() => handleConnect('lace')}
          onDeploy={handleDeploy}
          onProve={handleProve}
          deployDisabled={deployDisabled}
          proveDisabled={proveDisabled}
        />

        <nav className="section-tabs" aria-label="Private proof dashboard sections">
          <button type="button">ASSETS</button>
          <button type="button">PROOFS</button>
          <button className="active" type="button">TRANSACTIONS</button>
          <button type="button">APPS</button>
        </nav>

        <ProofConsole
          contractAddress={state.contractAddress}
          status={state.status}
          isError={state.isError}
          disabled={!isConnected}
          secretPhrase={state.secretPhrase}
          onSecretChange={(value) => setState((s) => ({ ...s, secretPhrase: value }))}
          onProve={handleProve}
        />

        <TransactionsPanel transactions={state.transactions} />
      </main>
    </div>
  );
}
