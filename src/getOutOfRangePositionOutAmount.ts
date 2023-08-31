import BN from 'bn.js';
import Decimal from 'decimal.js';

import {
  AmmV3,
  AmmV3PoolInfo,
  fetchMultipleMintInfos,
  SqrtPriceMath,
} from '@raydium-io/raydium-sdk';

import { connection } from '../config';
import { formatClmmKeysFromId } from './formatClmmKeysFromId';

function _d(poolInfo: AmmV3PoolInfo, amount: BN, type: 'A' | 'B') {
  const decimal = poolInfo[type === 'A' ? 'mintA' : 'mintB'].decimals
  return new Decimal(amount.toString()).div(new Decimal(10).pow(decimal))
}

async function getOutOfRangePositionOutAmount() {
  const poolId = ''                                           // need change

  const poolKey = await formatClmmKeysFromId(poolId)

  const poolInfo = (await AmmV3.fetchMultiplePoolInfos({connection, poolKeys: [poolKey], chainTime: new Date().getTime() / 1000, }))[poolId].state

  const priceLower = new Decimal(10)                           // need change
  const priceUpper = new Decimal(30)                           // need change
  const inputAmount = new Decimal(100)                         // need change
  const inputAmountMint = poolInfo.mintA                       // need change
  
  const tickLower = AmmV3.getPriceAndTick({ poolInfo, price: priceLower, baseIn: true}).tick
  const tickUpper = AmmV3.getPriceAndTick({ poolInfo, price: priceUpper, baseIn: true}).tick
  const token2022Infos = await fetchMultipleMintInfos({connection, mints: [poolInfo.mintA.mint, poolInfo.mintB.mint]})
  const epochInfo = await connection.getEpochInfo()

  const liquidityInfo = await AmmV3.getLiquidityAmountOutFromAmountIn({
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

  const amountLower = AmmV3.getAmountsFromLiquidity({
    poolInfo: {...poolInfo, sqrtPriceX64: SqrtPriceMath.getSqrtPriceX64FromTick(tickLower)},
    tickLower,
    tickUpper,
    liquidity: liquidityInfo.liquidity,
    slippage: 0,
    add: false,

    token2022Infos,
    epochInfo,
  })

  const amountUpper = AmmV3.getAmountsFromLiquidity({
    poolInfo: {...poolInfo, sqrtPriceX64: SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper)},
    tickLower,
    tickUpper,
    liquidity: liquidityInfo.liquidity,
    slippage: 0,
    add: false,

    token2022Infos,
    epochInfo,
  })


  console.log(`create position info -> liquidity: ${liquidityInfo.liquidity.toString()} amountA: ${_d(poolInfo, liquidityInfo.amountA.amount, 'A')} amountB: ${_d(poolInfo, liquidityInfo.amountB.amount, 'B')}`)
  console.log(`out of range position(lower) info -> liquidity: ${amountLower.liquidity.toString()} amountA: ${_d(poolInfo, amountLower.amountA.amount, 'A')} amountB: ${_d(poolInfo, amountLower.amountB.amount, 'B')}`)
  console.log(`out of range position(upper) info -> liquidity: ${amountUpper.liquidity.toString()} amountA: ${_d(poolInfo, amountUpper.amountA.amount, 'A')} amountB: ${_d(poolInfo, amountUpper.amountB.amount, 'B')}`)
  
}

getOutOfRangePositionOutAmount()