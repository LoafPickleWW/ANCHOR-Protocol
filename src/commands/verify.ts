import chalk from 'chalk';
import { getPackageMetadata, downloadTarball } from '../core/npm.js';
import { IndexerService } from '../core/indexer.js';
import { hashBuffer } from '../core/hash.js';
import { Network } from '../core/algorand.js';

export interface VerifyOptions {
  strict?: boolean;
  json?: boolean;
  network?: Network;
  skipNpm?: boolean;
  skipChain?: boolean;
  wallet?: string;
  file?: string;
}

export async function verifyCommand(pkgName: string, version: string, options: VerifyOptions) {
  const network = options.network || 'mainnet';
  const indexer = new IndexerService(network);

  const report: any = {
    package: pkgName,
    version,
    network,
    status: 'unenrolled',
    warnings: [],
  };

  try {
    // 1. Resolve signing wallet
    let npmWallet = options.wallet || '';
    if (!npmWallet && !options.skipNpm) {
      const metadata = await getPackageMetadata(pkgName, version);
      npmWallet = metadata.anchor?.wallet || '';
      report.npm_wallet = npmWallet;
      
      if (!npmWallet) {
        return emitResult(report, options);
      }
    } else if (options.wallet) {
      report.npm_wallet = npmWallet;
    }

    // 2. Cross-validate on-chain
    let chainWallet = '';
    if (!options.skipChain) {
      const registrations = await indexer.searchRegistration(npmWallet, pkgName);
      if (registrations.length === 0) {
        return emitResult(report, options);
      }
      chainWallet = registrations[0].sender;
      report.chain_wallet = chainWallet;
    }

    // 3. Compare wallets
    if (npmWallet && chainWallet && npmWallet !== chainWallet) {
      report.status = 'failed';
      report.cross_validation_error = true;
      return emitResult(report, options);
    }
    report.cross_validated = true;

    // 4. Fetch and hash artifact
    let localHash = '';
    if (options.file) {
      const fs = await import('fs/promises');
      const content = await fs.readFile(options.file);
      localHash = hashBuffer(content);
    } else {
      const metadata = await getPackageMetadata(pkgName, version);
      const tarballBuffer = await downloadTarball(metadata.dist.tarball);
      localHash = hashBuffer(tarballBuffer);
    }
    report.local_hash = `sha256:${localHash}`;

    // 5. Look up anchor transactions
    const anchors = await indexer.searchAnchors(chainWallet || npmWallet, pkgName, version);
    
    const preAnchor = anchors.find(a => a.note.includes(':pre:'));
    const postAnchor = anchors.find(a => a.note.includes(':post:'));

    if (preAnchor) {
      const chainHash = preAnchor.note.split(':sha256:')[1];
      report.pre_publish = {
        found: true,
        hash_match: chainHash === localHash,
        tx_id: preAnchor.txId,
        timestamp: preAnchor.timestamp,
      };
    } else {
      report.pre_publish = { found: false };
    }

    if (postAnchor) {
      const chainHash = postAnchor.note.split(':sha256:')[1];
      const match = chainHash === localHash;
      report.post_publish = {
        found: true,
        hash_match: match,
        tx_id: postAnchor.txId,
        timestamp: postAnchor.timestamp,
      };

      if (match) {
        report.status = report.pre_publish.found ? 'verified' : 'partial';
      } else {
        report.status = 'failed';
      }
    } else {
      report.post_publish = { found: false };
      report.status = 'unenrolled'; // Or "unanchored"
    }

    return emitResult(report, options);

  } catch (error: any) {
    console.error(chalk.red(`\nVerification error: ${error.message}`));
    process.exit(1);
  }
}

function emitResult(report: any, options: VerifyOptions) {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTerminalReport(report);
  }

  if (report.status === 'failed' || report.cross_validation_error) {
    process.exit(1);
  }
  if (options.strict && (report.status === 'partial' || report.status === 'unenrolled')) {
    process.exit(1);
  }
}

function printTerminalReport(report: any) {
  const { status, package: pkg, version } = report;

  if (status === 'verified') {
    console.log(chalk.green(`\n✓ ANCHOR VERIFIED  ${pkg}@${version}\n`));
  } else if (status === 'partial') {
    console.log(chalk.yellow(`\n~ ANCHOR PARTIAL  ${pkg}@${version}\n`));
  } else if (status === 'failed') {
    if (report.cross_validation_error) {
      console.log(chalk.red(`\n✗ ANCHOR CROSS-VALIDATION FAILED  ${pkg}@${version}\n`));
    } else {
      console.log(chalk.red(`\n✗ ANCHOR FAILED  ${pkg}@${version}\n`));
    }
  } else {
    console.log(chalk.gray(`\n○ ANCHOR UNENROLLED  ${pkg}@${version}\n`));
    console.log(`  No on-chain signing identity found for ${pkg}.`);
    return;
  }

  console.log(`  Signing wallet   ${report.chain_wallet || report.npm_wallet}`);
  console.log(`  Cross-validated  ${report.cross_validated ? chalk.green('✓ npm + chain agree') : chalk.red('✗ MISMATCH')}`);
  
  if (report.pre_publish) {
    console.log(`  Pre-publish      ${report.pre_publish.found ? (report.pre_publish.hash_match ? chalk.green('✓') : chalk.red('✗')) + ` TX: ${report.pre_publish.tx_id}` : chalk.gray('— not found')}`);
  }
  
  if (report.post_publish) {
    console.log(`  Post-publish     ${report.post_publish.found ? (report.post_publish.hash_match ? chalk.green('✓') : chalk.red('✗')) + ` TX: ${report.post_publish.tx_id}` : chalk.gray('— not found')}`);
  }

  console.log(`  Local hash       ${report.local_hash}`);
  
  if (status === 'failed') {
    console.log(chalk.red(`\n  What npm served does not match what the author anchored.`));
    console.log(`  Do not use this package until the discrepancy is resolved.`);
  } else if (status === 'partial') {
    console.log(`\n  Post-publish anchor matches. No pre-publish record found.`);
  } else if (status === 'verified') {
    console.log(`\n  What was published is what you downloaded.`);
  }
}
