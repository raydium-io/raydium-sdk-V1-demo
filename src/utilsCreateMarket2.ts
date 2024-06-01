import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionSignature } from "@solana/web3.js";
import { TokenInstructions, Market as MarketSerum, DexInstructions } from '@project-serum/serum';
import { SPL_MINT_LAYOUT } from "@raydium-io/raydium-sdk";

interface SerumMarketInfo {
  market: PublicKey;
  requestQueue: PublicKey;
  eventQueue: PublicKey;
  bids: PublicKey;
  asks: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseLotSize: anchor.BN;
  quoteLotSize: anchor.BN;
  feeRateBps: number;
  vaultOwner: PublicKey;
  vaultSignerNonce: anchor.BN;
  quoteDustThreshold: any;
  programId: any;
}
  
class Market extends MarketSerum {
  public baseVault: PublicKey | null = null;
  public quoteVault: PublicKey | null = null;
  public requestQueue: PublicKey | null = null;
  public eventQueue: PublicKey | null = null;
  public bids: PublicKey | null = null;
  public asks: PublicKey | null = null;
  public baseLotSize: number = 0;
  public quoteLotSize: number = 0;
  // private _decoded: any
  public quoteMint: PublicKey | null = null;
  public baseMint: PublicKey | null = null;
  public vaultSignerNonce: Number | null = null;

  static async load(
    connection: Connection,
    address: PublicKey,
    options: any = {},
    programId: PublicKey
  ) {
    const { owner, data } = throwIfNull(
    await connection.getAccountInfo(address),
    "Market not found"
    );
    if (!owner.equals(programId)) {
    throw new Error("Address not owned by program: " + owner.toBase58());
    }
    const decoded = this.getLayout(programId).decode(data);
    if (
    !decoded.accountFlags.initialized ||
    !decoded.accountFlags.market ||
    !decoded.ownAddress.equals(address)
    ) {
    throw new Error("Invalid market");
    }
    const [baseMintDecimals, quoteMintDecimals] = await Promise.all([
    getMintDecimals(connection, decoded.baseMint),
    getMintDecimals(connection, decoded.quoteMint),
    ]);

    const market = new Market(
    decoded,
    baseMintDecimals,
    quoteMintDecimals,
    options,
    programId
    );
    // market._decoded = decoded
    market.baseLotSize = decoded.baseLotSize;
    market.quoteLotSize = decoded.quoteLotSize;
    market.baseVault = decoded.baseVault;
    market.quoteVault = decoded.quoteVault;
    market.requestQueue = decoded.requestQueue;
    market.eventQueue = decoded.eventQueue;
    market.bids = decoded.bids;
    market.asks = decoded.asks;
    market.quoteMint = decoded.quoteMint;
    market.baseMint = decoded.baseMint;
    market.vaultSignerNonce = decoded.vaultSignerNonce;
    return market;
  }
}
  
async function getVaultOwnerAndNonce(
  marketId: PublicKey,
  dexProgramId: PublicKey
  ) {
  const vaultNonce = new anchor.BN(0);
  while (true) {
    try {
    const vaultOwner = await PublicKey.createProgramAddress(
        [marketId.toBuffer(), vaultNonce.toArrayLike(Buffer, "le", 8)],
        dexProgramId
    );
    return { vaultOwner, vaultNonce };
    } catch (e) {
    vaultNonce.iaddn(1);
    }
  }
}
  
function throwIfNull<T>(value: T | null, message = "account not found"): T {
  if (value === null) {
    throw new Error(message);
  }
  return value;
}
  
const getUnixTs = () => {
  return new Date().getTime() / 1000;
};
  
async function getMintDecimals(
  connection: Connection,
  mint: PublicKey
  ): Promise<number> {
  const { data } = throwIfNull(
    await connection.getAccountInfo(mint),
    "mint not found"
  );
  const { decimals } = SPL_MINT_LAYOUT.decode(data);
  return decimals;
}
  
async function signTransactions({
  transactionsAndSigners,
  wallet,
  connection,
  }: {
    transactionsAndSigners: {
      transaction: Transaction;
      signers?: Array<Keypair>;
    }[];
    wallet: anchor.Wallet;
    connection: Connection;
  }) {
    const blockhash = (await connection.getRecentBlockhash("max")).blockhash;
    transactionsAndSigners.forEach(({ transaction, signers = [] }) => {
      transaction.recentBlockhash = blockhash;
      transaction.setSigners(
        wallet.publicKey,
        ...signers.map((s) => s.publicKey)
      );
      if (signers?.length > 0) {
        transaction.partialSign(...signers);
      }
    });
    return await wallet.signAllTransactions(
      transactionsAndSigners.map(({ transaction }) => transaction)
    );
}
  
