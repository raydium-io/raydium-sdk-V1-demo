import BN from 'bn.js';

import {
  ApiClmmPoolsItem,
  ApiPoolInfo,
  Clmm,
  ClmmPoolInfo,
  ClmmPoolPersonalPosition,
  ComputeAmountOutAmmLayout,
  ComputeAmountOutRouteLayout,
  fetchMultipleMintInfos,
  getPdaPersonalPositionAddress,
  LiquidityMath,
  Percent,
  PositionInfoLayout,
  ReturnTypeFetchMultipleInfo,
  ReturnTypeFetchMultiplePoolTickArrays,
  ReturnTypeGetAllRoute,
  Token,
  TokenAccount,
  TokenAmount,
  TradeV2,
  ZERO
} from '@raydium-io/raydium-sdk';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  PublicKey
} from '@solana/web3.js';

import Decimal from 'decimal.js';
import {
  connection,
  makeTxVersion,
  PROGRAMIDS,
  wallet
} from '../config';
import { formatAmmKeysToApi } from './formatAmmKeys';
import { formatClmmKeys } from './formatClmmKeys';
import {
  buildAndSendTx,
  getATAAddress,
  getWalletTokenAccount,
  sleepTime
} from './util';

async function autoAddPosition() {
  const positionMint = '' // pls input mint

  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const positionAccount = walletTokenAccounts.find(i => i.accountInfo.mint.toString() === positionMint && i.accountInfo.amount.toNumber() === 1)
  if (positionAccount === undefined) {
    throw Error('find positon from wallet error')
  }

  const positionAccountAddress = getPdaPersonalPositionAddress(PROGRAMIDS.CLMM, new PublicKey(positionMint)).publicKey
  const positionAccountInfo = await connection.getAccountInfo(positionAccountAddress)
  if (positionAccountInfo === null) throw Error('get positionAccountInfo error')
  const positionAccountData = PositionInfoLayout.decode(positionAccountInfo.data)

  const positionPooId = positionAccountData.poolId
  console.log('position pool id -> ', positionPooId.toString())

  const clmmPools: ApiClmmPoolsItem[] = await formatClmmKeys(PROGRAMIDS.CLMM.toString(), true)

  const clmmPool = clmmPools.find(i => i.id === positionPooId.toString())
  if (clmmPool === undefined) throw Error('not found pool info from api')

  const clmmPoolInfo = await Clmm.fetchMultiplePoolInfos({
    connection,
    poolKeys: [clmmPool],
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: [positionAccount],
    },
    batchRequest: true,
    updateOwnerRewardAndFee: true,
  })

  const clmmInfo = clmmPoolInfo[positionPooId.toString()].state
  const ownerPositionInfo = clmmPoolInfo[positionPooId.toString()].positionAccount![0]

  const ownerMintAtaA = getATAAddress(clmmInfo.mintA.programId, wallet.publicKey, clmmInfo.mintA.mint).publicKey
  const ownerMintAtaB = getATAAddress(clmmInfo.mintB.programId, wallet.publicKey, clmmInfo.mintB.mint).publicKey
  const ownerAccountA = walletTokenAccounts.find(i => i.pubkey.equals(ownerMintAtaA))?.accountInfo.amount ?? ZERO
  const ownerAccountB = walletTokenAccounts.find(i => i.pubkey.equals(ownerMintAtaB))?.accountInfo.amount ?? ZERO

  const clmmList = Object.values(
    await Clmm.fetchMultiplePoolInfos({ connection, poolKeys: clmmPools, chainTime: new Date().getTime() / 1000 })
  ).map((i) => i.state)
  const sPool: ApiPoolInfo = await formatAmmKeysToApi(PROGRAMIDS.AmmV4.toString(), true)

  await autoAddPositionFunc({
    poolInfo: clmmInfo,
    positionInfo: ownerPositionInfo,
    addMintAmountA: ownerAccountA,
    addMintAmountB: ownerAccountB,
    walletTokenAccounts,
    clmmList,
    sPool,
    clmmPools,
  })
}


