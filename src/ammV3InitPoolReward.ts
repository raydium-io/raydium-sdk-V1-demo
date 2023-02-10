import Decimal from 'decimal.js'

import {
  AmmV3,
  ApiAmmV3PoolsItem,
  buildTransaction,
  ENDPOINT,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk'
import { Keypair, PublicKey } from '@solana/web3.js'

import { connection, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  targetPool: string
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
  rewardInfos: { token: Token; openTime: number; endTime: number; perSecond: Decimal }[]
}

async function ammV3InitPoolReward(input: TestTxInputInfo) {
  // -------- pre-action: fetch basic info --------
  const ammV3Pools = (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools).then((res) => res.json())).data
  const ammV3Pool = ammV3Pools.find((pool: ApiAmmV3PoolsItem) => pool.id === input.targetPool)

  // -------- step 1: ammV3 info and ammV3 position --------
  const { [ammV3Pool.id]: sdkParsedAmmV3Info } = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: [ammV3Pool],
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
  })
  const { state: ammV3PoolInfo } = sdkParsedAmmV3Info

  // prepare instruction
  const makeInitRewardsInstruction = await AmmV3.makeInitRewardsInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo,
    ownerInfo: {
      feePayer: input.wallet.publicKey,
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
    rewardInfos: input.rewardInfos.map((r) => ({ ...r, mint: r.token.mint })),
  })
  // prepare transactions
  const makeInitRewardsTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: makeInitRewardsInstruction.innerTransactions,
  })

  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, makeInitRewardsTransactions)
  return { txids }
}

async function howToUse() {
  const targetPool = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht' // USDC-RAY pool
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY')
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const rewardInfos = [
    {
      token: RAYToken,
      openTime: 4073858467, // Wed Feb 04 2099 03:21:07 GMT+0000
      endTime: 4076277667, // Wed Mar 04 2099 03:21:07 GMT+0000
      perSecond: new Decimal(0.000001),
    },
  ]

  ammV3InitPoolReward({
    targetPool,
    walletTokenAccounts,
    wallet: wallet,
    rewardInfos,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
