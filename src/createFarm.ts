import assert from 'assert';

import {
  buildTransaction,
  Farm,
  LiquidityPoolJsonInfo,
  MAINNET_PROGRAM_ID,
  Token,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import {
  connection,
  wallet,
  wantBuildTxVersion,
} from '../config';
import { getWalletTokenAccount } from './util';

// THIS DEMO HAS NOT BEEN TESTING YET!!!!!

async function createFarm() {
  // target pool public key string, in this example, USDC-RAY pool
  const targetPoolPublicKeyString = 'EVzLJhqMtdC1nPmz8rNd6xGfVjDPxpLZgq7XJuNfMZ6';
  // get v2 pool list
  const ammV2Pool = await (await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json')).json(); // If the Liquidity pool is not required for routing, then this variable can be configured as undefined
  // get target pool
  const targetPoolInfos = [...ammV2Pool.official, ...ammV2Pool.unOfficial].filter(
    (info) => info.id === targetPoolPublicKeyString
  );

  assert(targetPoolInfos.length > 0, 'cannot find the target pool');

  const targetPoolInfo = targetPoolInfos[0] as LiquidityPoolJsonInfo;

  console.log('targetPoolInfo: ', targetPoolInfo.lpMint);
  // wallet accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY');
  const lockMint = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'; // NOTE: test
  const lockVault = 'FrspKwj8i3pNmKwXreTveC4fu7KL5ZbGeXdZBe2XViu1'; // NOTE: test

  const makeCreateFarmInstruction = await Farm.makeCreateFarmInstructionSimple({
    connection,
    userKeys: {
      tokenAccounts: walletTokenAccountFormat,
      owner: wallet.publicKey,
    },
    poolInfo: {
      version: 6,
      programId: MAINNET_PROGRAM_ID.FarmV6,
      lpMint: new PublicKey(targetPoolInfo.lpMint),
      rewardInfos: [
        {
          rewardMint: RAYToken.mint,
          rewardPerSecond: 1,
          rewardOpenTime: 1675958400, // Thu Feb 09 2023 16:00:00 GMT+0000
          rewardEndTime: 1676822400, // Sun Feb 19 2023 16:00:00 GMT+0000
          rewardType: 'Standard SPL',
        },
      ],
      lockInfo: {
        lockMint: new PublicKey(lockMint),
        lockVault: new PublicKey(lockVault),
      },
    },
  });

  const makeCreateFarmTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeCreateFarmInstruction.innerTransactions,
  });

  console.log(
    await Promise.all(makeCreateFarmTransactions.map(async (i) => await connection.simulateTransaction(i)))
  );
  return;
}

createFarm();
