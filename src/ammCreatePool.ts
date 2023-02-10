import { BN } from 'bn.js'
const ZERO = new BN(0)
type BN = typeof ZERO

import { buildTransaction, Liquidity, MAINNET_PROGRAM_ID, Token } from '@raydium-io/raydium-sdk'
import { Keypair, PublicKey } from '@solana/web3.js'
import { connection, PROGRAMIDS, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'

type CalcStartPrice = {
  addBaseAmount: BN
  addQuoteAmount: BN
}

function calcMarketStartPrice(calcInfo: CalcStartPrice) {
  return calcInfo.addBaseAmount.toNumber() / 10 ** 6 / (calcInfo.addQuoteAmount.toNumber() / 10 ** 6)
}

type LiquidityPairTargetInfo = {
  baseToken: Token
  quoteToken: Token
  targetMargetId: PublicKey
}

function getMarketAssociatedPoolKeys(inputInfo: LiquidityPairTargetInfo) {
  return Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: inputInfo.baseToken.mint,
    quoteMint: inputInfo.quoteToken.mint,
    baseDecimals: inputInfo.baseToken.decimals,
    quoteDecimals: inputInfo.quoteToken.decimals,
    marketId: inputInfo.targetMargetId,
    programId: PROGRAMIDS.AmmV4,
    marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
  })
}

type TestInputInfo = LiquidityPairTargetInfo &
  CalcStartPrice & {
    startTime: number // seconds
  }

/**
 *
 * step 1: create instructions by SDK function
 * step 2: compose instructions to several transactions
 * step 3: send transactions
 */
async function ammCreatePool(inputInfo: TestInputInfo): Promise<{ txids: string[] }> {
  // -------- step 1: make instructions --------
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey)
  const initPoolInstructionResponse = await Liquidity.makeCreatePoolV4InstructionV2Simple({
    connection,
    programId: PROGRAMIDS.AmmV4,
    marketInfo: {
      marketId: inputInfo.targetMargetId,
      programId: PROGRAMIDS.OPENBOOK_MARKET,
    },
    baseMintInfo: inputInfo.baseToken,
    quoteMintInfo: inputInfo.quoteToken,
    baseAmount: inputInfo.addBaseAmount,
    quoteAmount: inputInfo.addQuoteAmount,
    startTime: new BN(Math.floor(inputInfo.startTime)),
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
      useSOLBalance: true,
    },
    associatedOnly: false,
  })

  // -------- step 2: compose instructions to several transactions --------
  const createPoolTxs = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: initPoolInstructionResponse.innerTransactions,
  })

  // -------- step 3: send transactions --------
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, createPoolTxs)

  return { txids }
}

function howToUse() {
  const baseToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC
  const quoteToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
  const targetMargetId = Keypair.generate().publicKey
  const addBaseAmount = new BN(10000) // 10000 / 10 ** 6,
  const addQuoteAmount = new BN(10000) // 10000 / 10 ** 6,
  const startTime = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // start from 7 days later

  /* do something with start price if needed */
  const startPrice = calcMarketStartPrice({ addBaseAmount, addQuoteAmount })

  /* do something with market associated pool keys if needed */
  const associatedPoolKeys = getMarketAssociatedPoolKeys({
    baseToken,
    quoteToken,
    targetMargetId,
  })

  ammCreatePool({ startTime, addBaseAmount, addQuoteAmount, baseToken, quoteToken, targetMargetId }).then(
    ({ txids }) => {
      /** continue with txids */
      console.log('txids', txids)
    }
  )
}
