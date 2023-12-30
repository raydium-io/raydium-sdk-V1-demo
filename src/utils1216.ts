import { Utils1216 } from '@raydium-io/raydium-sdk';
import { Keypair } from '@solana/web3.js';

import {
  connection,
  makeTxVersion,
  PROGRAMIDS,
  wallet,
} from '../config';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type TestTxInputInfo = {
  wallet: Keypair
}

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
    makeTxVersion,
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
    makeTxVersion,
  })

  return { txids: await buildAndSendTx(claimAll.innerTransactions) }
}

async function howToUse() {
  utils1216({
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
