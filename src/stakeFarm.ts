import assert from 'assert';

import {
  ApiFarmInfo,
  buildTransaction,
  Farm,
  FarmPoolKeys,
  jsonInfo2PoolKeys,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  ENDPOINT,
  RAYDIUM_MAINNET_API,
  wallet,
  wantBuildTxVersion,
} from '../config';
import {
  getWalletTokenAccount,
  sendTx,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  targetFarm: string
  inputTokenAmount: TokenAmount
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

/**
 * pre-action: fetch target farm json info
 *
 * step 1: create instructions by SDK function
 * step 2: compose instructions to several transactions
 * step 3: send transactions
 */
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
  })

  // -------- step 2: compose instructions to several transactions --------
  const makeDepositTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: makeDepositInstruction.innerTransactions,
  })

  // -------- step 3: send transactions --------
  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, makeDepositTransactions)
  return { txids }
}

async function howToUse() {
  const targetFarm = 'CHYrUBX2RKX8iBg7gYTkccoGNBzP44LdaazMHCLcdEgS' // RAY-USDC farm
  const lpToken = new Token(new PublicKey('FbC6K13MzHvN42bXrtGaWsvZY9fxrackRSZcBGfjPc7m'), 6, 'RAY-USDC', 'RAY-USDC')
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
