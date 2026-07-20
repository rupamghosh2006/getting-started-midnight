'use client';

interface BalanceGridProps {
  proofCount: number;
  contractAddress: string;
  isConnected: boolean;
  walletAddress: string;
}

function shorten(value: string, start = 9, end = 8) {
  return value && value.length > start + end
    ? `${value.slice(0, start)}...${value.slice(-end)}`
    : value;
}

export default function BalanceGrid({
  proofCount,
  contractAddress,
  isConnected,
  walletAddress,
}: BalanceGridProps) {
  return (
    <section className="balance-grid" aria-label="Private proof account overview">
      <article className="balance-card hatch">
        <div className="card-label">
          <span>&#9673;</span> ZK PROOF RECEIPTS <small>PRIVATE &#9678;</small>
        </div>
        <strong id="proof-count" className="balance-value">
          {proofCount}
        </strong>
        <p id="proof-count-note">
          {proofCount > 0
            ? 'Accepted proofs on this contract'
            : 'No proofs submitted yet'}
        </p>
      </article>

      <article className="balance-card">
        <div className="card-label">
          <span>&#9674;</span> PREPROD CONTRACT <small>LIVE &#9678;</small>
        </div>
        <strong className="balance-value mono contract-dot">
          {contractAddress ? '1' : '0'}
        </strong>
        <p id="contract-address-short" className="address-note">
          {contractAddress ? shorten(contractAddress, 12, 10) : 'No contract deployed'}
        </p>
      </article>

      <article className="balance-card">
        <div className="card-label">
          <span>&#10045;</span> WALLET CONNECTION{' '}
          <small id="wallet-visibility">{isConnected ? 'LIVE' : 'HIDE'} &#9678;</small>
        </div>
        <strong id="wallet-state" className="balance-value mono">
          {isConnected ? 'ON' : 'OFF'}
        </strong>
        <p id="wallet-address" title={isConnected ? walletAddress : undefined}>
          {isConnected ? shorten(walletAddress, 13, 9) : 'No wallet connected'}
        </p>
      </article>
    </section>
  );
}
