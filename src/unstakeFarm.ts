import assert from 'assert';

import {
  ApiFarmInfo,
  ENDPOINT,
  Farm,
  FarmPoolKeys,
  jsonInfo2PoolKeys,
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
  targetFarm: string
  inputTokenAmount: TokenAmount
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

async function unstakeFarm(input: TestTxInputInfo) {
  // -------- pre-action: fetch farm info --------
  const farmPool: ApiFarmInfo = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.farmInfo)).json()
  assert(farmPool, 'farm pool is undefined')
  const targetFarmJsonInfo: any = farmPool.raydium.find((pool) => pool.id === input.targetFarm)
  assert(targetFarmJsonInfo, 'target farm not found')
  const targetFarmInfo = jsonInfo2PoolKeys(targetFarmJsonInfo) as FarmPoolKeys

  const chainTime = Math.floor(new Date().getTime() / 1000) // TODO
  // -------- step 1: Fetch farm pool info --------
  const { [input.targetFarm]: farmPoolInfo } = await Farm.fetchMultipleInfoAndUpdate({
    connection,
    pools: [targetFarmInfo],
    owner: input.wallet.publicKey,
    chainTime,
  })
  assert(farmPoolInfo, 'cannot fetch target farm info')

  // -------- step 2: create instructions by SDK function --------
  const makeWithdrawInstruction = await Farm.makeWithdrawInstructionSimple({
    connection,
    fetchPoolInfo: farmPoolInfo,
    ownerInfo: {
      feePayer: input.wallet.publicKey,
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
    amount: input.inputTokenAmount.raw,
    makeTxVersion,
  })

  return { txids: await buildAndSendTx(makeWithdrawInstruction.innerTransactions) }
}

async function howToUse() {
  const targetFarm = 'pool id' // RAY-USDC farm
  const lpToken = DEFAULT_TOKEN['RAY_USDC-LP']
  const inputTokenAmount = new TokenAmount(lpToken, 100)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  unstakeFarm({
    targetFarm,
    inputTokenAmount,
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
