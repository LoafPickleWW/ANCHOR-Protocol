import algosdk from 'algosdk';
import { Network, DEFAULT_NODES } from './algorand.js';

export interface AnchorRecord {
  txId: string;
  timestamp: string;
  note: string;
  sender: string;
}

export class IndexerService {
  private client: algosdk.Indexer;

  constructor(network: Network = 'mainnet') {
    const config = DEFAULT_NODES[network];
    this.client = new algosdk.Indexer(
      config.indexerToken,
      config.indexerUrl,
      config.indexerPort
    );
  }

  async searchRegistration(wallet: string, pkgName: string): Promise<AnchorRecord[]> {
    const notePrefix = Buffer.from(`anchor:register:${pkgName}`).toString('base64');
    return this.searchNotes(wallet, notePrefix);
  }

  async searchAnchors(wallet: string, pkgName: string, version: string): Promise<AnchorRecord[]> {
    const notePrefix = Buffer.from(`anchor:${pkgName}:${version}:`).toString('base64');
    return this.searchNotes(wallet, notePrefix);
  }

  private async searchNotes(wallet: string, notePrefixBase64: string): Promise<AnchorRecord[]> {
    // Note: Indexer's note-prefix search works on base64 encoded prefixes
    const search = this.client.searchForTransactions()
      .address(wallet)
      .addressRole('sender')
      .notePrefix(new Uint8Array(Buffer.from(notePrefixBase64, 'base64')))
      .do();

    const results = await search;
    
    return (results.transactions || []).map((tx: any) => ({
      txId: tx.id,
      timestamp: tx['round-time'] ? new Date(tx['round-time'] * 1000).toISOString() : 'pending',
      note: tx.note ? Buffer.from(tx.note, 'base64').toString('utf-8') : '',
      sender: tx.sender,
    }));
  }
}
