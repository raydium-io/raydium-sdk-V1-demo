import BN from 'bn.js';

import {
  ApiClmmPoolsItem,
  ApiPoolInfo,
  Clmm,
  ClmmPoolInfo,
  ClmmPoolRewardInfo,
  fetchMultipleMintInfos,
  getPdaPersonalPositionAddress,
  Percent,
  PositionInfoLayout,
  SPL_MINT_LAYOUT,
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

import {
  connection,
  makeTxVersion,
  PROGRAMIDS,
  wallet
} from '../config';
import { autoAddPositionFunc } from './autoAddPosition';
import { formatAmmKeysToApi } from './formatAmmKeys';
import { formatClmmKeys } from './formatClmmKeys';
import {
  buildAndSendTx,
  getATAAddress,
  getWalletTokenAccount,
  sleepTime,
} from './util';


async function harvestAndAddPosition() {
  const positionMint = ''

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

  const rewardInfos: {
    poolReward: ClmmPoolRewardInfo, ownerReward: {
      growthInsideLastX64: BN;
      rewardAmountOwed: BN;
      pendingReward: BN;
    }
  }[] = []
  for (let i = 0; i < Math.min(clmmInfo.rewardInfos.length, ownerPositionInfo.rewardInfos.length); i++) rewardInfos.push({ poolReward: clmmInfo.rewardInfos[i], ownerReward: ownerPositionInfo.rewardInfos[i] })

  console.log('ownerPositionInfo')
  console.log('amount -> ', Object.entries({ liquidity: ownerPositionInfo.liquidity, amountA: ownerPositionInfo.amountA, amountB: ownerPositionInfo.amountB }).map(i => `${i[0]} -- ${String(i[1])}`))
  console.log('fee -> ', Object.entries({ tokenFeeAmountA: ownerPositionInfo.tokenFeeAmountA, tokenFeeAmountB: ownerPositionInfo.tokenFeeAmountB }).map(i => `${i[0]} -- ${String(i[1])}`))
  console.log('reward -> ', rewardInfos.map(i => ({ mint: i.poolReward.tokenMint, pending: i.ownerReward.pendingReward })).map(ii => Object.entries(ii).map(i => `${i[0]} -- ${String(i[1])}`)))

  const tempCount = ownerPositionInfo.tokenFeeAmountA.add(ownerPositionInfo.tokenFeeAmountB).add(rewardInfos.map(i => i.ownerReward.pendingReward).reduce((a, b) => a.add(b), new BN(0)))

  if (tempCount.lte(ZERO)) throw Error('No need to withdraw token')

  const needCacheMint = [
    { programId: clmmInfo.mintA.programId.toString(), mint: clmmInfo.mintA.mint.toString() },
    { programId: clmmInfo.mintB.programId.toString(), mint: clmmInfo.mintB.mint.toString() },
    ...clmmInfo.rewardInfos.map(i => ({ programId: i.tokenProgramId.toString(), mint: i.tokenMint.toString() })).filter(i => i.mint !== PublicKey.default.toString())]

  const mintAccount: { [account: string]: { mint: string, amount: BN } } = {}
  for (const itemMint of needCacheMint) {
    const mintAllAccount = walletTokenAccounts.filter(i => i.accountInfo.mint.toString() === itemMint.mint)
    const mintAta = getATAAddress(new PublicKey(itemMint.programId), wallet.publicKey, new PublicKey(itemMint.mint)).publicKey
    mintAccount[mintAta.toString()] = {
      mint: itemMint.mint,
      amount: mintAllAccount.find(i => i.pubkey.equals(mintAta))?.accountInfo.amount ?? ZERO,
    }
  }

  console.log('start amount cache', Object.entries(mintAccount).map(i => `account ->${i[0]} -- mint-> ${i[1].mint} -- amount -> ${String(i[1].amount)} `))

  // claim fee and reward
  const decreaseIns = await Clmm.makeDecreaseLiquidityInstructionSimple({
    connection,
    poolInfo: clmmInfo,
    ownerPosition: ownerPositionInfo,
    liquidity: ZERO,
    amountMinA: ZERO,
    amountMinB: ZERO,
    makeTxVersion,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccounts,
      useSOLBalance: false,
      closePosition: false,
    },
    associatedOnly: true,
  })

  console.log('claim fee and reward txid: ', await buildAndSendTx(decreaseIns.innerTransactions))

  const _tempBaseMint = [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'So11111111111111111111111111111111111111112',  // WSOL
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
  ]
  const swapToMintBase: "A" | 'B' = _tempBaseMint.includes(clmmInfo.mintA.mint.toString()) ? 'A' : 'B'
  const _tempMintInfo = swapToMintBase === 'A' ? clmmInfo.mintA : clmmInfo.mintB
  const swapToMintToken = new Token(_tempMintInfo.programId, _tempMintInfo.mint, _tempMintInfo.decimals, 'temp', 'temp')

  // swap start
  const sPool: ApiPoolInfo = await formatAmmKeysToApi(PROGRAMIDS.AmmV4.toString(), true)

  const clmmList = Object.values(
    await Clmm.fetchMultiplePoolInfos({ connection, poolKeys: clmmPools, chainTime: new Date().getTime() / 1000 })
  ).map((i) => i.state)

  for (const itemReward of rewardInfos) {
    const rewardMintAccountInfo = await connection.getAccountInfo(itemReward.poolReward.tokenMint)
    const rewardMintInfo = SPL_MINT_LAYOUT.decode(rewardMintAccountInfo!.data)
    const swapFromMintToken = new Token(itemReward.poolReward.tokenProgramId, itemReward.poolReward.tokenMint, rewardMintInfo.decimals, '_temp', '_temp')
    const swapFromMintTokenAmount = new TokenAmount(swapFromMintToken, itemReward.ownerReward.pendingReward)

    const swapInfo = await swap({
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccounts,
      clmmList,
      clmmPools,
      swapFromMintTokenAmount,
      swapToMintToken,
      sPool,
      slippage: new Percent(1, 100),
    })

    console.log('will swap reward -> ', Object.entries({
      programId: itemReward.poolReward.tokenProgramId,
      mint: itemReward.poolReward.tokenMint,
      decimals: rewardMintInfo.decimals,
      amount: itemReward.ownerReward.pendingReward,
      swapToMint: _tempMintInfo.mint,
      swapToAmount: swapInfo.amountMin.amount.raw.sub(swapInfo.amountMin.fee?.raw ?? ZERO),
    }).map(i => `${i[0]} -- ${String(i[1])}`))

    console.log('swap reward txid: ', await buildAndSendTx(decreaseIns.innerTransactions))
  }

  if (rewardInfos.length > 0) await sleepTime(30 * 1000) // await to confirm

  const walletTokenAccountsSwapRewardOver = await getWalletTokenAccount(connection, wallet.publicKey)
  const mintAccountSwapRewardOver: { [account: string]: { mint: string, amount: BN } } = {}
  for (const itemMint of needCacheMint) {
    const mintAllAccount = walletTokenAccountsSwapRewardOver.filter(i => i.accountInfo.mint.toString() === itemMint.mint)
    const mintAta = getATAAddress(new PublicKey(itemMint.programId), wallet.publicKey, new PublicKey(itemMint.mint)).publicKey
    mintAccountSwapRewardOver[mintAta.toString()] = {
      mint: itemMint.mint,
      amount: mintAllAccount.find(i => i.pubkey.equals(mintAta))?.accountInfo.amount ?? ZERO,
    }
  }

  console.log('swap reward over amount cache', Object.entries(mintAccountSwapRewardOver).map(i => `account ->${i[0]} -- mint-> ${i[1].mint} -- amount -> ${String(i[1].amount)} `))

  const mintAtaA = getATAAddress(new PublicKey(clmmInfo.mintA.programId), wallet.publicKey, new PublicKey(clmmInfo.mintA.mint)).publicKey.toString()
  const mintAtaB = getATAAddress(new PublicKey(clmmInfo.mintB.programId), wallet.publicKey, new PublicKey(clmmInfo.mintB.mint)).publicKey.toString()
  const willAddMintAmountA = (mintAccountSwapRewardOver[mintAtaA].amount ?? ZERO).sub(mintAccount[mintAtaA].amount ?? ZERO)
  const willAddMintAmountB = (mintAccountSwapRewardOver[mintAtaB].amount ?? ZERO).sub(mintAccount[mintAtaB].amount ?? ZERO)

  await autoAddPositionFunc({
    poolInfo: clmmInfo,
    positionInfo: ownerPositionInfo,
    addMintAmountA: willAddMintAmountA,
    addMintAmountB: willAddMintAmountB,
    walletTokenAccounts,
    clmmList,
    sPool,
    clmmPools,
  })
}

async function swap({ wallet, tokenAccounts, clmmPools, swapFromMintTokenAmount, swapToMintToken, clmmList, sPool, slippage }: {
  wallet: PublicKey,
  tokenAccounts: TokenAccount[],
  clmmPools: ApiClmmPoolsItem[],
  swapFromMintTokenAmount: TokenAmount,
  swapToMintToken: Token,
  clmmList: ClmmPoolInfo[],
  sPool: ApiPoolInfo,
  slippage: Percent,
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

  return {
    ins: innerTransactions,
    amountMin: routeInfo.minAmountOut,
  }
}