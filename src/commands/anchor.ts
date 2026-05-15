import { execSync } from 'child_process';
import chalk from 'chalk';
import { AlgorandService, Network } from '../core/algorand.js';
import { hashFile } from '../core/hash.js';
import { loadConfig } from '../utils/config.js';
import { unlink } from 'fs/promises';

export interface PublishOptions {
  package?: string;
  version: string;
  type: 'pre' | 'post';
  artifacts?: string;
  network?: Network;
  mnemonic?: string;
  failOnError?: boolean;
}

export async function anchorCommand(options: PublishOptions) {
  const config = await loadConfig();
  const network = options.network || config?.network || 'mainnet';
  const mnemonic = options.mnemonic || config?.mnemonic;

  if (!mnemonic) {
    console.error(chalk.red('Error: Mnemonic not found. Run "anchor init" or provide --mnemonic.'));
    process.exit(1);
  }

  const algo = new AlgorandService(network);
  const account = await algo.getAccountFromMnemonic(mnemonic);

  let artifactPaths: string[] = [];
  let isTempArtifact = false;

  if (options.artifacts) {
    artifactPaths = options.artifacts.split(',').map(s => s.trim());
  } else {
    console.log(chalk.cyan('Auto-detecting artifact via npm pack...'));
    try {
      // Run npm pack to create the tarball
      const output = execSync('npm pack --json', { encoding: 'utf-8' });
      const packInfo = JSON.parse(output);
      const filename = packInfo[0].filename;
      artifactPaths = [filename];
      isTempArtifact = true;
    } catch (error: any) {
      console.error(chalk.red(`Error running npm pack: ${error.message}`));
      if (options.failOnError) process.exit(1);
      return;
    }
  }

  const pkgName = options.package || (await import(process.cwd() + '/package.json', { with: { type: 'json' } })).default.name;
  const version = options.version;

  console.log(chalk.cyan(`Anchoring ${pkgName}@${version} (${options.type})...`));

  const results: { txIds: string[], hashes: string[] } = { txIds: [], hashes: [] };

  try {
    const notes: string[] = [];
    for (const path of artifactPaths) {
      const hash = await hashFile(path);
      results.hashes.push(hash);
      const note = `anchor:${pkgName}:${version}:${options.type}:sha256:${hash}`;
      notes.push(note);
      console.log(chalk.gray(`Artifact: ${path}`));
      console.log(chalk.gray(`Hash: sha256:${hash}`));
    }

    const txns = await algo.createAnchorTransactions(account, notes);
    const txIds = await algo.broadcastTransactions(account, txns);
    results.txIds = txIds;

    txIds.forEach((id, i) => {
      console.log(chalk.green(`✓ Anchored (TX: ${id})`));
    });

    if (isTempArtifact) {
      for (const path of artifactPaths) {
        await unlink(path).catch(() => {});
      }
    }
    
    return results;
  } catch (error: any) {
    console.error(chalk.red(`\n✗ Anchoring failed: ${error.message}`));
    if (options.failOnError) process.exit(1);
    throw error;
  }
}
