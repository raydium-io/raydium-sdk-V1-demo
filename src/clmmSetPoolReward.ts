import Decimal from 'decimal.js';

import {
  Clmm,
  Token
} from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import {
  connection,
  DEFAULT_TOKEN,
  makeTxVersion,
  wallet
} from '../config';
import { formatClmmKeysById } from './formatClmmKeysById';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  targetPool: string
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
  rewardInfos: { token: Token; openTime: number; endTime: number; perSecond: Decimal }[]
}

async function clmmSetPoolReward(input: TestTxInputInfo) {
  // -------- pre-action: fetch basic info --------
  const clmmPool = await formatClmmKeysById(input.targetPool)

  // -------- step 1: clmm info  --------
  const { [clmmPool.id]: { state: clmmPoolInfo } } = await Clmm.fetchMultiplePoolInfos({
    connection,
    poolKeys: [clmmPool],
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
  })

  // -------- step 2: create set reward instructions --------
  const makeSetRewardsInstruction = await Clmm.makeSetRewardsInstructionSimple({
    connection,
    poolInfo: clmmPoolInfo,
    ownerInfo: {
      feePayer: input.wallet.publicKey,
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
    rewardInfos: input.rewardInfos.map((r) => ({ ...r, mint: r.token.mint, programId: r.token.programId, })),
    chainTime: new Date().getTime() / 1000,
    makeTxVersion,
  })

  return { txids: await buildAndSendTx(makeSetRewardsInstruction.innerTransactions) }
}

async function howToUse() {
  const targetPool = 'pool id' // USDC-RAY pool
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const rewardInfos = [
    {
      token: DEFAULT_TOKEN.RAY,
      openTime: 4073858467, // Wed Feb 04 2099 03:21:07 GMT+0000
      endTime: 4076277667, // Wed Mar 04 2099 03:21:07 GMT+0000
      perSecond: new Decimal(0.000001),
    },
  ]

  clmmSetPoolReward({
    targetPool,
    walletTokenAccounts,
    wallet: wallet,
    rewardInfos,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
