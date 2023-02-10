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

const baseToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC
const quoteToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
const targetPoolPublicKey = 'EVzLJhqMtdC1nPmz8rNd6xGfVjDPxpLZgq7XJuNfMZ6' // RAY-USDC pool
const inputTokenAmount = new TokenAmount(baseToken, 100)
const slippage = new Percent(1, 100)
const fetchAmmV2PoolData = () => fetch(ENDPOINT + RAYDIUM_MAINNET_API.poolInfo).then((res) => res.json())

/**
 * step 1: prepare basic info
 * step 2: compute another amount
 * step 3: make instructions
 * step 4: compose instructions to several transactions
 * step 5: send transactions
 */
async function ammAddLiquidity(): Promise<{ txids: string[]; anotherAmount: TokenAmount | CurrencyAmount }> {
  // -------- step 1: prepare basic info --------
  const ammV2PoolData = await fetchAmmV2PoolData()
  assert(ammV2PoolData, 'fetch failed')
  const targetPoolInfo = [...ammV2PoolData.official, ...ammV2PoolData.unOfficial].find(
    (poolInfo) => poolInfo.id === targetPoolPublicKey
  )
  assert(targetPoolInfo, 'cannot find the target pool') // may be undefined if the Liquidity pool is not required for routing.

  // -------- step 2: compute another amount --------
  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys
  const extraPoolInfo = await Liquidity.fetchInfo({ connection, poolKeys })
  const { maxAnotherAmount, anotherAmount } = Liquidity.computeAnotherAmount({
    poolKeys,
    poolInfo: { ...targetPoolInfo, ...extraPoolInfo },
    amount: inputTokenAmount,
    anotherCurrency: quoteToken,
    slippage: slippage,
  })

  // -------- step 3: make instructions --------
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const addLiquidityInstructionResponse = await Liquidity.makeAddLiquidityInstructionSimple({
    connection,
    poolKeys,
    userKeys: { owner: wallet.publicKey, payer: wallet.publicKey, tokenAccounts: walletTokenAccounts },
    amountInA: inputTokenAmount,
    amountInB: maxAnotherAmount,
    fixedSide: 'a',
  })

  // -------- step 4: compose instructions to several transactions --------
  const addLiquidityInstructionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: addLiquidityInstructionResponse.innerTransactions,
  })

  // -------- step 5: send transactions --------
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, addLiquidityInstructionTransactions)

  // return info
  return { txids, anotherAmount }
}

ammAddLiquidity().then((txInfo) => {
  /** continue with txInfo */
  console.log('txids', txInfo.txids)
})
