import { connectWallet, deployPrivateProof, provePrivateKnowledge } from './midnight-client.js';

const VERIFIED_DEPLOYMENT = {
  address: 'c456ed849e1e2be80e8e571ec1a8830ef98d87c324659a0ba44aded5361dbc8d',
  txId: '6581c87b19eb8ef8357b6d0ad7a96e0981d0f5051f1bbdb1cd4649f056da3b4f',
};

// The phrase stays in a local function variable only. Do not add analytics,
// localStorage, logs, or a backend round-trip to this flow.
let session;
let contractAddress = localStorage.getItem('midnight-private-proof:preprod') || VERIFIED_DEPLOYMENT.address;
let deploymentTxId = localStorage.getItem('midnight-private-proof:deployment-tx') || VERIFIED_DEPLOYMENT.txId;

const $ = (id) => document.getElementById(id);
const connectButton = $('connect');
const disconnectButton = $('disconnect');
const proveButton = $('prove');
const deployButton = $('deploy');
const secretInput = $('secret');
const explorerUrl = (txId) => `https://explorer.1am.xyz/tx/${txId}?network=preprod`;
const shorten = (value, start = 9, end = 8) => value && value.length > start + end ? `${value.slice(0, start)}...${value.slice(-end)}` : value;

function showStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}

function updateContractUI() {
  $('contract-address').textContent = contractAddress || 'Connect a wallet, then deploy to Preprod';
  $('contract-address-short').textContent = contractAddress ? shorten(contractAddress, 12, 10) : 'No contract selected';
  if (deploymentTxId) {
    const link = $('deployment-transaction-link');
    link.href = explorerUrl(deploymentTxId);
    link.textContent = shorten(deploymentTxId, 8, 8);
  }
}

function setConnected(address) {
  $('connection-badge').textContent = 'CONNECTED';
  $('connection-badge').classList.add('green');
  $('wallet-state').textContent = 'ON';
  $('wallet-address').textContent = shorten(address, 13, 9);
  $('wallet-address').title = address;
  $('wallet-visibility').textContent = 'LIVE \u25c9';
  connectButton.disabled = true;
  disconnectButton.disabled = false;
  secretInput.disabled = false;
  proveButton.disabled = false;
  deployButton.disabled = false;
  document.querySelectorAll('[data-action="connect"]').forEach((button) => { button.disabled = true; });
}

async function connect() {
  try {
    showStatus('Waiting for 1AM or Lace wallet permission...');
    session = await connectWallet();
    setConnected(session.address);
    showStatus(`${session.name} connected. Your proof input remains local to the proving flow.`);
  } catch (error) {
    session = undefined;
    showStatus(error instanceof Error ? error.message : String(error), true);
  }
}

async function disconnect() {
  await session?.api?.disconnect?.();
  session = undefined;
  $('connection-badge').textContent = 'DISCONNECTED';
  $('connection-badge').classList.remove('green');
  $('wallet-state').textContent = 'OFF';
  $('wallet-address').textContent = 'No wallet connected';
  $('wallet-address').removeAttribute('title');
  $('wallet-visibility').textContent = 'HIDE \u25c9';
  connectButton.disabled = false;
  disconnectButton.disabled = true;
  secretInput.disabled = true;
  proveButton.disabled = true;
  deployButton.disabled = true;
  document.querySelectorAll('[data-action="connect"]').forEach((button) => { button.disabled = false; });
  secretInput.value = '';
  showStatus('Wallet disconnected and private input cleared.');
}

async function prove() {
  const accessPhrase = secretInput.value;
  if (!accessPhrase) return showStatus('Enter the private phrase first.', true);
  if (!contractAddress) return showStatus('Deploy the Preprod contract first.', true);

  try {
    proveButton.disabled = true;
    showStatus('Creating a zero-knowledge proof in the wallet-provided proving flow...');
    if (!session) throw new Error('Connect a wallet first.');
    const receipt = await provePrivateKnowledge(session, contractAddress, accessPhrase);
    const txId = receipt.txId ?? 'submitted';
    $('receipt-result').textContent = `Private proof submitted: ${txId}. The phrase is not in public state.`;
    $('proof-transaction').hidden = false;
    $('proof-transaction-link').textContent = shorten(txId, 8, 8);
    $('proof-transaction-link').href = txId === 'submitted' ? '#top' : explorerUrl(txId);
    $('proof-transaction-time').textContent = 'JUST NOW';
    $('proof-transaction-status').className = 'tx-status pending';
    $('proof-transaction-status').innerHTML = '<i></i> SUBMITTED';
    $('proof-count-note').textContent = 'Proof transaction submitted; awaiting indexing';
    showStatus('Circuit call submitted. After indexing, the public receipt changes without revealing the phrase.');
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    secretInput.value = '';
    proveButton.disabled = false;
  }
}

async function deploy() {
  if (!session) return showStatus('Connect a wallet first.', true);
  try {
    deployButton.disabled = true;
    showStatus('Building, proving, and submitting the deployment through your wallet...');
    const receipt = await deployPrivateProof(session);
    contractAddress = receipt.contractAddress;
    deploymentTxId = receipt.txId;
    localStorage.setItem('midnight-private-proof:preprod', contractAddress);
    localStorage.setItem('midnight-private-proof:deployment-tx', deploymentTxId);
    updateContractUI();
    $('receipt-result').textContent = `Deployment submitted: ${deploymentTxId}`;
    showStatus('Deployment submitted. Wait for Preprod indexing, then submit a private proof.');
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    deployButton.disabled = false;
  }
}

function filterTransactions(event) {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll('.transaction-row').forEach((row) => {
    row.hidden = Boolean(query) && !row.dataset.search.includes(query);
  });
}

updateContractUI();
connectButton.addEventListener('click', connect);
disconnectButton.addEventListener('click', disconnect);
proveButton.addEventListener('click', prove);
deployButton.addEventListener('click', deploy);
$('transaction-search').addEventListener('input', filterTransactions);
document.querySelectorAll('[data-action="connect"]').forEach((button) => button.addEventListener('click', connect));
