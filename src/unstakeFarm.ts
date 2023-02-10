import assert from 'assert';

import {
  ApiFarmInfo,
  buildTransaction,
  ENDPOINT,
  Farm,
  FarmPoolKeys,
  jsonInfo2PoolKeys,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';

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

async function unstakeFarm() {
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
  const farmFetchInfo = await Farm.fetchMultipleInfoAndUpdate({
    connection,
    pools: [targetFarmInfo],
    owner: wallet.publicKey,
  });
  assert(
    Object.keys(farmFetchInfo).length !== 0 && farmFetchInfo[targetFarmPublicKeyString],
    'cannot fetch target farm info'
  );

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // prepare withdraw amount
  const lpToken = new Token(
    targetFarmInfo.lpMint,
    6,
    'RAY-USDC',
    'RAY-USDC'
  );
  const inputTokenAmount = new TokenAmount(lpToken, 100);

  // prepare instruction
  const makeWithdrawInstruction = await Farm.makeWithdrawInstructionSimple({
    connection,
    fetchPoolInfo: farmFetchInfo[targetFarmPublicKeyString],
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
    amount: inputTokenAmount.raw,
  });

  // prepare transactions
  const makeWithdrawTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeWithdrawInstruction.innerTransactions,
  });

  // send transactions
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeWithdrawTransactions);
  console.log(txids);
}

unstakeFarm();
