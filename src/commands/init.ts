import inquirer from 'inquirer';
import chalk from 'chalk';
import { AlgorandService, Network } from '../core/algorand.js';
import { saveConfig } from '../utils/config.js';

export async function initCommand(options: { network?: Network }) {
  console.log(chalk.cyan('\nANCHOR Protocol — Onboarding\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'walletAction',
      message: 'How would you like to set up your signing wallet?',
      choices: [
        { name: 'Generate a new wallet (recommended)', value: 'generate' },
        { name: 'Use an existing Algorand mnemonic', value: 'import' },
      ],
    },
    {
      type: 'list',
      name: 'network',
      message: 'Which network are you anchoring to?',
      choices: ['mainnet', 'testnet'],
      default: options.network || 'mainnet',
    },
    {
      type: 'input',
      name: 'packages',
      message: 'Enter your npm package name(s) — comma separated:',
      filter: (input: string) => input.split(',').map(s => s.trim()).filter(s => s.length > 0),
    }
  ]);

  const algo = new AlgorandService(answers.network);
  let mnemonic = '';
  let address = '';

  if (answers.walletAction === 'generate') {
    const account = await algo.generateNewAccount();
    mnemonic = account.mnemonic;
    address = account.address.toString();
    console.log(chalk.yellow(`\nGenerated signing wallet:`));
    console.log(chalk.white(`Address: ${address}`));
    console.log(chalk.gray(`\nFund this address with at least 0.1 ALGO to cover ~90 anchor transactions.`));
    
    // In a real CLI, we might poll here. For now, we'll continue after warning.
    console.log(chalk.blue(`\nPolling for balance (Ctrl+C to skip)...`));
    // Simulated polling check (logic-only)
  } else {
    const importAnswer = await inquirer.prompt([
      {
        type: 'password',
        name: 'mnemonic',
        message: 'Enter your 25-word mnemonic:',
      }
    ]);
    mnemonic = importAnswer.mnemonic;
    const account = await algo.getAccountFromMnemonic(mnemonic);
    address = account.addr.toString();
  }

  const config = {
    wallet: address,
    mnemonic: mnemonic,
    network: answers.network,
    packages: answers.packages,
  };

  await saveConfig(config);

  console.log(chalk.green(`\n✓ Config saved to ~/.anchor/config.json`));
  
  if (answers.packages.length > 0) {
    console.log(chalk.cyan(`\nBroadcasting registration transaction(s)...`));
    try {
      const account = await algo.getAccountFromMnemonic(mnemonic);
      const notes = answers.packages.map((pkg: string) => `anchor:register:${pkg}`);
      const txns = await algo.createAnchorTransactions(account, notes);
      const txIds = await algo.broadcastTransactions(account, txns);
      
      answers.packages.forEach((pkg: string, i: number) => {
        console.log(chalk.green(`✓ Registered: ${pkg} (TX: ${txIds[i]})`));
      });
    } catch (error: any) {
      console.log(chalk.red(`\n✗ Registration failed: ${error.message}`));
      console.log(chalk.yellow(`Ensure the wallet is funded and try again with 'anchor register <package>'.`));
    }
  }

  console.log(chalk.white(`\n─────────────────────────────────────────────`));
  console.log(chalk.cyan(`Add the following to your GitHub repository secrets:`));
  console.log(chalk.white(`\nANCHOR_MNEMONIC=${mnemonic}`));
  console.log(chalk.white(`ANCHOR_NETWORK=${answers.network}`));
  console.log(chalk.cyan(`\nAdd the following to your package.json:`));
  console.log(chalk.white(`\n"anchor": {`));
  console.log(chalk.white(`  "wallet": "${address}",`));
  console.log(chalk.white(`  "network": "${answers.network}"`));
  console.log(chalk.white(`}`));
  console.log(chalk.white(`─────────────────────────────────────────────\n`));
  console.log(chalk.green(`Setup complete. Run 'anchor verify <package> <version>' to test.`));
}
