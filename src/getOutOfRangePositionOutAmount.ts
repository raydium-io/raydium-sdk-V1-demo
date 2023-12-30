import BN from 'bn.js';
import Decimal from 'decimal.js';

import {
  Clmm,
  ClmmPoolInfo,
  fetchMultipleMintInfos,
  SqrtPriceMath,
} from '@raydium-io/raydium-sdk';

import { connection } from '../config';
import { formatClmmKeysById } from './formatClmmKeysById';

export function _d(poolInfo: ClmmPoolInfo, amount: BN, type: 'A' | 'B') {
  const decimal = poolInfo[type === 'A' ? 'mintA' : 'mintB'].decimals
  return new Decimal(amount.toString()).div(new Decimal(10).pow(decimal))
}

async function getOutOfRangePositionOutAmount() {
  const poolId = ''                                           // need change

  const poolKey = await formatClmmKeysById(poolId)

  const poolInfo = (await Clmm.fetchMultiplePoolInfos({ connection, poolKeys: [poolKey], chainTime: new Date().getTime() / 1000, }))[poolId].state

  const priceLower = new Decimal(10)                           // need change
  const priceUpper = new Decimal(30)                           // need change
  const inputAmount = new Decimal(100)                         // need change
  const inputAmountMint = poolInfo.mintA                       // need change

  const tickLower = Clmm.getPriceAndTick({ poolInfo, price: priceLower, baseIn: true }).tick
  const tickUpper = Clmm.getPriceAndTick({ poolInfo, price: priceUpper, baseIn: true }).tick
  const token2022Infos = await fetchMultipleMintInfos({ connection, mints: [poolInfo.mintA.mint, poolInfo.mintB.mint] })
  const epochInfo = await connection.getEpochInfo()

  const liquidityInfo = await Clmm.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    inputA: inputAmountMint.mint.equals(poolInfo.mintA.mint),
    tickLower,
    tickUpper,
    amount: new BN(inputAmount.mul(new Decimal(10).pow(inputAmountMint.decimals)).toFixed(0)),
    slippage: 0,
    add: true,

    amountHasFee: true,

    token2022Infos,
    epochInfo,
  })

  const amountLower = Clmm.getAmountsFromLiquidity({
    poolInfo: { ...poolInfo, sqrtPriceX64: SqrtPriceMath.getSqrtPriceX64FromTick(tickLower) },
    tickLower,
    tickUpper,
    liquidity: liquidityInfo.liquidity,
    slippage: 0,
    add: false,

    token2022Infos,
    epochInfo,
    amountAddFee: false,
  })

  const amountUpper = Clmm.getAmountsFromLiquidity({
    poolInfo: { ...poolInfo, sqrtPriceX64: SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper) },
    tickLower,
    tickUpper,
    liquidity: liquidityInfo.liquidity,
    slippage: 0,
    add: false,

    token2022Infos,
    epochInfo,
    amountAddFee: false
  })


  console.log(`create position info -> liquidity: ${liquidityInfo.liquidity.toString()} amountA: ${_d(poolInfo, liquidityInfo.amountA.amount, 'A')} amountB: ${_d(poolInfo, liquidityInfo.amountB.amount, 'B')}`)
  console.log(`out of range position(lower) info -> liquidity: ${amountLower.liquidity.toString()} amountA: ${_d(poolInfo, amountLower.amountA.amount, 'A')} amountB: ${_d(poolInfo, amountLower.amountB.amount, 'B')}`)
  console.log(`out of range position(upper) info -> liquidity: ${amountUpper.liquidity.toString()} amountA: ${_d(poolInfo, amountUpper.amountA.amount, 'A')} amountB: ${_d(poolInfo, amountUpper.amountB.amount, 'B')}`)
}
