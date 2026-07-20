// Lace injects this connector asynchronously. We deliberately keep the
// private phrase in a local variable only; do not add analytics, localStorage,
// logs, or a backend round-trip to this flow.
const NETWORK = 'preprod';
const CONTRACT_ADDRESS = globalThis.__MIDNIGHT_CONTRACT_ADDRESS__ || '';
let connector;
let wallet;

const $ = (id) => document.getElementById(id);
const connectButton = $('connect');
const disconnectButton = $('disconnect');
const proveButton = $('prove');
const secretInput = $('secret');

function showStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}

function setConnected(address) {
  $('connection-badge').textContent = 'Connected';
  $('connection-badge').classList.add('green');
  $('wallet-address').textContent = address;
  connectButton.disabled = true;
  disconnectButton.disabled = false;
  secretInput.disabled = false;
  proveButton.disabled = false;
}

async function waitForLace(timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const injected = globalThis.midnight?.mnLace;
    if (injected) return injected;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Lace with Midnight support was not detected. Install/unlock Lace and refresh this page.');
}

async function connect() {
  try {
    showStatus('Waiting for Lace…');
    connector = await waitForLace();
    // This is Lace's DApp Connector API. It opens the user approval prompt.
    wallet = await connector.connect(NETWORK);
    const addresses = await wallet.getShieldedAddresses();
    const address = Array.isArray(addresses) ? addresses[0]?.shieldedAddress : addresses.shieldedAddress;
    if (!address) throw new Error('Lace connected but did not return a shielded address.');
    setConnected(address);
    showStatus('Wallet connected. Your proof input will remain local to the proving flow.');
  } catch (error) {
    wallet = undefined;
    showStatus(error instanceof Error ? error.message : String(error), true);
  }
}

async function disconnect() {
  // The connector API is permission-oriented. Some Lace builds expose
  // disconnect(), while others revoke access when the page session ends.
  await connector?.disconnect?.();
  wallet = undefined;
  $('connection-badge').textContent = 'Disconnected';
  $('connection-badge').classList.remove('green');
  $('wallet-address').textContent = 'No wallet connected';
  connectButton.disabled = false;
  disconnectButton.disabled = true;
  secretInput.disabled = true;
  proveButton.disabled = true;
  secretInput.value = '';
  showStatus('Wallet disconnected and private input cleared.');
}

async function prove() {
  const accessPhrase = secretInput.value;
  if (!accessPhrase) return showStatus('Enter the private phrase first.', true);
  if (!CONTRACT_ADDRESS) return showStatus('No Preprod contract address configured. Deploy first, then set __MIDNIGHT_CONTRACT_ADDRESS__.', true);

  try {
    proveButton.disabled = true;
    showStatus('Creating ZK proof in the Lace-provided proving flow…');

    // The application-specific client is supplied by the production bundle.
    // It must call the compiled `provePrivateKnowledge` circuit and use this
    // connected Lace API for balancing and submission. Keeping it separate
    // prevents this static UI from ever receiving key material.
    const client = globalThis.midnightPrivateProofClient;
    if (!client?.provePrivateKnowledge) {
      throw new Error('Contract client is not bundled. Run the frontend build after compiling and deploying the contract.');
    }
    const receipt = await client.provePrivateKnowledge({ wallet, contractAddress: CONTRACT_ADDRESS, accessPhrase });
    $('receipt-result').textContent = `Accepted — tx ${receipt.txId ?? 'submitted'}`;
    showStatus('Circuit call accepted. The phrase was not added to public state.');
  } catch (error) {
    showStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    // Clear the DOM and release our only application reference immediately.
    secretInput.value = '';
    proveButton.disabled = false;
  }
}

$('contract-address').textContent = CONTRACT_ADDRESS || 'Deploy to Preprod, then configure the address';
connectButton.addEventListener('click', connect);
disconnectButton.addEventListener('click', disconnect);
proveButton.addEventListener('click', prove);
