import assert from 'assert';
import BN from 'bn.js';

import {
  AmmV3,
  AmmV3PoolInfo,
  AmmV3PoolPersonalPosition,
  ApiAmmV3PoolsItem,
  buildTransaction,
} from '@raydium-io/raydium-sdk';

import {
  connection,
  wallet,
  wantBuildTxVersion,
} from '../config';
import {
  getWalletTokenAccount,
  sendTx,
} from './util';

async function ammV3RemovePosition() {
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

  // get the first pool info
  const ammV3PoolInfo = ammV3PoolInfoList[0];
  const ammV3Position = ammV3PersonalPositionList[0];

  const makeDecreaseLiquidityInstruction = await AmmV3.makeDecreaseLiquidityInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo,
    ownerPosition: ammV3Position,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
      // closePosition: true, // for close
    },
    liquidity: ammV3Position.liquidity.div(new BN(2)), //for close position, use 'ammV3Position.liquidity' without dividend
    // slippage: 1, // if encouter slippage check error, try uncomment this line and set a number manually
  });

  const makeDecreaseLiquidityTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeDecreaseLiquidityInstruction.innerTransactions,
  });

  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeDecreaseLiquidityTransactions);
  console.log(txids);
}

ammV3RemovePosition();
