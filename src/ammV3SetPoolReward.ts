import assert from 'assert';
import Decimal from 'decimal.js';

import { AmmV3, ApiAmmV3PoolsItem, buildTransaction } from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection, wallet, wantBuildTxVersion } from '../config';
import { getWalletTokenAccount } from './util';

// THIS DEMO HAS NOT BEEN TESTING YET!!!!!

async function ammV3SetPoolReward() {
  // target pool id, in this example, USDC-RAY pool
  const targetPoolId = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht';
  // get all pool info from api
  const ammV3Pool = (await (await fetch('https://api.raydium.io/v2/ammV3/ammPools')).json()).data.filter(
    (pool: ApiAmmV3PoolsItem) => pool.id === targetPoolId
  );
  const ammV3PoolInfoList = Object.values(
    await AmmV3.fetchMultiplePoolInfos({
      connection,
      poolKeys: ammV3Pool,
      chainTime: new Date().getTime() / 1000,
    })
  ).map((i) => i.state);

  // if no pool info, abort
  assert(ammV3PoolInfoList.length > 0, 'cannot find the target pool info');

  // get the first pool info
  const ammV3PoolInfo = ammV3PoolInfoList[0];

  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  const makeSetRewardsInstruction = await AmmV3.makeSetRewardsInstructionSimple({
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
    chainTime: new Date().getTime() / 1000,
  });

  const openPoolPositiontransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeSetRewardsInstruction.innerTransactions,
  });

  console.log(
    await Promise.all(openPoolPositiontransactions.map(async (i) => await connection.simulateTransaction(i)))
  );
}

ammV3SetPoolReward();
