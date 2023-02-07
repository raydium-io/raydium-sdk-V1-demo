import assert from 'assert';

import {
  ApiFarmInfo,
  ENDPOINT,
} from '@raydium-io/raydium-sdk';

import { RAYDIUM_MAINNET_API } from '../config';

// THIS DEMO HAS NOT FINISHED YET!!!!!

async function initFarmReward() {
  // target farm public key string, in this example, USDC-PEPE farm
  const targetFarmlPublicKeyString = 'BuK4gB4fK8D6Fv3WYh6hefv9D3a6NKvASdWstwfbth5i';

  const farmPool: ApiFarmInfo = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.farmInfo)).json();
  assert(farmPool, 'farm pool is undefined');

  let targetFarmJsonInfo = farmPool.ecosystem.find((pool) => pool.id === targetFarmlPublicKeyString);
  assert(targetFarmJsonInfo, 'target farm not found');
  console.log('targetFarmJsonInfo: ', targetFarmJsonInfo);

  const symbol = targetFarmJsonInfo.symbol;

  // TODO: below jsonInfo2PoolKeys func will be failed, because targetFarmJsonInfo.symbol is not a public key
  // const targetFarmInfo = jsonInfo2PoolKeys(targetFarmJsonInfo);

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
