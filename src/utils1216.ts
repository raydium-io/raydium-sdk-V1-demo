import {
  buildTransaction,
  Utils1216,
} from '@raydium-io/raydium-sdk';

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

export async function utils1216() {
  const infoList = await Utils1216.getAllInfo({
    connection,
    programId: PROGRAMIDS.UTIL1216,
    poolIds: Utils1216.DEFAULT_POOL_ID,
    wallet: wallet.publicKey,
    chainTime: new Date().getTime() / 1000
  })
  
  console.log(infoList)

  const claim = await Utils1216.makeClaimInstructionSimple({
    connection,
    poolInfo: infoList[0],
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: await getWalletTokenAccount(connection, wallet.publicKey),
      associatedOnly: true
    }
  })

  const claimAll = await Utils1216.makeClaimAllInstructionSimple({
    connection,
    poolInfos: infoList,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: await getWalletTokenAccount(connection, wallet.publicKey),
      associatedOnly: true
    }
  })

  console.log(claimAll.innerTransactions)


  const transactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: claimAll.innerTransactions,
  })
  console.log(transactions)

  const txids = await sendTx(connection, wallet, wantBuildTxVersion, transactions)
  console.log(txids)
}

utils1216()