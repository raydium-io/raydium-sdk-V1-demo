import assert from 'assert';

import {
  AmmV3,
  ApiAmmV3PoolsItem,
  ENDPOINT,
  fetchMultipleMintInfos,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import {
  connection,
  DEFAULT_TOKEN,
  makeTxVersion,
  RAYDIUM_MAINNET_API,
  wallet,
} from '../config';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  baseToken: Token
  quoteToken: Token
  targetPool: string
  inputTokenAmount: TokenAmount
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
  userCursorSide: 'base' | 'quote'
}

/**
 * pre-action: fetch basic AmmV3 info
 *
 * step 1: ammV3 info and ammV3 position
 * step 2: calculate liquidity
 * step 3: create instructions by SDK function
 * step 4: compose instructions to several transactions
 * step 5: send transactions
 */
async function ammV3AddPosition(input: TestTxInputInfo): Promise<{ txids: string[] }> {
  // -------- pre-action: fetch basic info --------
  const ammV3Pools = (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools).then((res) => res.json())).data
  const ammV3Pool = ammV3Pools.find((pool: ApiAmmV3PoolsItem) => pool.id === input.targetPool)

  // -------- step 1: ammV3 info and ammV3 position --------
  const { [ammV3Pool.id]: sdkParsedAmmV3Info } = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: [ammV3Pool],
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
  })
  const { state: ammV3PoolInfo, positionAccount } = sdkParsedAmmV3Info
  assert(positionAccount && positionAccount.length, "position is not exist/is empty, so can't continue to add position")
  const ammV3Position = positionAccount[0] // assume first one is your target

  // -------- step 2: calculate liquidity --------
  const isFocus1 = input.userCursorSide === 'base'
  const isCoin1Base = input.baseToken.mint.equals(ammV3Pool.state.mintA.mint)
  const isPairPoolDirectionEq = (isFocus1 && isCoin1Base) || (!isCoin1Base && !isFocus1)
  const { liquidity, amountSlippageA, amountSlippageB } = AmmV3.getLiquidityAmountOutFromAmountIn({
    poolInfo: ammV3PoolInfo,
    slippage: 0,
    inputA: isPairPoolDirectionEq,
    tickUpper: ammV3Position.tickUpper,
    tickLower: ammV3Position.tickLower,
    amount: input.inputTokenAmount.raw,
    add: true, // SDK flag for math round direction
    amountHasFee: true,
    token2022Infos: await fetchMultipleMintInfos({ connection, mints: [ammV3PoolInfo.mintA.mint, ammV3PoolInfo.mintB.mint]}),
    epochInfo: await connection.getEpochInfo()
  })

  // -------- step 3: create instructions by SDK function --------
  const makeIncreaseLiquidityInstruction = await AmmV3.makeIncreasePositionFromLiquidityInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo,
    ownerPosition: ammV3Position,
    ownerInfo: {
      feePayer: input.wallet.publicKey,
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
    liquidity,
    makeTxVersion,
    amountMaxA: amountSlippageA.amount,
    amountMaxB: amountSlippageB.amount,
  })

  return { txids: await buildAndSendTx(makeIncreaseLiquidityInstruction.innerTransactions) }
}

async function howToUse() {
  const baseToken = DEFAULT_TOKEN.USDC // USDC
  const quoteToken = DEFAULT_TOKEN.RAY // RAY
  const targetPool = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht' // USDC-RAY pool
  const inputTokenAmount = new TokenAmount(DEFAULT_TOKEN.RAY, 10000)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const userCursorSide: 'base' | 'quote' = 'base'

  ammV3AddPosition({
    baseToken,
    quoteToken,
    targetPool,
    inputTokenAmount,
    walletTokenAccounts,
    wallet: wallet,
    userCursorSide,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