export async function autoAddPositionFunc({ poolInfo, positionInfo, addMintAmountA, addMintAmountB, walletTokenAccounts, clmmList, sPool, clmmPools }: {
  poolInfo: ClmmPoolInfo,
  positionInfo: ClmmPoolPersonalPosition,
  addMintAmountA: BN,
  addMintAmountB: BN,
  walletTokenAccounts: TokenAccount[],
  clmmList: ClmmPoolInfo[],
  sPool: ApiPoolInfo,
  clmmPools: ApiClmmPoolsItem[]
}) {
  if (addMintAmountA.isZero() && addMintAmountB.isZero()) new Error('input amount is zero')
  console.log('will add amount -> ', addMintAmountA.toString(), addMintAmountB.toString())

  const priceLower = Clmm.getTickPrice({
    poolInfo,
    tick: positionInfo.tickLower,
    baseIn: true,
  })
  const priceUpper = Clmm.getTickPrice({
    poolInfo,
    tick: positionInfo.tickUpper,
    baseIn: true,
  })
  const { amountA, amountB } = LiquidityMath.getAmountsFromLiquidity(
    poolInfo.sqrtPriceX64,
    priceLower.tickSqrtPriceX64,
    priceUpper.tickSqrtPriceX64,
    new BN(1000000000),
    false,
  )

  let swapRatio: number[] = []
  if (amountA.isZero() || amountB.isZero()) {
    swapRatio = [1]
  } else {
    swapRatio = Array.from({ length: Math.ceil(1 / 0.05) }, (_, i) => Math.floor((i + 1) * 0.05 * 100) / 100)
  }

  const willR = new Decimal(amountA.toString()).div(amountB.toString())

  let swapType: 'A To B' | 'B To A' | 'not need swap base A' | 'not need swap base B'
  if (amountB.isZero() && addMintAmountB.isZero()) {
    swapType = 'not need swap base A'
  } else if (amountB.isZero()) {
    swapType = 'B To A'
  } else if (addMintAmountB.isZero()) {
    swapType = 'A To B'
  } else {
    const amountR = new Decimal(addMintAmountA.toString()).div(addMintAmountB.toString())

    if (willR.eq(amountR)) swapType = 'not need swap base B' // amount A = 0
    else swapType = willR.gt(amountR) ? 'B To A' : 'A To B'
  }

  console.log('will add pisition ratio', JSON.stringify({ amountA: String(amountA), amountB: String(amountB), ratio: willR }))

  const poolMintA = new Token(poolInfo.mintA.programId, poolInfo.mintA.mint, poolInfo.mintA.decimals)
  const poolMintB = new Token(poolInfo.mintB.programId, poolInfo.mintB.mint, poolInfo.mintB.decimals)

  let willRouteInfo: ComputeAmountOutLayout | undefined = undefined
  let willPositionInputAmount: BN = ZERO
  let willPositionOtherAmountMax: BN = ZERO
  let baseA = swapType === 'A To B' || swapType === 'not need swap base A'

  if (swapType === 'not need swap base A') {
    willPositionInputAmount = addMintAmountA
    willPositionOtherAmountMax = addMintAmountB
  }
  if (swapType === 'not need swap base B') {
    willPositionInputAmount = addMintAmountB
    willPositionOtherAmountMax = addMintAmountA
  }

  if (swapType === 'A To B') {
    const fromToken = poolMintA
    const toToken = poolMintB
    const fromAmount = addMintAmountA
    const toAmount = addMintAmountB

    const _willSwapAmount = fromAmount
    const swapFromMintTokenAmount = new TokenAmount(fromToken, _willSwapAmount)
    const { getRoute, tickCache, poolInfosCache, } = await swapStep1({
      swapFromMintTokenAmount,
      swapToMintToken: toToken,
      clmmList,
      sPool,
    })

    for (const itemRatio of swapRatio) {
      const willSwapAmount = new BN(new Decimal(fromAmount.toString()).mul(itemRatio).toFixed(0))
      const swapFromMintTokenAmount = new TokenAmount(fromToken, willSwapAmount)

      const routeInfo = await swapStep2({
        getRoute, tickCache, poolInfosCache, swapFromMintTokenAmount,
        swapToMintToken: toToken,
        slippage: new Percent(1, 100),
        clmmPools,
      })

      const outA = fromAmount.sub(willSwapAmount)
      const outB = toAmount.add(routeInfo.minAmountOut.amount.raw)

      if (!outB.isZero() && new Decimal(outA.toString()).div(outB.toString()).lte(willR)) {
        if (outA.isZero()) {
          baseA = false
          willPositionInputAmount = outB
          willPositionOtherAmountMax = ZERO
        } else {
          willPositionInputAmount = outA
          willPositionOtherAmountMax = toAmount.add(routeInfo.amountOut.amount.raw)
        }

        willRouteInfo = routeInfo
        console.log('will swap A To B info ->', JSON.stringify({
          fromToken: fromToken.mint.toString(),
          toToken: toToken.mint.toString(),
          fromAmount: willSwapAmount.toString(),
          toAmountMin: routeInfo.minAmountOut.amount.raw.toString(),
          swapRatio: itemRatio,
        }))
        break
      }
    }
  } else if (swapType === 'B To A') {
    const fromToken = poolMintB
    const toToken = poolMintA
    const fromAmount = addMintAmountB
    const toAmount = addMintAmountA

    const _willSwapAmount = fromAmount
    const swapFromMintTokenAmount = new TokenAmount(fromToken, _willSwapAmount)
    const { getRoute, tickCache, poolInfosCache, } = await swapStep1({
      swapFromMintTokenAmount,
      swapToMintToken: toToken,
      clmmList,
      sPool,
    })

    for (const itemRatio of swapRatio) {
      const willSwapAmount = new BN(new Decimal(fromAmount.toString()).mul(itemRatio).toFixed(0))
      const swapFromMintTokenAmount = new TokenAmount(fromToken, willSwapAmount)

      const routeInfo = await swapStep2({
        getRoute, tickCache, poolInfosCache, swapFromMintTokenAmount,
        swapToMintToken: toToken,
        slippage: new Percent(1, 100),
        clmmPools,
      })

      const outB = fromAmount.sub(willSwapAmount)
      const outA = toAmount.add(routeInfo.minAmountOut.amount.raw)

      if (!outA.isZero() && new Decimal(outB.toString()).div(outA.toString()).lte(new Decimal(1).div(willR))) {
        if (outB.isZero()) {
          baseA = true
          willPositionInputAmount = outA
          willPositionOtherAmountMax = ZERO
        } else {
          willPositionInputAmount = outB
          willPositionOtherAmountMax = toAmount.add(routeInfo.amountOut.amount.raw)
        }

        willRouteInfo = routeInfo
        console.log('will swap B To A info ->', JSON.stringify({
          fromToken: fromToken.mint.toString(),
          toToken: toToken.mint.toString(),
          fromAmount: willSwapAmount.toString(),
          toAmountMin: routeInfo.minAmountOut.amount.raw.toString(),
          swapRatio: itemRatio,
        }))
        break
      }
    }
  }

  if (willRouteInfo !== undefined) {
    console.log('send Swap Instruction')

    const swapIns = await swapStep3({
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccounts,
      routeInfo: willRouteInfo,
    })

    console.log('swap txid -> ', await buildAndSendTx(swapIns))
  }

  const ins = await Clmm.makeIncreasePositionFromBaseInstructionSimple({
    makeTxVersion,
    connection,
    poolInfo,
    ownerPosition: positionInfo,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccounts,
    },

    base: baseA ? 'MintA' : 'MintB',
    baseAmount: willPositionInputAmount!,
    otherAmountMax: willPositionOtherAmountMax!,

    associatedOnly: true,
  })

  await sleepTime(3 * 1000)

  console.log('increase position txid -> ', await buildAndSendTx(ins.innerTransactions, { skipPreflight: true }))
}

