import Decimal from 'decimal.js';

import {
  Clmm,
  fetchMultipleMintInfos
} from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import BN from 'bn.js';
import {
  connection,
  makeTxVersion,
  wallet
} from '../config';
import { formatClmmKeysById } from './formatClmmKeysById';
import { _d } from './getOutOfRangePositionOutAmount';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  targetPool: string
  inputTokenAmount: Decimal
  inputTokenMint: 'mintA' | 'mintB'
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
  startPrice: Decimal
  endPrice: Decimal
  slippage: number
}

async function clmmCreatePosition({ targetPool, inputTokenAmount, inputTokenMint, walletTokenAccounts, wallet, startPrice, endPrice, slippage }: TestTxInputInfo) {
  if (startPrice.gte(endPrice)) throw Error('price input error')
  // -------- pre-action: fetch basic info --------
  const clmmPool = await formatClmmKeysById(targetPool)

  // -------- step 1: Clmm info and Clmm position --------
  const { [clmmPool.id]: { state: poolInfo } } = await Clmm.fetchMultiplePoolInfos({
    connection,
    poolKeys: [clmmPool],
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccounts,
    },
  })

  // -------- step 2: get tickUpper and tickLower --------
  const { tick: tickLower } = Clmm.getPriceAndTick({
    poolInfo,
    baseIn: true,
    price: startPrice,
  })
  const { tick: tickUpper } = Clmm.getPriceAndTick({
    poolInfo,
    baseIn: true,
    price: endPrice,
  })

  // -------- step 3: get liquidity --------
  const { liquidity, amountSlippageA, amountSlippageB } = Clmm.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    slippage,
    inputA: inputTokenMint === 'mintA',
    tickUpper,
    tickLower,
    amount: new BN(inputTokenAmount.mul(10 ** poolInfo[inputTokenMint].decimals).toFixed(0)),
    add: true,

    amountHasFee: true,

    token2022Infos: await fetchMultipleMintInfos({ connection, mints: [poolInfo.mintA.mint, poolInfo.mintB.mint] }),
    epochInfo: await connection.getEpochInfo(),
  })

  console.log(`will add liquidity -> ${liquidity.toString()} - amount A -> ${_d(poolInfo, amountSlippageA.amount, 'A')} - amount B -> ${_d(poolInfo, amountSlippageB.amount, 'B')}`)
  // -------- step 4: make open position instruction --------
  const makeOpenPositionInstruction = await Clmm.makeOpenPositionFromLiquidityInstructionSimple({
    connection,
    poolInfo,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccounts,
    },
    tickLower,
    tickUpper,
    liquidity,
    makeTxVersion,
    amountMaxA: amountSlippageA.amount,
    amountMaxB: amountSlippageB.amount,
  })
  console.log('create position mint -> ', makeOpenPositionInstruction.address.nftMint.toString())

  return { txids: await buildAndSendTx(makeOpenPositionInstruction.innerTransactions) }
}

async function howToUse() {
  const targetPool = 'pool id' // RAY-USDC pool
  const inputTokenAmount = new Decimal(1)
  const inputTokenMint: 'mintA' | 'mintB' = 'mintA'
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const startPrice = new Decimal(0.1)
  const endPrice = new Decimal(1)
  const slippage = 0.01

  clmmCreatePosition({
    targetPool,
    inputTokenAmount,
    inputTokenMint,
    walletTokenAccounts,
    wallet,
    startPrice,
    endPrice,
    slippage,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}

howToUse()