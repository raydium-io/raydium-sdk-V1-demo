import BN from 'bn.js';

import {
  AmmV3,
  ApiAmmV3PoolsItem,
  buildTransaction,
  ENDPOINT,
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

async function ammV3RemovePosition() {
  // target pool id, in this example, USDC-RAY pool
  const targetPoolId = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht';
  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);
  // get all pool info from api
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data.filter(
    (pool: ApiAmmV3PoolsItem) => pool.id === targetPoolId
  );

  const info = (await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: ammV3Pool,
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
  }))[targetPoolId]

  if (!info.positionAccount) throw Error('owner do not has some position')

  // prepare instruction
  const makeDecreaseLiquidityInstruction = await AmmV3.makeDecreaseLiquidityInstructionSimple({
    connection,
    poolInfo: info.state,
    ownerPosition: info.positionAccount[0],
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
      // closePosition: true, // for close
    },
    liquidity: info.positionAccount[0].liquidity.div(new BN(2)), //for close position, use 'ammV3Position.liquidity' without dividend
    // slippage: 1, // if encouter slippage check error, try uncomment this line and set a number manually
  });

  // prepare transactions
  const makeDecreaseLiquidityTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeDecreaseLiquidityInstruction.innerTransactions,
  });

  // send transactions
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeDecreaseLiquidityTransactions);
  console.log(txids);
}

ammV3RemovePosition();
