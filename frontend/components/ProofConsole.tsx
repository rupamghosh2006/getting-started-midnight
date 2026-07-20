'use client';

interface ProofConsoleProps {
  contractAddress: string;
  status: string;
  isError: boolean;
  disabled: boolean;
  secretPhrase: string;
  onSecretChange: (value: string) => void;
  onProve: () => void;
}

export default function ProofConsole({
  contractAddress,
  status,
  isError,
  disabled,
  secretPhrase,
  onSecretChange,
  onProve,
}: ProofConsoleProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (secretPhrase) onProve();
  };

  return (
    <section className="proof-console" aria-labelledby="proof-title">
      <div className="console-heading">
        <div>
          <span className="micro-label">PRIVATE CIRCUIT</span>
          <h1 id="proof-title">Prove private knowledge</h1>
        </div>
        <span className="privacy-chip">INPUT STAYS LOCAL</span>
      </div>
      <form className="console-grid" onSubmit={handleSubmit}>
        <label className="secret-control" htmlFor="secret">
          <span>ACCESS PHRASE <em>NEVER PERSISTED</em></span>
          <input
            id="secret"
            type="password"
            name="secret"
            autoComplete="off"
            spellCheck={false}
            placeholder="Enter the private phrase"
            disabled={disabled}
            value={secretPhrase}
            onChange={(e) => onSecretChange(e.target.value)}
          />
        </label>
        <div className="contract-control">
          <span>CONTRACT ADDRESS</span>
          <code id="contract-address">
            {contractAddress || 'Connect a wallet, then deploy to Preprod'}
          </code>
        </div>
        <div id="status" className={`status-line${isError ? ' error' : ''}`} role="status">
          {status}
        </div>
      </form>
    </section>
  );
}
