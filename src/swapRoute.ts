import {
  AmmV3,
  buildTransaction,
  Currency,
  CurrencyAmount,
  ENDPOINT,
  Percent,
  Token,
  TokenAmount,
  TradeV2,
} from '@raydium-io/raydium-sdk';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  RAYDIUM_MAINNET_API,
  wallet,
  wantBuildTxVersion,
} from '../config';
import {
  getWalletTokenAccount,
  sendTx,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  inputToken: Token | Currency
  outputToken: Token | Currency
  inputTokenAmount: TokenAmount | CurrencyAmount
  slippage: Percent
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

/**
 * pre-action: fetch ammV3 pools info and ammV2 pools info
 * step 1: get all route
 * step 2: fetch tick array and pool info
 * step 3: calculation result of all route
 * step 4: create instructions by SDK function
 * step 5: compose instructions to several transactions
 * step 6: send transactions
 */
async function routeSwap(input: TestTxInputInfo) {
  // -------- pre-action: fetch ammV3 pools info and ammV2 pools info --------
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data // If the clmm pool is not required for routing, then this variable can be configured as undefined
  const ammV3PoolInfos = Object.values(
    await AmmV3.fetchMultiplePoolInfos({ connection, poolKeys: ammV3Pool, chainTime: new Date().getTime() / 1000 })
  ).map((i) => i.state)

  const ammV2Pool = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.poolInfo)).json() // If the Liquidity pool is not required for routing, then this variable can be configured as undefined

  // -------- step 1: get all route --------
  const getRoute = TradeV2.getAllRoute({
    inputMint: input.inputToken instanceof Token ? input.inputToken.mint : PublicKey.default,
    outputMint: input.outputToken instanceof Token ? input.outputToken.mint : PublicKey.default,
    apiPoolList: ammV2Pool,
    ammV3List: ammV3PoolInfos,
  })

  // -------- step 2: fetch tick array and pool info --------
  const [tickCache, poolInfosCache] = await Promise.all([
    await AmmV3.fetchMultiplePoolTickArrays({ connection, poolKeys: getRoute.needTickArray, batchRequest: true }),
    await TradeV2.fetchMultipleInfo({ connection, pools: getRoute.needSimulate, batchRequest: true }),
  ])

  // -------- step 3: calculation result of all route --------
  const [routeInfo] = TradeV2.getAllRouteComputeAmountOut({
    directPath: getRoute.directPath,
    routePathDict: getRoute.routePathDict,
    simulateCache: poolInfosCache,
    tickCache,
    inputTokenAmount: input.inputTokenAmount,
    outputToken: input.outputToken,
    slippage: input.slippage,
    chainTime: new Date().getTime() / 1000, // this chain time
  })

  // -------- step 4: create instructions by SDK function --------
  const { innerTransactions } = await TradeV2.makeSwapInstructionSimple({
    connection,
    swapInfo: routeInfo,
    ownerInfo: {
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
      associatedOnly: true,
    },
    checkTransaction: true,
    
    computeBudgetConfig: { // if you want add compute instruction
      units: 400000, // compute instruction
      microLamports: 1, // fee add 1 * 400000 / 10 ** 9 SOL
    },
  })

  // -------- step 5: compose instructions to several transactions --------
  const transactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: innerTransactions,
  })

  // -------- step 6: send transactions --------
  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, transactions)
  return { txids }
}

async function howToUse() {
  // sol -> new Currency(9, 'SOL', 'SOL')
  const outputToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC
  const inputToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
  // const inputToken = new Currency(9, 'SOL', 'SOL')

  const inputTokenAmount = new (inputToken instanceof Token ? TokenAmount : CurrencyAmount)(inputToken, 100)
  const slippage = new Percent(1, 100)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  routeSwap({
    inputToken,
    outputToken,
    inputTokenAmount,
    slippage,
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}

howToUse()
