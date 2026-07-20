'use client';

interface TopbarProps {
  isConnected: boolean;
  address: string;
  walletName: string;
  onConnect1AM: () => void;
  onConnectLace: () => void;
  onDisconnect: () => void;
  connectDisabled: boolean;
}

function shorten(value: string, start = 9, end = 8) {
  return value && value.length > start + end
    ? `${value.slice(0, start)}...${value.slice(-end)}`
    : value;
}

export default function Topbar({
  isConnected,
  address,
  walletName,
  onConnect1AM,
  onConnectLace,
  onDisconnect,
  connectDisabled,
}: TopbarProps) {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="1AM Private Proof home">
        <span className="brand-mark" aria-hidden="true"><i></i></span>
        <span>1AM</span>
        <em>PRIVATE PROOF</em>
      </a>

      <div className="topbar-tools">
        <div className="dust-indicator" aria-label="Wallet-sponsored dust fees">
          <div>
            <span className="dust-orbit">&#9678;</span> DUST <strong>0.0</strong>
          </div>
          <div className="dust-meter"><i></i></div>
          <small><b></b> DUST SPONSORED</small>
        </div>
        <span className="lightning" aria-hidden="true">&#9889;</span>
        <div className="network-state">
          <b>PREPROD</b>
          <span></span>
          <em>SYNCED</em>
        </div>
        <span
          id="connection-badge"
          className={`connection-state${isConnected ? ' green' : ''}`}
        >
          {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
        <button
          id="connect"
          className="account-button"
          type="button"
          onClick={onConnect1AM}
          disabled={connectDisabled}
        >
          CONNECT WALLET
        </button>
        <button
          className="lace-button"
          type="button"
          onClick={onConnectLace}
          disabled={connectDisabled}
        >
          LACE
        </button>
        <button
          id="disconnect"
          className="disconnect-button"
          type="button"
          disabled={!isConnected}
          onClick={onDisconnect}
          aria-label="Disconnect wallet"
        >
          &#215;
        </button>
      </div>
    </header>
  );
}
