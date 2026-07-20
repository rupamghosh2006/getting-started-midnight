/** Read-only verification through the public Preprod indexer. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { getDeployment, NETWORK_CONFIGS } from './network';

async function main(): Promise<void> {
  const deployment = getDeployment('preprod');
  if (!deployment) throw new Error('No Preprod deployment is recorded. Deploy with `npm run deploy -- --network preprod` first.');
  if (!/^[0-9a-f]{32,}$/i.test(deployment.address)) throw new Error('Recorded Preprod contract address is malformed.');

  const config = NETWORK_CONFIGS.preprod;
  const provider = indexerPublicDataProvider(config.indexer, config.indexerWS);
  const state = await provider.queryContractState(deployment.address);
  if (!state) throw new Error(`Preprod indexer has no state for ${deployment.address}. Wait for indexing, then retry.`);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const artifact = path.resolve(here, '..', 'contracts', 'managed', 'hello-world', 'contract', 'index.js');
  if (!fs.existsSync(artifact)) throw new Error('Compiled contract artifact missing. Run `npm run compile`.');
  const contract = await import(pathToFileURL(artifact).href);
  const ledger = contract.ledger(state.data) as { latestProofAccepted: boolean; successfulProofs: unknown };

  console.log('Preprod contract verified through the public indexer');
  console.log(`Address: ${deployment.address}`);
  console.log(`Explorer: https://preprod.midnightexplorer.com/search?q=${deployment.address}`);
  console.log(`Latest proof accepted: ${ledger.latestProofAccepted}`);
  console.log(`Successful proof counter: ${String(ledger.successfulProofs)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
