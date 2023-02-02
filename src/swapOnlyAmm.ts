import {
  buildTransaction,
  Percent,
  Token,
  TokenAmount,
  TradeV2,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import {
  connection,
  wallet,
  wantBuildTxVersion,
} from '../config';
import {
  getWalletTokenAccount,
  sendTx,
} from './util';

async function swapOnlyAmm() {
  // get v2 pool list
  const ammV2Pool = await (await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json')).json(); // If the Liquidity pool is not required for routing, then this variable can be configured as undefined

  // coin info
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY');
  const USDCToken = new Token(
    new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    6,
    'USDC',
    'USDC'
  );

  // get all route info without v3 list empty
  const getRoute = TradeV2.getAllRoute({
    inputMint: RAYToken.mint,
    outputMint: USDCToken.mint,
    apiPoolList: ammV2Pool,
    ammV3List: [], // leave this empty array, we don't need this when swapping only amm pools
  });

  // get the information you need for the calculation
  const poolInfosCache = await TradeV2.fetchMultipleInfo({
    connection,
    pools: getRoute.needSimulate,
    batchRequest: true,
  });

  // Configure input/output parameters, in this example, this token amount will swap 0.0001 USDC to RAY
  const inputTokenAmount = new TokenAmount(USDCToken, 100);
  const outputToken = RAYToken;
  const slippage = new Percent(1, 100);

  // calculation result of all route
  const routeList = TradeV2.getAllRouteComputeAmountOut({
    directPath: getRoute.directPath,
    routePathDict: getRoute.routePathDict,
    simulateCache: poolInfosCache,
    tickCache: {}, // leave this empty object, we don't need this when swapping only amm pools

    inputTokenAmount,
    outputToken,
    slippage,
    chainTime: new Date().getTime() / 1000, // this chain time
  });

  // get user all account
  const walletTokenAccountFormet = await getWalletTokenAccount(connection, wallet.publicKey);

  // make swap transaction
  const innerTx = await TradeV2.makeSwapInstructionSimple({
    connection,
    swapInfo: routeList[0],
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormet,
      associatedOnly: true,
    },
    checkTransaction: true,
  });

  const transactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: innerTx.innerTransactions,
  });

  const txids = await sendTx(connection, wallet, wantBuildTxVersion, transactions);
  console.log(txids);
}

swapOnlyAmm();
