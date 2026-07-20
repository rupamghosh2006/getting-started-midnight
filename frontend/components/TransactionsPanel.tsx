'use client';

import { useState } from 'react';

interface Transaction {
  type: 'deployment' | 'proof';
  txId: string;
  timestamp: string;
  status: 'confirmed' | 'pending';
}

interface TransactionsPanelProps {
  transactions: Transaction[];
}

function shorten(value: string, start = 9, end = 8) {
  return value && value.length > start + end
    ? `${value.slice(0, start)}...${value.slice(-end)}`
    : value;
}

function explorerUrl(txId: string) {
  return `https://explorer.1am.xyz/tx/${txId}?network=preprod`;
}

export default function TransactionsPanel({ transactions }: TransactionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = transactions.filter((tx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      tx.txId.toLowerCase().includes(q) ||
      tx.type.toLowerCase().includes(q) ||
      tx.status.toLowerCase().includes(q)
    );
  });

  return (
    <section className="transactions-panel" aria-labelledby="transactions-title">
      <div className="transaction-search">
        <label htmlFor="transaction-search" className="sr-only">
          Search transactions
        </label>
        <input
          id="transaction-search"
          type="search"
          placeholder="Search by hash, method, contract..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="transaction-head">
        <span id="transactions-title">TRANSACTION</span>
        <span>METHOD</span>
        <span>STATUS</span>
      </div>

      {filtered.length === 0 ? (
        <p className="receipt-line">
          {searchQuery ? 'No transactions match your search.' : 'No transactions yet. Connect and deploy to get started.'}
        </p>
      ) : (
        filtered.map((tx, i) => (
          <article
            key={`${tx.type}-${i}`}
            className="transaction-row"
            data-search={`${tx.type} ${tx.txId} ${tx.status}`}
          >
            <span className="chevron">&#8250;</span>
            <span className="transaction-glyph">&#8942;</span>
            <div className="transaction-data">
              <time>{tx.timestamp}</time>
              <a
                href={tx.txId.length > 20 ? explorerUrl(tx.txId) : '#top'}
                target="_blank"
                rel="noreferrer"
              >
                {shorten(tx.txId, 8, 8)}
              </a>
              <span>copy</span>
            </div>
            <div className="method-data">
              <b>
                {tx.type === 'deployment'
                  ? 'Smart contract deployment'
                  : 'Private knowledge proof'}
              </b>
              <span>
                {tx.type === 'deployment'
                  ? 'PRIVATE_PROOF_DEPLOY'
                  : 'PROVE_PRIVATE_KNOWLEDGE'}
                &nbsp;&middot; localhost:5173
              </span>
            </div>
            <span className={`tx-status ${tx.status}`}>
              <i></i> {tx.status === 'confirmed' ? 'CONFIRMED' : 'SUBMITTED'}
            </span>
          </article>
        ))
      )}

      {transactions.length > 0 && (
        <p id="receipt-result" className="receipt-line">
          Latest: {transactions[transactions.length - 1].type} &middot;{' '}
          {shorten(transactions[transactions.length - 1].txId, 8, 8)} &middot;{' '}
          {transactions[transactions.length - 1].status}
        </p>
      )}
    </section>
  );
}
