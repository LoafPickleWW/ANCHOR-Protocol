#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { registerCommand } from './commands/register.js';
import { anchorCommand } from './commands/anchor.js';
import { verifyCommand } from './commands/verify.js';
import { readFile } from 'fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const program = new Command();

program
  .name('anchor')
  .description('Algorand Native Cryptographic Hash Origin Record — Supply Chain Integrity')
  .version(pkg.version, '-V, --version');

program
  .command('init')
  .description('Onboard as a developer and set up your signing wallet')
  .option('-n, --network <network>', 'Algorand network (mainnet or testnet)', 'mainnet')
  .action(initCommand);

program
  .command('register')
  .description('Register a package name to your signing wallet')
  .argument('<package>', 'Package name')
  .option('-n, --network <network>', 'Algorand network (mainnet or testnet)')
  .option('-m, --mnemonic <mnemonic>', 'Signing wallet mnemonic')
  .action(registerCommand);

program
  .command('publish')
  .alias('anchor')
  .description('Broadcast anchor transactions for a release artifact')
  .requiredOption('-r, --release <version>', 'Package version being published')
  .option('-p, --package <package>', 'Package name (auto-detects if omitted)')
  .option('-t, --type <type>', 'Anchor type (pre or post)', 'post')
  .option('-a, --artifacts <artifacts>', 'Explicit artifact paths (comma separated)')
  .option('-n, --network <network>', 'Algorand network (mainnet or testnet)')
  .option('-m, --mnemonic <mnemonic>', 'Signing wallet mnemonic')
  .option('--fail-on-error', 'Exit with code 1 if anchoring fails', false)
  .action(anchorCommand);

program
  .command('verify')
  .description('Verify the integrity of a package version')
  .argument('<package>', 'Package name')
  .argument('<version>', 'Package version')
  .option('-n, --network <network>', 'Algorand network (mainnet or testnet)', 'mainnet')
  .option('-w, --wallet <wallet>', 'Override signing wallet address')
  .option('-f, --file <file>', 'Local file to verify against')
  .option('--strict', 'Treat partial or unenrolled states as failures', false)
  .option('--json', 'Output results in JSON format', false)
  .option('--skip-npm', 'Skip npm registry check (for testing)', false)
  .option('--skip-chain', 'Skip blockchain registration check (for testing)', false)
  .action(verifyCommand);

program.parse();
