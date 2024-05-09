import { BN } from 'bn.js';

import {
  Liquidity,
  MAINNET_PROGRAM_ID,
  Token,
} from '@raydium-io/raydium-sdk';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  DEFAULT_TOKEN,
  makeTxVersion,
  PROGRAMIDS,
  wallet,
} from '../config';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';
import Decimal from 'decimal.js';

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
    feeDestinationId: new PublicKey('7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5'), // only mainnet use this
  })

  return { txids: await buildAndSendTx(initPoolInstructionResponse.innerTransactions) }
}

async function howToUse() {
  const baseToken = DEFAULT_TOKEN.USDC // USDC
  const quoteToken = DEFAULT_TOKEN.RAY // RAY
  const targetMarketId = Keypair.generate().publicKey
  const addBaseAmount = new BN(10000)
  const addQuoteAmount = new BN(10000)
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
