import assert from 'assert'
import {
  buildTransaction,
  CurrencyAmount,
  ENDPOINT,
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk'
import { Keypair, PublicKey } from '@solana/web3.js'
import { connection, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  baseToken: Token
  quoteToken: Token
  targetPool: string
  inputTokenAmount: TokenAmount
  slippage: Percent
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

/**
 *
 * pre-action: fetch basic AmmV2 info
 *
 * step 1: compute (max) another amount
 * step 2: create instructions by SDK function
 * step 3: compose instructions to several transactions
 * step 4: send transactions
 */
async function ammAddLiquidity(
  input: TestTxInputInfo
): Promise<{ txids: string[]; anotherAmount: TokenAmount | CurrencyAmount }> {
  // -------- pre-action: fetch basic info --------
  const ammV2PoolData = await fetch(ENDPOINT + RAYDIUM_MAINNET_API.poolInfo).then((res) => res.json())
  assert(ammV2PoolData, 'fetch failed')
  const targetPoolInfo = [...ammV2PoolData.official, ...ammV2PoolData.unOfficial].find(
    (poolInfo) => poolInfo.id === input.targetPool
  )
  assert(targetPoolInfo, 'cannot find the target pool')

  // -------- step 1: compute another amount --------
  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys
  const extraPoolInfo = await Liquidity.fetchInfo({ connection, poolKeys })
  const { maxAnotherAmount, anotherAmount } = Liquidity.computeAnotherAmount({
    poolKeys,
    poolInfo: { ...targetPoolInfo, ...extraPoolInfo },
    amount: input.inputTokenAmount,
    anotherCurrency: input.quoteToken,
    slippage: input.slippage,
  })

  // -------- step 2: make instructions --------
  const addLiquidityInstructionResponse = await Liquidity.makeAddLiquidityInstructionSimple({
    connection,
    poolKeys,
    userKeys: {
      owner: input.wallet.publicKey,
      payer: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
    amountInA: input.inputTokenAmount,
    amountInB: maxAnotherAmount,
    fixedSide: 'a',
  })

  // -------- step 3: compose instructions to several transactions --------
  const addLiquidityInstructionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: addLiquidityInstructionResponse.innerTransactions,
  })

  // -------- step 4: send transactions --------
  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, addLiquidityInstructionTransactions)
  return { txids, anotherAmount }
}

async function howToUse() {
  const baseToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC
  const quoteToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
  const targetPool = 'EVzLJhqMtdC1nPmz8rNd6xGfVjDPxpLZgq7XJuNfMZ6' // RAY-USDC pool
  const inputTokenAmount = new TokenAmount(baseToken, 100)
  const slippage = new Percent(1, 100)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  ammAddLiquidity({
    baseToken,
    quoteToken,
    targetPool,
    inputTokenAmount,
    slippage,
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ txids, anotherAmount }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
