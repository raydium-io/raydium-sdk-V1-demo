import Decimal from 'decimal.js';

import {
  AmmV3,
  ApiAmmV3PoolsItem,
  buildTransaction,
  ENDPOINT,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import {
  connection,
  RAYDIUM_MAINNET_API,
  wallet,
  wantBuildTxVersion,
} from '../config';
import {
  getWalletTokenAccount,
  sendTx,
} from './util';

// THIS DEMO HAS NOT BEEN TESTING YET!!!!!

async function ammV3InitPoolReward() {
  // target pool id, in this example, RAY-USDC pool
  const targetPoolId = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht';
  // get all pool info from api
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data.filter(
    (pool: ApiAmmV3PoolsItem) => pool.id === targetPoolId
  );
  const ammV3PoolInfoDict = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: ammV3Pool,
    chainTime: new Date().getTime() / 1000,
  })

  // get the first pool info
  const ammV3PoolInfo = ammV3PoolInfoDict[targetPoolId].state

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // prepare instruction
  const makeInitRewardsInstruction = await AmmV3.makeInitRewardsInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
    rewardInfos: [
      {
        mint: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
        openTime: 4073858467, // Wed Feb 04 2099 03:21:07 GMT+0000
        endTime: 4076277667, // Wed Mar 04 2099 03:21:07 GMT+0000
        perSecond: new Decimal(0.000001),
      },
    ],
  });
  // prepare transactions
  const makeInitRewardsTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeInitRewardsInstruction.innerTransactions,
  });

  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeInitRewardsTransactions);
  console.log(txids);
}

ammV3InitPoolReward();
