import assert from 'assert';

import {
  ApiFarmInfo,
  ENDPOINT,
  jsonInfo2PoolKeys,
} from '@raydium-io/raydium-sdk';

import { RAYDIUM_MAINNET_API } from '../config';

// THIS DEMO HAS NOT FINISHED YET!!!!!

async function initFarmReward() {
  // target farm public key string, in this example, USDC-PEPE farm
  const targetFarmPublicKeyString = 'BuK4gB4fK8D6Fv3WYh6hefv9D3a6NKvASdWstwfbth5i';

  // get farm pool list
  const farmPool: ApiFarmInfo = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.farmInfo)).json();
  assert(farmPool, 'farm pool is undefined');

  let targetFarmJsonInfo: any = farmPool.ecosystem.find((pool) => pool.id === targetFarmPublicKeyString);
  assert(targetFarmJsonInfo, 'target farm not found');

  // parse farm pool json info to to fit FarmPoolKeys type
  const symbol = targetFarmJsonInfo.symbol;
  delete targetFarmJsonInfo.symbol;
  let targetFarmInfo = jsonInfo2PoolKeys(targetFarmJsonInfo);
  targetFarmInfo['symbol'] = symbol;

  // developing by Rudy🎉
  // const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // const makeRestartFarmInstruction = await Farm.makeRestartFarmInstructionSimple({
  //   connection,
  //   poolKeys: { ...targetFarmInfo },
  //   userKeys: {
  //     tokenAccounts: walletTokenAccountFormat,
  //     owner: wallet.publicKey,
  //   },
  //   newRewardInfo: {
  //     rewardMint: targetFarmInfo.rewardInfos
  //     rewardPerSecond: targetFarmInfo.rewardInfos.rewardPerSecond,
  //   },
  // });
}

initFarmReward();
