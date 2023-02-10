import {
  buildTransaction,
  ENDPOINT,
  Farm,
  LiquidityPoolJsonInfo,
  MAINNET_PROGRAM_ID,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk'
import { Keypair, PublicKey } from '@solana/web3.js'
import assert from 'assert'
import { connection, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  baseToken: Token
  quoteToken: Token
  targetPool: string
  inputTokenAmount: TokenAmount
  slippage: Percent
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
  rewardInfos: {
    token: Token
    openTime: number
    endTime: number
    perSecond: number
    type?: 'Standard SPL' | 'Option tokens'
  }[]
  lockInfo: {
    lockMint: PublicKey
    lockVault: PublicKey
  }
}

/**
 * pre-action: fetch basic AmmV3 info
 *
 * step 1: create instructions by SDK function
 * step 2: compose instructions to several transactions
 * step 3: send transactions
 */
async function createFarm(input: TestTxInputInfo) {
  // -------- pre-action: fetch basic info --------
  const ammPool = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.poolInfo)).json() // If the Liquidity pool is not required for routing, then this variable can be configured as undefined
  const targetPoolInfo = [...ammPool.official, ...ammPool.unOfficial].find(
    (info) => info.id === input.targetPool
  ) as LiquidityPoolJsonInfo
  assert(targetPoolInfo, 'cannot find the target pool')

  // -------- step 1: create instructions by SDK function --------
  const makeCreateFarmInstruction = await Farm.makeCreateFarmInstructionSimple({
    connection,
    userKeys: {
      tokenAccounts: input.walletTokenAccounts,
      owner: input.wallet.publicKey,
    },
    poolInfo: {
      version: 6,
      programId: MAINNET_PROGRAM_ID.FarmV6,
      lpMint: new PublicKey(targetPoolInfo.lpMint),
      rewardInfos: input.rewardInfos.map((r) => ({
        rewardMint: r.token.mint,
        rewardOpenTime: r.openTime,
        rewardEndTime: r.endTime,
        rewardPerSecond: r.perSecond,
        rewardType: r.type ?? 'Standard SPL',
      })),
      lockInfo: input.lockInfo,
    },
  })

  // -------- step 2: compose instructions to several transactions --------
  const makeCreateFarmTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: makeCreateFarmInstruction.innerTransactions,
  })

  // -------- step 3: send transactions --------
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeCreateFarmTransactions)
  return { txids }
}

async function howToUse() {
  const baseToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC
  const quoteToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
  const targetPool = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht' // USDC-RAY pool
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY')
  const inputTokenAmount = new TokenAmount(RAYToken, 10000)
  const slippage = new Percent(1, 100)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const rewardInfos = [
    {
      token: RAYToken,
      perSecond: 1,
      openTime: 4073858467, // Wed Feb 04 2099 03:21:07 GMT+0000
      endTime: 4076277667, // Wed Mar 04 2099 03:21:07 GMT+0000
    },
  ]
  const lockInfo = {
    lockMint: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
    lockVault: new PublicKey('FrspKwj8i3pNmKwXreTveC4fu7KL5ZbGeXdZBe2XViu1'),
  }

  createFarm({
    baseToken,
    quoteToken,
    targetPool,
    inputTokenAmount,
    slippage,
    walletTokenAccounts,
    wallet: wallet,
    rewardInfos,
    lockInfo,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
