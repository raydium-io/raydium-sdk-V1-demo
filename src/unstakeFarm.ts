import assert from 'assert'
import {
  ApiFarmInfo,
  buildTransaction,
  ENDPOINT,
  Farm,
  FarmPoolKeys,
  jsonInfo2PoolKeys,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk'
import { connection, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'
import { Keypair, PublicKey } from '@solana/web3.js'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  targetFarm: string
  inputTokenAmount: TokenAmount
  slippage: Percent
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

/**
 * pre-action: fetch farm info
 * step 1: Fetch farm pool info
 * step 2: create instructions by SDK function
 * step 3: compose instructions to several transactions
 * step 4: send transactions
 */
async function unstakeFarm(input: TestTxInputInfo) {
  // -------- pre-action: fetch farm info --------
  const farmPool: ApiFarmInfo = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.farmInfo)).json()
  assert(farmPool, 'farm pool is undefined')
  const targetFarmJsonInfo: any = farmPool.raydium.find((pool) => pool.id === input.targetFarm)
  assert(targetFarmJsonInfo, 'target farm not found')
  const targetFarmInfo = jsonInfo2PoolKeys(targetFarmJsonInfo) as FarmPoolKeys

  // -------- step 1: Fetch farm pool info --------
  const { [input.targetFarm]: farmPoolInfo } = await Farm.fetchMultipleInfoAndUpdate({
    connection,
    pools: [targetFarmInfo],
    owner: input.wallet.publicKey,
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
  })

  // -------- step 3: compose instructions to several transactions --------
  const makeWithdrawTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: makeWithdrawInstruction.innerTransactions,
  })

  // -------- step 4: send transactions --------
  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, makeWithdrawTransactions)
  return { txids }
}

async function howToUse() {
  const targetFarm = 'CHYrUBX2RKX8iBg7gYTkccoGNBzP44LdaazMHCLcdEgS' // RAY-USDC farm
  const lpToken = new Token(new PublicKey('FbC6K13MzHvN42bXrtGaWsvZY9fxrackRSZcBGfjPc7m'), 6, 'RAY-USDC', 'RAY-USDC')
  const inputTokenAmount = new TokenAmount(lpToken, 100)
  const slippage = new Percent(1, 100)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  unstakeFarm({
    targetFarm,
    inputTokenAmount,
    slippage,
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
