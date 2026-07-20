'use client';

interface QuickActionsProps {
  isConnected: boolean;
  onConnect1AM: () => void;
  onConnectLace: () => void;
  onDeploy: () => void;
  onProve: () => void;
  deployDisabled: boolean;
  proveDisabled: boolean;
}

export default function QuickActions({
  isConnected,
  onConnect1AM,
  onConnectLace,
  onDeploy,
  onProve,
  deployDisabled,
  proveDisabled,
}: QuickActionsProps) {
  return (
    <>
      <section className="quick-actions" aria-label="Private proof actions">
        <button
          className="quick-action"
          data-action="connect"
          type="button"
          onClick={onConnect1AM}
          disabled={isConnected}
        >
          <span className="action-icon">&#10148;</span>
          <b>CONNECT</b>
          <small>1AM OR LACE</small>
        </button>
        <button
          id="deploy"
          className="quick-action"
          type="button"
          onClick={onDeploy}
          disabled={deployDisabled}
        >
          <span className="action-icon grid-icon">&#9638;</span>
          <b>DEPLOY</b>
          <small>NEW CONTRACT</small>
        </button>
        <button
          id="prove"
          className="quick-action"
          type="button"
          onClick={onProve}
          disabled={proveDisabled}
        >
          <span className="action-icon">&#9678;</span>
          <b>PROVE</b>
          <small>PRIVATE KNOWLEDGE</small>
        </button>
      </section>

      <div className="wallet-choice">
        <span>WALLET PROVIDER</span>
        <div>
          <button
            type="button"
            data-wallet="1am"
            onClick={onConnect1AM}
            disabled={isConnected}
          >
            1AM
          </button>
          <button
            type="button"
            data-wallet="lace"
            onClick={onConnectLace}
            disabled={isConnected}
          >
            LACE
          </button>
        </div>
      </div>
    </>
  );
}
