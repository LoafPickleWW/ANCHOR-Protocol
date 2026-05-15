import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface AnchorConfig {
  wallet: string;
  mnemonic: string;
  network: 'mainnet' | 'testnet';
  packages: string[];
}

const CONFIG_DIR = join(homedir(), '.anchor');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export async function saveConfig(config: AnchorConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export async function loadConfig(): Promise<AnchorConfig | null> {
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as AnchorConfig;
  } catch (error) {
    return null;
  }
}

export async function addPackageToConfig(pkg: string): Promise<void> {
  const config = await loadConfig();
  if (config) {
    if (!config.packages.includes(pkg)) {
      config.packages.push(pkg);
      await saveConfig(config);
    }
  }
}
