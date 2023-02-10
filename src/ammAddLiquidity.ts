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
import { PublicKey } from '@solana/web3.js'
import { connection, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'

type TestInputInfo = {
  baseToken: Token
  quoteToken: Token
  targetPool: string
  inputTokenAmount: TokenAmount
  slippage: Percent
}

const fetchAmmV2PoolData = () => fetch(ENDPOINT + RAYDIUM_MAINNET_API.poolInfo).then((res) => res.json())

/**
 *
 * pre-action: prepare basic info
 *
 * step 1: compute (max) another amount
 * step 2: create instructions by SDK function
 * step 3: compose instructions to several transactions
 * step 4: send transactions
 */
async function ammAddLiquidity(
  inputInfo: TestInputInfo
): Promise<{ txids: string[]; anotherAmount: TokenAmount | CurrencyAmount }> {
  // -------- pre-action: prepare basic info --------
  const ammV2PoolData = await fetchAmmV2PoolData()
  assert(ammV2PoolData, 'fetch failed')
  const targetPoolInfo = [...ammV2PoolData.official, ...ammV2PoolData.unOfficial].find(
    (poolInfo) => poolInfo.id === inputInfo.targetPool
  )
  assert(targetPoolInfo, 'cannot find the target pool') // may be undefined if the Liquidity pool is not required for routing.

  // -------- step 1: compute another amount --------
  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys
  const extraPoolInfo = await Liquidity.fetchInfo({ connection, poolKeys })
  const { maxAnotherAmount, anotherAmount } = Liquidity.computeAnotherAmount({
    poolKeys,
    poolInfo: { ...targetPoolInfo, ...extraPoolInfo },
    amount: inputInfo.inputTokenAmount,
    anotherCurrency: inputInfo.quoteToken,
    slippage: inputInfo.slippage,
  })

  // -------- step 2: make instructions --------
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const addLiquidityInstructionResponse = await Liquidity.makeAddLiquidityInstructionSimple({
    connection,
    poolKeys,
    userKeys: { owner: wallet.publicKey, payer: wallet.publicKey, tokenAccounts: walletTokenAccounts },
    amountInA: inputInfo.inputTokenAmount,
    amountInB: maxAnotherAmount,
    fixedSide: 'a',
  })

  // -------- step 3: compose instructions to several transactions --------
  const addLiquidityInstructionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: addLiquidityInstructionResponse.innerTransactions,
  })

  // -------- step 4: send transactions --------
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, addLiquidityInstructionTransactions)

  return { txids, anotherAmount }
}

function howToUse() {
  const baseToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC
  const quoteToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
  const targetPool = 'EVzLJhqMtdC1nPmz8rNd6xGfVjDPxpLZgq7XJuNfMZ6' // RAY-USDC pool
  const inputTokenAmount = new TokenAmount(baseToken, 100)
  const slippage = new Percent(1, 100)

  ammAddLiquidity({ baseToken, quoteToken, targetPool, inputTokenAmount, slippage }).then(
    ({ txids, anotherAmount }) => {
      /** continue with txids */
      console.log('txids', txids)
    }
  )
}
