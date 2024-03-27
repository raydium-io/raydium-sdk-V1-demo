import assert from 'assert';
import BN from 'bn.js';

import {
  Clmm,
  ZERO
} from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import {
  connection,
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
}

async function clmmRemovePosition(input: TestTxInputInfo) {
  // -------- pre-action: fetch basic info --------
  const clmmPool = await formatClmmKeysById(input.targetPool)

  // -------- step 1: ammV3 info and ammV3 position --------
  const { [clmmPool.id]: sdkParsedAmmV3Info } = await Clmm.fetchMultiplePoolInfos({
    connection,
    poolKeys: [clmmPool],
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
  })
  const { state: clmmPoolInfo, positionAccount } = sdkParsedAmmV3Info
  assert(positionAccount && positionAccount.length, "position is not exist/is empty, so can't continue to add position")
  const ammV3Position = positionAccount[0] // assume first one is your target

  // -------- step 2: make ammV3 remove position instructions --------
  const makeDecreaseLiquidityInstruction = await Clmm.makeDecreaseLiquidityInstructionSimple({
    connection,
    poolInfo: clmmPoolInfo,
    ownerPosition: ammV3Position,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
      // closePosition: true, // for close
    },
    liquidity: ammV3Position.liquidity.div(new BN(2)), //for close position, use 'ammV3Position.liquidity' without dividend
    // slippage: 1, // if encouter slippage check error, try uncomment this line and set a number manually
    makeTxVersion,
    amountMinA: ZERO,
    amountMinB: ZERO
  })

  return { txids: await buildAndSendTx(makeDecreaseLiquidityInstruction.innerTransactions) }
}

async function howToUse() {
  const targetPool = 'pool id' // USDC-RAY pool
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  clmmRemovePosition({
    targetPool,
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
