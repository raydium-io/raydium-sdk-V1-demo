import BN from 'bn.js'
import assert from 'assert'

import {
  AmmV3,
  ApiAmmV3PoolsItem,
  buildTransaction,
  ENDPOINT,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk'

import { connection, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'
import { Keypair, PublicKey } from '@solana/web3.js'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  targetPool: string
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

/**
 * pre-action: fetch basic info
 * step 1: ammV3 info and ammV3 position
 * step 2: make ammV3 remove position instructions
 * step 3: create instructions by SDK function
 * step 4: send transaction
 */
async function ammV3RemovePosition(input: TestTxInputInfo) {
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

  // -------- step 2: make ammV3 remove position instructions --------
  const makeDecreaseLiquidityInstruction = await AmmV3.makeDecreaseLiquidityInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo,
    ownerPosition: ammV3Position,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
      // closePosition: true, // for close
    },
    liquidity: ammV3Position.liquidity.div(new BN(2)), //for close position, use 'ammV3Position.liquidity' without dividend
    // slippage: 1, // if encouter slippage check error, try uncomment this line and set a number manually
  })

  // -------- step 3: create instructions by SDK function --------
  const makeDecreaseLiquidityTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeDecreaseLiquidityInstruction.innerTransactions,
  })

  // -------- step 4: send transaction --------
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeDecreaseLiquidityTransactions)
  return { txids }
}

async function howToUse() {
  const targetPool = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht' // USDC-RAY pool
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  ammV3RemovePosition({
    targetPool,
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
