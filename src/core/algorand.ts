import algosdk from 'algosdk';

export type Network = 'mainnet' | 'testnet';

export interface AlgorandConfig {
  nodeUrl: string;
  nodePort: string;
  nodeToken: string;
  indexerUrl: string;
  indexerPort: string;
  indexerToken: string;
}

export const DEFAULT_NODES: Record<Network, AlgorandConfig> = {
  mainnet: {
    nodeUrl: 'https://mainnet-api.4160.nodely.dev',
    nodePort: '',
    nodeToken: '',
    indexerUrl: 'https://mainnet-idx.4160.nodely.dev',
    indexerPort: '',
    indexerToken: '',
  },
  testnet: {
    nodeUrl: 'https://testnet-api.4160.nodely.dev',
    nodePort: '',
    nodeToken: '',
    indexerUrl: 'https://testnet-idx.4160.nodely.dev',
    indexerPort: '',
    indexerToken: '',
  },
};

export class AlgorandService {
  private client: algosdk.Algodv2;
  private network: Network;

  constructor(network: Network = 'mainnet', config?: Partial<AlgorandConfig>) {
    this.network = network;
    const baseConfig = DEFAULT_NODES[network];
    const finalConfig = { ...baseConfig, ...config };

    this.client = new algosdk.Algodv2(
      finalConfig.nodeToken,
      finalConfig.nodeUrl,
      finalConfig.nodePort
    );
  }

  async getAccountFromMnemonic(mnemonic: string): Promise<algosdk.Account> {
    return algosdk.mnemonicToSecretKey(mnemonic);
  }

  async generateNewAccount(): Promise<{ address: string; mnemonic: string }> {
    const account = algosdk.generateAccount();
    const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
    return { address: account.addr.toString(), mnemonic };
  }

  async getBalance(address: string): Promise<number> {
    const accountInfo = await this.client.accountInformation(address).do();
    return Number(accountInfo.amount); // amount is in microAlgos
  }

  async createAnchorTransactions(
    sender: algosdk.Account,
    notes: string[]
  ): Promise<algosdk.Transaction[]> {
    const params = await this.client.getTransactionParams().do();
    
    return notes.map((note) => {
      return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: sender.addr.toString(),
        receiver: sender.addr.toString(),
        amount: 0,
        note: new TextEncoder().encode(note),
        suggestedParams: params,
      });
    });
  }

  async broadcastTransactions(
    sender: algosdk.Account,
    txns: algosdk.Transaction[]
  ): Promise<string[]> {
    if (txns.length > 1) {
      algosdk.assignGroupID(txns);
    }

    const signedTxns = txns.map((txn) => txn.signTxn(sender.sk));
    const response = await this.client.sendRawTransaction(signedTxns).do();
    const txId = response.txid;
    
    // Wait for confirmation
    await algosdk.waitForConfirmation(this.client, txId, 4);
    
    return txns.map(t => t.txID());
  }
}
