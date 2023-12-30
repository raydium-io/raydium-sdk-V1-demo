import BN from 'bn.js';

import {
  ApiClmmPoolsItem,
  ApiPoolInfo,
  Clmm,
  Currency,
  CurrencyAmount,
  fetchMultipleMintInfos,
  Percent,
  Token,
  TokenAmount,
  TradeV2
} from '@raydium-io/raydium-sdk';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  DEFAULT_TOKEN,
  makeTxVersion,
  PROGRAMIDS,
  wallet
} from '../config';
import { formatAmmKeysToApi } from './formatAmmKeys';
import { formatClmmKeys } from './formatClmmKeys';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  inputToken: Token | Currency
  outputToken: Token | Currency
  inputTokenAmount: TokenAmount | CurrencyAmount
  slippage: Percent
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair

  feeConfig?: {
    feeBps: BN,
    feeAccount: PublicKey
  }
}

async function routeSwap(input: TestTxInputInfo) {
  // -------- pre-action: fetch Clmm pools info and ammV2 pools info --------
  const clmmPools: ApiClmmPoolsItem[] = await formatClmmKeys(PROGRAMIDS.CLMM.toString()) // If the clmm pool is not required for routing, then this variable can be configured as undefined
  const clmmList = Object.values(
    await Clmm.fetchMultiplePoolInfos({ connection, poolKeys: clmmPools, chainTime: new Date().getTime() / 1000 })
  ).map((i) => i.state)

  const sPool: ApiPoolInfo = await formatAmmKeysToApi(PROGRAMIDS.AmmV4.toString(), true) // If the Liquidity pool is not required for routing, then this variable can be configured as undefined

  // -------- step 1: get all route --------
  const getRoute = TradeV2.getAllRoute({
    inputMint: input.inputToken instanceof Token ? input.inputToken.mint : PublicKey.default,
    outputMint: input.outputToken instanceof Token ? input.outputToken.mint : PublicKey.default,
    apiPoolList: sPool,
    clmmList,
  })

  // -------- step 2: fetch tick array and pool info --------
  const [tickCache, poolInfosCache] = await Promise.all([
    await Clmm.fetchMultiplePoolTickArrays({ connection, poolKeys: getRoute.needTickArray, batchRequest: true }),
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

    feeConfig: input.feeConfig,

    mintInfos: await fetchMultipleMintInfos({connection, mints: [
      ...clmmPools.map(i => [{mint: i.mintA, program: i.mintProgramIdA}, {mint: i.mintB, program: i.mintProgramIdB}]).flat().filter(i => i.program === TOKEN_2022_PROGRAM_ID.toString()).map(i => new PublicKey(i.mint)),
    ]}),

    epochInfo: await connection.getEpochInfo(),
  })

  // -------- step 4: create instructions by SDK function --------
  const { innerTransactions } = await TradeV2.makeSwapInstructionSimple({
    routeProgram: PROGRAMIDS.Router,
    connection,
    swapInfo: routeInfo,
    ownerInfo: {
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
      associatedOnly: true,
      checkCreateATAOwner: true,
    },
    
    computeBudgetConfig: { // if you want add compute instruction
      units: 400000, // compute instruction
      microLamports: 1, // fee add 1 * 400000 / 10 ** 9 SOL
    },
    makeTxVersion,
  })

  return { txids: await buildAndSendTx(innerTransactions) }
}

async function howToUse() {
  // sol -> new Currency(9, 'SOL', 'SOL')
  const outputToken = DEFAULT_TOKEN.USDC // USDC
  const inputToken = DEFAULT_TOKEN.RAY // RAY
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
    wallet,

    // feeConfig: {
    //   feeBps: new BN(25),
    //   feeAccount: Keypair.generate().publicKey // test
    // }
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}

howToUse()
