import assert from 'assert';

import {
  AmmV3,
  AmmV3PoolInfo,
  AmmV3PoolPersonalPosition,
  ApiAmmV3PoolsItem,
} from '@raydium-io/raydium-sdk';

import {
  connection,
  wallet,
} from '../config';
import { getWalletTokenAccount } from './util';

async function ammV3OwnerPositionInfo() {
  // target pool id, in this example, USDC-RAY pool
  const targetPoolId = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht';
  // wallet accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);
  // get all pool info from api
  const ammV3Pool = (await (await fetch('https://api.raydium.io/v2/ammV3/ammPools')).json()).data.filter(
    (pool: ApiAmmV3PoolsItem) => pool.id === targetPoolId
  );

  let ammV3PoolInfoList: AmmV3PoolInfo[] = [];
  let ammV3PersonalPositionList: AmmV3PoolPersonalPosition[] = [];
  Object.values(
    await AmmV3.fetchMultiplePoolInfos({
      connection,
      poolKeys: ammV3Pool,
      chainTime: new Date().getTime() / 1000,
      ownerInfo: {
        wallet: wallet.publicKey,
        tokenAccounts: walletTokenAccountFormat,
      },
    })
  ).forEach((i) => {
    ammV3PoolInfoList.push(i.state);
    if (i.positionAccount) {
      ammV3PersonalPositionList = i.positionAccount;
    }
  });

  // if no pool info, abort
  assert(ammV3PoolInfoList.length > 0, 'cannot find the target pool info');
  // if no position
  assert(ammV3PersonalPositionList.length > 0, 'no position in the target pool');

  console.log('owner position info for target pool:', ammV3PersonalPositionList);
}

ammV3OwnerPositionInfo();
