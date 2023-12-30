import {
  ComputeBudgetConfig,
  InnerSimpleV0Transaction,
  TxVersion,
  buildSimpleTransaction,
} from "@raydium-io/raydium-sdk";
import {
  Connection,
  Keypair,
  SendOptions,
  Signer,
  Transaction,
  VersionedTransaction
} from "@solana/web3.js";
import axios from "axios";
import { addLookupTableInfo } from "../../config";

interface SolanaFeeInfo {
  min: number;
  max: number;
  avg: number;
  priorityTx: number;
  nonVotes: number;
  priorityRatio: number;
  avgCuPerBlock: number;
  blockspaceUsageRatio: number;
}
type SolanaFeeInfoJson = {
  "1": SolanaFeeInfo;
  "5": SolanaFeeInfo;
  "15": SolanaFeeInfo;
};

export async function getComputeBudgetConfig(): Promise<
  ComputeBudgetConfig | undefined
> {
  const { data } = await axios.get<SolanaFeeInfoJson>(
    `https://solanacompass.com/api/fees?cacheFreshTime=${5 * 60 * 1000}`
  );
  const { avg } = data?.[15] ?? {};
  if (!avg) return undefined; // fetch error
  return {
    units: 400000,
    microLamports: Math.min(Math.ceil((avg * 1000000) / 400000), 25000),
  } as ComputeBudgetConfig;
}

export async function sendTx(
  connection: Connection,
  payer: Keypair | Signer,
  txs: (VersionedTransaction | Transaction)[],
  options?: SendOptions
): Promise<string[]> {
  const txids: string[] = [];
  for (const iTx of txs) {
    if (iTx instanceof VersionedTransaction) {
      iTx.sign([payer]);
      txids.push(await connection.sendTransaction(iTx, options));
    } else {
      txids.push(await connection.sendTransaction(iTx, [payer], options));
    }
  }
  return txids;
}

export async function buildAndSendTx({
  connection,
  makeTxVersion,
  owner,
  innerSimpleV0Transaction,
}: {
  connection: Connection;
  makeTxVersion: TxVersion;
  owner: Keypair | Signer;
  innerSimpleV0Transaction: InnerSimpleV0Transaction[];
}) {
  const willSendTx = await buildSimpleTransaction({
    connection,
    makeTxVersion,
    payer: owner.publicKey,
    innerTransactions: innerSimpleV0Transaction,
    addLookupTableInfo: addLookupTableInfo,
  });

  return await sendTx(connection, owner, willSendTx);
}