async function swapStep1({ swapFromMintTokenAmount, swapToMintToken, clmmList, sPool }: {
  swapFromMintTokenAmount: TokenAmount,
  swapToMintToken: Token,
  clmmList: ClmmPoolInfo[],
  sPool: ApiPoolInfo,
}) {
  const getRoute = TradeV2.getAllRoute({
    inputMint: swapFromMintTokenAmount.token.mint,
    outputMint: swapToMintToken.mint,
    apiPoolList: sPool,
    clmmList,
  })

  const [tickCache, poolInfosCache] = await Promise.all([
    await Clmm.fetchMultiplePoolTickArrays({ connection, poolKeys: getRoute.needTickArray, batchRequest: true }),
    await TradeV2.fetchMultipleInfo({ connection, pools: getRoute.needSimulate, batchRequest: true }),
  ])

  return { getRoute, tickCache, poolInfosCache }
}

async function swapStep2({ getRoute, tickCache, poolInfosCache, swapFromMintTokenAmount, swapToMintToken, slippage, clmmPools }: {
  getRoute: ReturnTypeGetAllRoute,
  tickCache: ReturnTypeFetchMultiplePoolTickArrays,
  poolInfosCache: ReturnTypeFetchMultipleInfo,
  swapFromMintTokenAmount: TokenAmount,
  swapToMintToken: Token,
  slippage: Percent,
  clmmPools: ApiClmmPoolsItem[]
}) {
  const [routeInfo] = TradeV2.getAllRouteComputeAmountOut({
    directPath: getRoute.directPath,
    routePathDict: getRoute.routePathDict,
    simulateCache: poolInfosCache,
    tickCache,
    inputTokenAmount: swapFromMintTokenAmount,
    outputToken: swapToMintToken,
    slippage,
    chainTime: new Date().getTime() / 1000, // this chain time

    mintInfos: await fetchMultipleMintInfos({
      connection, mints: [
        ...clmmPools.map(i => [{ mint: i.mintA, program: i.mintProgramIdA }, { mint: i.mintB, program: i.mintProgramIdB }]).flat().filter(i => i.program === TOKEN_2022_PROGRAM_ID.toString()).map(i => new PublicKey(i.mint)),
      ]
    }),

    epochInfo: await connection.getEpochInfo(),
  })

  return routeInfo
}

type ComputeAmountOutLayout = ComputeAmountOutAmmLayout | ComputeAmountOutRouteLayout
async function swapStep3({ routeInfo, wallet, tokenAccounts }: {
  wallet: PublicKey,
  tokenAccounts: TokenAccount[],
  routeInfo: ComputeAmountOutLayout
}) {
  const { innerTransactions } = await TradeV2.makeSwapInstructionSimple({
    routeProgram: PROGRAMIDS.Router,
    connection,
    swapInfo: routeInfo,
    ownerInfo: {
      wallet,
      tokenAccounts,
      associatedOnly: true,
      checkCreateATAOwner: true,
    },
    makeTxVersion,
  })

  return innerTransactions
}

