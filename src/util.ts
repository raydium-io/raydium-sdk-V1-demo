import {
  buildSimpleTransaction,
  InnerSimpleV0Transaction,
  SPL_ACCOUNT_LAYOUT,
  TOKEN_PROGRAM_ID,
  TokenAccount,
} from '@raydium-io/raydium-sdk';
import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  connection,
  makeTxVersion,
  wallet,
} from '../config';

export async function sendTx(
  connection: Connection,
  payer: Keypair,
  txs: VersionedTransaction[],
  options?: SendOptions
): Promise<string[]> {
  const txids: string[] = [];
  for (const iTx of txs) {
    (iTx as VersionedTransaction).sign([payer]);
    txids.push(await connection.sendTransaction(iTx as VersionedTransaction, options));
  }
  return txids;
}

export async function getWalletTokenAccount(connection: Connection, wallet: PublicKey): Promise<TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}

export async function buildAndSendTx(innerSimpleV0Transaction: InnerSimpleV0Transaction[]) {
  const willSendTx = await buildSimpleTransaction({
    connection,
    makeTxVersion,
    payer: wallet.publicKey,
    innerTransactions: innerSimpleV0Transaction,
  })

  return await sendTx(connection, wallet, willSendTx)
}