async function sendSignedTransaction({
    signedTransaction,
    connection,
    timeout = 10000,
  }: {
    signedTransaction: Transaction;
    connection: Connection;
    timeout?: number;
  }): Promise<string> {
    const rawTransaction = signedTransaction.serialize();
    const startTime = getUnixTs();
  
    const txid: TransactionSignature = await connection.sendRawTransaction(
      rawTransaction,
      {
        skipPreflight: true,
      }
    );

    await connection.confirmTransaction(txid);
    
    return txid;
}
  
export async function createMarket({
  connection,
  wallet,
  baseMint,
  quoteMint,
  baseLotSize,
  quoteLotSize,
  dexProgram,
  market,
  }: {
    connection: Connection;
    wallet: anchor.Wallet;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    baseLotSize: number;
    quoteLotSize: number;
    dexProgram: PublicKey;
    market: Keypair;
  }): Promise<SerumMarketInfo> {
    const requestQueue = new Keypair();
    const eventQueue = new Keypair();
    const bids = new Keypair();
    const asks = new Keypair();
    const baseVault = new Keypair();
    const quoteVault = new Keypair();
    const feeRateBps = 0;
    const quoteDustThreshold = new anchor.BN(10);
    const { vaultOwner, vaultNonce } = await getVaultOwnerAndNonce(
      market.publicKey,
      dexProgram
    );
  
    const tx1 = new Transaction();
    tx1.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: baseVault.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(165),
        space: 165,
        programId: TokenInstructions.TOKEN_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: quoteVault.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(165),
        space: 165,
        programId: TokenInstructions.TOKEN_PROGRAM_ID,
      }),
      TokenInstructions.initializeAccount({
        account: baseVault.publicKey,
        mint: baseMint,
        owner: vaultOwner,
      }),
      TokenInstructions.initializeAccount({
        account: quoteVault.publicKey,
        mint: quoteMint,
        owner: vaultOwner,
      })
    );
  
    const tx2 = new Transaction();
    tx2.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: market.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(
          Market.getLayout(dexProgram).span
        ),
        space: Market.getLayout(dexProgram).span,
        programId: dexProgram,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: requestQueue.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(5120 + 12),
        space: 5120 + 12,
        programId: dexProgram,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: eventQueue.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(262144 + 12),
        space: 262144 + 12,
        programId: dexProgram,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: bids.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
        space: 65536 + 12,
        programId: dexProgram,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: asks.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
        space: 65536 + 12,
        programId: dexProgram,
      }),
      DexInstructions.initializeMarket({
        market: market.publicKey,
        requestQueue: requestQueue.publicKey,
        eventQueue: eventQueue.publicKey,
        bids: bids.publicKey,
        asks: asks.publicKey,
        baseVault: baseVault.publicKey,
        quoteVault: quoteVault.publicKey,
        baseMint,
        quoteMint,
        baseLotSize: new anchor.BN(baseLotSize),
        quoteLotSize: new anchor.BN(quoteLotSize),
        feeRateBps,
        vaultSignerNonce: vaultNonce,
        quoteDustThreshold,
        programId: dexProgram,
        authority: undefined,
      })
    );
  
    const signedTransactions = await signTransactions({
      transactionsAndSigners: [
        { transaction: tx1, signers: [baseVault, quoteVault] },
        {
          transaction: tx2,
          signers: [market, requestQueue, eventQueue, bids, asks],
        },
      ],
      wallet,
      connection: connection,
    });
    for (let signedTransaction of signedTransactions) {
      await sendSignedTransaction({
        signedTransaction,
        connection: connection,
      });
    }
  
    return {
      market: market.publicKey,
      requestQueue: requestQueue.publicKey,
      eventQueue: eventQueue.publicKey,
      bids: bids.publicKey,
      asks: asks.publicKey,
      baseVault: baseVault.publicKey,
      quoteVault: quoteVault.publicKey,
      baseMint,
      quoteMint,
      baseLotSize: new anchor.BN(baseLotSize),
      quoteLotSize: new anchor.BN(quoteLotSize),
      feeRateBps,
      vaultOwner,
      vaultSignerNonce: vaultNonce,
      quoteDustThreshold,
      programId: dexProgram,
      // authority: undefined,
    };
}