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

  const farmPool: ApiFarmInfo = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.farmInfo)).json();
  assert(farmPool, 'farm pool is undefined');

  let targetFarmJsonInfo: any = farmPool.raydium.find((pool) => pool.id === targetFarmPublicKeyString);
  assert(targetFarmJsonInfo, 'target farm not found');

  // parse farm pool json info to fit
  const symbol = targetFarmJsonInfo.symbol;
  delete targetFarmJsonInfo.symbol;
  let targetFarmInfo = jsonInfo2PoolKeys(targetFarmJsonInfo);
  targetFarmInfo['symbol'] = symbol;

  const farmFetchInfo = await Farm.fetchMultipleInfoAndUpdate({
    connection,
    pools: [targetFarmInfo as FarmPoolKeys],
  });
  assert(
    Object.keys(farmFetchInfo).length !== 0 && farmFetchInfo[targetFarmPublicKeyString],
    'cannot fetch target farm info'
  );

  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  const lpToken = new Token(
    new PublicKey('FbC6K13MzHvN42bXrtGaWsvZY9fxrackRSZcBGfjPc7m'),
    6,
    'RAY-USDC',
    'RAY-USDC'
  );
  const inputTokenAmount = new TokenAmount(lpToken, 100);

  const makeDepositInstruction = await Farm.makeDepositInstructionSimple({
    connection,
    poolKeys: targetFarmInfo as FarmPoolKeys,
    fetchPoolInfo: farmFetchInfo[targetFarmPublicKeyString],
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
    amount: inputTokenAmount.raw,
  });

  const makeDepositTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeDepositInstruction.innerTransactions,
  });

  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeDepositTransactions);
  console.log(txids);
}

stakeFarm();
