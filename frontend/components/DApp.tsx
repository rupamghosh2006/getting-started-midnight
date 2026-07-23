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

const DEPLOYED_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PRIVATE_PROOF_CONTRACT_ADDRESS ?? '';
const DEPLOYMENT_TRANSACTION_ID = process.env.NEXT_PUBLIC_PRIVATE_PROOF_DEPLOYMENT_TX_ID ?? '';

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
  if (typeof window === 'undefined') return DEPLOYED_CONTRACT_ADDRESS;
  return localStorage.getItem('midnight-private-proof:preprod') || DEPLOYED_CONTRACT_ADDRESS;
}

function getInitialDeploymentTxId(): string {
  if (typeof window === 'undefined') return DEPLOYMENT_TRANSACTION_ID;
  return localStorage.getItem('midnight-private-proof:deployment-tx') || DEPLOYMENT_TRANSACTION_ID;
}

export default function DApp() {
  const [state, setState] = useState<DAppState>({
    session: null,
    contractAddress: getInitialContractAddress(),
    deploymentTxId: getInitialDeploymentTxId(),
    proofCount: 0,
    status: 'Connect Lace on Midnight Preprod, enter a private phrase, then deploy or prove.',
    isError: false,
    transactions: [],
    secretPhrase: '',
  });

  useEffect(() => {
    if (!state.deploymentTxId) return;
    const now = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    setState((s) => ({
      ...s,
      transactions: [{ type: 'deployment', txId: state.deploymentTxId, timestamp: now, status: 'confirmed' }],
    }));
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
        status: `${session.name} connected on Preprod. Your phrase and proof salt remain browser-local.`,
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
    if (!state.secretPhrase) {
      showStatus('Enter a private phrase first. It creates the deployment commitment and is never placed on-chain.', true);
      return;
    }
    try {
      showStatus('Building the private commitment and submitting the Compact contract through your wallet...');
      const receipt = await deployPrivateProof(state.session, state.secretPhrase);
      const now = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      setState((s) => ({
        ...s,
        contractAddress: receipt.contractAddress!,
        deploymentTxId: receipt.txId,
        secretPhrase: '',
        status: 'Deployment submitted. The phrase was cleared; its random salt is retained only in this browser for future proofs.',
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
    try {
      showStatus('Creating a zero-knowledge proof in the wallet-provided proving flow...');
      if (!state.session) throw new Error('Connect a wallet first.');
      const receipt = await provePrivateKnowledge(state.session, state.contractAddress, state.secretPhrase);
      const now = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      setState((s) => ({
        ...s,
        secretPhrase: '',
        proofCount: s.proofCount + 1,
        status: 'Circuit call submitted through the connected wallet. After indexing, the public receipt changes without revealing the phrase or salt.',
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
  const deployDisabled = !isConnected || Boolean(state.contractAddress);
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
