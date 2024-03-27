import assert from 'assert';

import {
  Farm,
  MAINNET_PROGRAM_ID,
  Token
} from '@raydium-io/raydium-sdk';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  DEFAULT_TOKEN,
  makeTxVersion,
  wallet
} from '../config';
import { formatAmmKeysById } from './formatAmmKeysById';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  targetPool: string
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

async function createFarm(input: TestTxInputInfo) {
  // -------- pre-action: fetch basic info --------
  const targetPoolInfo = await formatAmmKeysById(input.targetPool)
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
    makeTxVersion,
  })

  return { txids: await buildAndSendTx(makeCreateFarmInstruction.innerTransactions) }
}

async function howToUse() {
  const targetPool = 'pool id' // USDC-RAY pool
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const rewardInfos = [
    {
      token: DEFAULT_TOKEN.RAY,
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
    targetPool,
    walletTokenAccounts,
    wallet: wallet,
    rewardInfos,
    lockInfo,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
