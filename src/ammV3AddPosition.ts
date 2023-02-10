import assert from 'assert';

import {
  AmmV3,
  AmmV3PoolInfo,
  AmmV3PoolPersonalPosition,
  ApiAmmV3PoolsItem,
  buildTransaction,
  ENDPOINT,
  Token,
  TokenAmount,
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

async function ammV3AddPosition() {
  // target pool id, in this example, USDC-RAY pool
  const targetPoolId = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht';
  // wallet accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);
  // get all pool info from api
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data.filter(
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

  // get the first pool info (which is our target pool)
  const ammV3PoolInfo = ammV3PoolInfoList[0];
  // get the first position we have (you can choose other position for adding)
  const ammV3Position = ammV3PersonalPositionList[0];

  // prepare base token amount
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY');
  const inputTokenAmount = new TokenAmount(RAYToken, 10000);

  // calculate liquidity base on 'base token amount'
  const { liquidity } = AmmV3.getLiquidityAmountOutFromAmountIn({
    poolInfo: ammV3PoolInfo,
    slippage: 0,
    inputA: true,
    tickUpper: ammV3Position.tickUpper,
    tickLower: ammV3Position.tickLower,
    amount: inputTokenAmount.raw,
    add: true, // SDK flag for math round direction
  });

  // prepare instruction
  const makeIncreaseLiquidityInstruction = await AmmV3.makeIncreaseLiquidityInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo,
    ownerPosition: ammV3Position,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
    liquidity,
    slippage: 1,
  });

  // prepare transactions
  const makeIncreaseLiquidityTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeIncreaseLiquidityInstruction.innerTransactions,
  });

  // send transactions
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeIncreaseLiquidityTransactions);
  console.log(txids);
}

ammV3AddPosition();
