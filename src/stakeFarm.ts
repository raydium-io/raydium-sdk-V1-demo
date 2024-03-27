import assert from 'assert';

import {
  ApiFarmInfo,
  Farm,
  FarmPoolKeys,
  jsonInfo2PoolKeys,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import {
  connection,
  DEFAULT_TOKEN,
  ENDPOINT,
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
  targetFarm: string
  inputTokenAmount: TokenAmount
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

async function stakeFarm(input: TestTxInputInfo) {
  // -------- pre-action: fetch target farm json info --------
  const farmPools: ApiFarmInfo = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.farmInfo)).json()
  assert(farmPools, 'farm pool is undefined')
  const targetFarmJsonInfo: any = farmPools.raydium.find((pool) => pool.id === input.targetFarm)
  assert(targetFarmJsonInfo, 'target farm not found')
  const targetFarmInfo = jsonInfo2PoolKeys(targetFarmJsonInfo) as FarmPoolKeys

  const chainTime = Math.floor(new Date().getTime() / 1000) // TODO

  const { [input.targetFarm]: farmFetchInfo } = await Farm.fetchMultipleInfoAndUpdate({
    connection,
    pools: [targetFarmInfo],
    chainTime,
  })
  assert(Object.keys(farmFetchInfo).length && farmFetchInfo, 'cannot fetch target farm info')

  // -------- step 1: create instructions by SDK function --------
  const makeDepositInstruction = await Farm.makeDepositInstructionSimple({
    connection,
    poolKeys: targetFarmInfo,
    fetchPoolInfo: farmFetchInfo,
    ownerInfo: {
      feePayer: input.wallet.publicKey,
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
    amount: input.inputTokenAmount.raw,
    makeTxVersion,
  })

  return { txids: await buildAndSendTx(makeDepositInstruction.innerTransactions) }
}

async function howToUse() {
  const targetFarm = 'pool id' // RAY-USDC farm
  const lpToken = DEFAULT_TOKEN['RAY_USDC-LP']
  const inputTokenAmount = new TokenAmount(lpToken, 100)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  stakeFarm({
    targetFarm,
    inputTokenAmount,
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
