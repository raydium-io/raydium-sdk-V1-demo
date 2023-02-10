import assert from 'assert';

import {
  ApiFarmInfo,
  buildTransaction,
  Farm,
  FarmPoolKeys,
  jsonInfo2PoolKeys,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import {
  connection,
  ENDPOINT,
  RAYDIUM_MAINNET_API,
  wallet,
  wantBuildTxVersion,
} from '../config';
import {
  getWalletTokenAccount,
  sendTx,
} from './util';

async function stakeFarm() {
  // target farm public key string, in this example, RAY-USDC farm
  const targetFarmPublicKeyString = 'CHYrUBX2RKX8iBg7gYTkccoGNBzP44LdaazMHCLcdEgS';

  // get farm pool list
  const farmPool: ApiFarmInfo = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.farmInfo)).json();
  assert(farmPool, 'farm pool is undefined');

  // get target farm json info
  const targetFarmJsonInfo: any = farmPool.raydium.find((pool) => pool.id === targetFarmPublicKeyString);
  assert(targetFarmJsonInfo, 'target farm not found');

  // parse farm pool json info to to fit FarmPoolKeys type
  const targetFarmInfo = jsonInfo2PoolKeys(targetFarmJsonInfo) as FarmPoolKeys;

  // fetch target farm info
  const farmFetchInfo = (await Farm.fetchMultipleInfoAndUpdate({
    connection,
    pools: [targetFarmInfo],
  }))[targetFarmPublicKeyString];
  assert(
    Object.keys(farmFetchInfo).length !== 0 && farmFetchInfo,
    'cannot fetch target farm info'
  );

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // prepare deposit amount
  const lpToken = new Token(
    new PublicKey('FbC6K13MzHvN42bXrtGaWsvZY9fxrackRSZcBGfjPc7m'),
    6,
    'RAY-USDC',
    'RAY-USDC'
  );
  const inputTokenAmount = new TokenAmount(lpToken, 100);

  // prepare instruction
  const makeDepositInstruction = await Farm.makeDepositInstructionSimple({
    connection,
    poolKeys: targetFarmInfo,
    fetchPoolInfo: farmFetchInfo,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
    amount: inputTokenAmount.raw,
  });

  // prepare transactions
  const makeDepositTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeDepositInstruction.innerTransactions,
  });

  // send transactions
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeDepositTransactions);
  console.log(txids);
}

stakeFarm();
