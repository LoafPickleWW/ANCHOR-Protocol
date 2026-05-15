import * as core from '@actions/core';
import { anchorCommand } from '../src/commands/anchor.js';

async function run() {
  try {
    const mnemonic = core.getInput('mnemonic', { required: true });
    const version = core.getInput('version') || process.env.GITHUB_REF_NAME || '';
    const type = core.getInput('type') as 'pre' | 'post';
    const artifacts = core.getInput('artifacts');
    const network = core.getInput('network') as 'mainnet' | 'testnet';
    const failOnError = core.getInput('fail-on-error') === 'true';

    // We need to capture the output of anchorCommand or modify it to return values
    // For now, we'll just run it. To support outputs, we'd need to refactor 
    // anchorCommand to return the txIds and hashes.
    
    const results = await anchorCommand({
      version,
      type,
      artifacts,
      network,
      mnemonic,
      failOnError
    });

    if (results) {
      core.setOutput('tx-ids', results.txIds.join(','));
      core.setOutput('hashes', results.hashes.join(','));
    }

  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
