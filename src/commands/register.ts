import chalk from 'chalk';
import { AlgorandService, Network } from '../core/algorand.js';
import { loadConfig, addPackageToConfig } from '../utils/config.js';

export async function registerCommand(pkgName: string, options: { network?: Network, mnemonic?: string }) {
  const config = await loadConfig();
  const network = options.network || config?.network || 'mainnet';
  const mnemonic = options.mnemonic || config?.mnemonic;

  if (!mnemonic) {
    console.error(chalk.red('Error: Mnemonic not found. Run "anchor init" or provide --mnemonic.'));
    process.exit(1);
  }

  const algo = new AlgorandService(network);
  const account = await algo.getAccountFromMnemonic(mnemonic);

  console.log(chalk.cyan(`Registering ${pkgName} on ${network}...`));

  try {
    const notes = [`anchor:register:${pkgName}`];
    const txns = await algo.createAnchorTransactions(account, notes);
    const txIds = await algo.broadcastTransactions(account, txns);

    console.log(chalk.green(`✓ Registered: ${pkgName} (TX: ${txIds[0]})`));
    
    // Update local config
    await addPackageToConfig(pkgName);
    
  } catch (error: any) {
    console.error(chalk.red(`\n✗ Registration failed: ${error.message}`));
    process.exit(1);
  }
}
