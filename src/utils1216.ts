import {
  buildTransaction,
  Utils1216,
} from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import {
  connection,
  PROGRAMIDS,
  wallet,
  wantBuildTxVersion,
} from '../config';
import {
  getWalletTokenAccount,
  sendTx,
} from './util';

type TestTxInputInfo = {
  wallet: Keypair
}

/**
 * utils1216 is for compensation
 *
 * pre-action: fetch compensation info list
 * step 1: create instructions by SDK function
 * step 2: compose instructions to several transactions
 * step 3: send transactions
 */
export async function utils1216(input: TestTxInputInfo) {
  // -------- pre-action: fetch compensation info list --------
  const infoList = await Utils1216.getAllInfo({
    connection,
    programId: PROGRAMIDS.UTIL1216,
    poolIds: Utils1216.DEFAULT_POOL_ID,
    wallet: input.wallet.publicKey,
    chainTime: new Date().getTime() / 1000,
  })

  // -------- step 1: create instructions by SDK function --------
  const claim = await Utils1216.makeClaimInstructionSimple({
    connection,
    poolInfo: infoList[0],
    ownerInfo: {
      wallet: input.wallet.publicKey,
      tokenAccounts: await getWalletTokenAccount(connection, input.wallet.publicKey),
      associatedOnly: true,
      checkCreateATAOwner: true,
    },
  })

  // -------- step 1: create instructions by SDK function --------
  const claimAll = await Utils1216.makeClaimAllInstructionSimple({
    connection,
    poolInfos: infoList,
    ownerInfo: {
      wallet: input.wallet.publicKey,
      tokenAccounts: await getWalletTokenAccount(connection, input.wallet.publicKey),
      associatedOnly: true,
      checkCreateATAOwner: true,
    },
  })

  // -------- step 2: compose instructions to several transactions --------
  const transactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: claimAll.innerTransactions,
  })

  // -------- step 3: send transactions --------
  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, transactions)
  return { txids }
}

async function howToUse() {
  utils1216({
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
