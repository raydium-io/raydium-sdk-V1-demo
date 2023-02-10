import Decimal from 'decimal.js';

import {
  AmmV3,
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

async function ammV3CreatePosition() {
  // target pool id, in this example, USDC-RAY pool
  const targetPoolId = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht';
  // get all pool info from api
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data.filter(
    (pool: ApiAmmV3PoolsItem) => pool.id === targetPoolId
  );
  const ammV3PoolInfoDict = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: ammV3Pool,
    chainTime: new Date().getTime() / 1000,
  })

  // get the first pool info
  const ammV3PoolInfo = ammV3PoolInfoDict[targetPoolId].state

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // get closest tick w/ prefer price range
  const { tick: tickLower } = AmmV3.getPriceAndTick({
    poolInfo: ammV3PoolInfo,
    baseIn: true,
    price: new Decimal(0.5), // will add position start price
  });
  const { tick: tickUpper } = AmmV3.getPriceAndTick({
    poolInfo: ammV3PoolInfo,
    baseIn: true,
    price: new Decimal(1.5), // will add position end price
  });

  // prepare base token amount
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY');
  const inputTokenAmount = new TokenAmount(RAYToken, 10000);

  // calculate liquidity base on 'base token amount'
  const { liquidity } = AmmV3.getLiquidityAmountOutFromAmountIn({
    poolInfo: ammV3PoolInfo,
    slippage: 0,
    inputA: true,
    tickUpper,
    tickLower,
    amount: inputTokenAmount.raw,
    add: true, // SDK flag for math round direction
  });

  // prepare instruction
  const makeOpenPositionInstruction = await AmmV3.makeOpenPositionInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
    tickLower,
    tickUpper,
    liquidity,
    slippage: 1,
  });

  // prepare transactions
  const makeOpenPositionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeOpenPositionInstruction.innerTransactions,
  });

  // send transactions
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, makeOpenPositionTransactions);
  console.log(txids);
}

ammV3CreatePosition();
