import assert from 'assert';

import {
  buildTransaction,
  ENDPOINT,
  Farm,
  LiquidityPoolJsonInfo,
  MAINNET_PROGRAM_ID,
  Token,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import {
  connection,
  RAYDIUM_MAINNET_API,
  wallet,
  wantBuildTxVersion,
} from '../config';
import { getWalletTokenAccount } from './util';

// THIS DEMO HAS NOT BEEN TESTING YET!!!!!

async function createFarm() {
  // target pool public key string, in this example, USDC-RAY pool
  const targetPoolPublicKeyString = 'EVzLJhqMtdC1nPmz8rNd6xGfVjDPxpLZgq7XJuNfMZ6';
  // get v2 pool list
  const ammV2Pool = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.poolInfo)).json(); // If the Liquidity pool is not required for routing, then this variable can be configured as undefined
  // get target pool
  const targetPoolInfo = [...ammV2Pool.official, ...ammV2Pool.unOfficial].find(
    (info) => info.id === targetPoolPublicKeyString
  ) as LiquidityPoolJsonInfo;

  assert(targetPoolInfo, 'cannot find the target pool');

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // reward token
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY');

  // lock info
  const lockMint = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
  const lockVault = 'FrspKwj8i3pNmKwXreTveC4fu7KL5ZbGeXdZBe2XViu1';

  // prepare instruction
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

  // prepare transactions
  const makeCreateFarmTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeCreateFarmInstruction.innerTransactions,
  });

  // simulate transactions
  console.log(
    await Promise.all(makeCreateFarmTransactions.map(async (i) => await connection.simulateTransaction(i)))
  );
  return;
}

createFarm();
