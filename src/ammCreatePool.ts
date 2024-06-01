import { BN } from 'bn.js';

import {
  Liquidity,
  Token,
} from '@raydium-io/raydium-sdk';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  FEE_DESTINATION,
  makeTxVersion,
  PROGRAMIDS,
  wallet,
} from '../config';
import {
  buildAndSendTx,
  generateMint,
  getWalletTokenAccount,
  mintToAta,
} from './util';
import Decimal from 'decimal.js';
import { createMarket } from './utilsCreateMarket2';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';

const ZERO = new BN(0)
type BN = typeof ZERO

type CalcStartPrice = {
  addBaseAmount: BN
  addQuoteAmount: BN
}

type LiquidityPairTargetInfo = {
  baseToken: Token
  quoteToken: Token
  targetMarketId: PublicKey
}

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = LiquidityPairTargetInfo &
  CalcStartPrice & {
    startTime: number // seconds
    walletTokenAccounts: WalletTokenAccounts
    wallet: Keypair
  }

async function ammCreatePool(input: TestTxInputInfo): Promise<{ txids: string[] }> {
  // -------- step 1: make instructions --------
  const initPoolInstructionResponse = await Liquidity.makeCreatePoolV4InstructionV2Simple({
    connection,
    programId: PROGRAMIDS.AmmV4,
    marketInfo: {
      marketId: input.targetMarketId,
      programId: PROGRAMIDS.OPENBOOK_MARKET,
    },
    baseMintInfo: input.baseToken,
    quoteMintInfo: input.quoteToken,
    baseAmount: input.addBaseAmount,
    quoteAmount: input.addQuoteAmount,
    startTime: new BN(Math.floor(input.startTime)),
    ownerInfo: {
      feePayer: input.wallet.publicKey,
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
      useSOLBalance: true,
    },
    associatedOnly: false,
    checkCreateATAOwner: true,
    makeTxVersion,
    feeDestinationId: FEE_DESTINATION
  })

  return { txids: await buildAndSendTx(initPoolInstructionResponse.innerTransactions) }
}

async function howToUse() {
  const DECIMALS = 9;
  const MINT_AUTHORITY = Keypair.generate();
  const baseToken = await generateMint(MINT_AUTHORITY.publicKey, "MY_USDC", DECIMALS);
  const quoteToken = await generateMint(MINT_AUTHORITY.publicKey, "MY_RAY", DECIMALS);
  const marketKeyPair = Keypair.generate();
  const targetMarketId = marketKeyPair.publicKey;

  await createMarket({
    connection,
    wallet:  new NodeWallet(wallet),
    baseMint: baseToken.mint,
    quoteMint: quoteToken.mint,
    baseLotSize: 1,
    quoteLotSize: 1,
    dexProgram: PROGRAMIDS.OPENBOOK_MARKET,
    market: marketKeyPair,
  });
  
  const addBaseAmount = new BN(10000 * Math.pow(10, DECIMALS))
  const addQuoteAmount = new BN(10000 * Math.pow(10, DECIMALS))
  await mintToAta(MINT_AUTHORITY, baseToken.mint, wallet.publicKey, addBaseAmount.toNumber());
  await mintToAta(MINT_AUTHORITY, quoteToken.mint, wallet.publicKey, addBaseAmount.toNumber());

  const startTime = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // start from 7 days later
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  /* do something with start price if needed */
  console.log('pool price', new Decimal(addBaseAmount.toString()).div(new Decimal(10 ** baseToken.decimals)).div(new Decimal(addQuoteAmount.toString()).div(new Decimal(10 ** quoteToken.decimals))).toString())

  ammCreatePool({
    startTime,
    addBaseAmount,
    addQuoteAmount,
    baseToken,
    quoteToken,
    targetMarketId,
    wallet,
    walletTokenAccounts,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}

howToUse();