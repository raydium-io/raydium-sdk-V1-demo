import {
  AmmV3,
  ApiAmmV3PoolsItem,
  buildTransaction,
  Percent,
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

async function swapOnlyCLMM() {
  // target pool id, in this example, USDC-RAY pool
  const targetPoolId = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht';
  // get all pool info from api
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data.filter(
    (pool: ApiAmmV3PoolsItem) => pool.id === targetPoolId
  );

  // get the first pool info
  const ammV3PoolInfo = (await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: ammV3Pool,
    chainTime: new Date().getTime() / 1000,
  }))[targetPoolId]

  // coin info
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY');
  const USDCToken = new Token(
    new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    6,
    'USDC',
    'USDC'
  );

  // get the information you need for the calculation
  const tickCache = await AmmV3.fetchMultiplePoolTickArrays({
    connection,
    poolKeys: [ammV3PoolInfo.state],
    batchRequest: true,
  });

  // Configure input/output parameters, in this example, this token amount will swap 0.0001 USDC to RAY
  const inputTokenAmount = new TokenAmount(USDCToken, 100);
  const inputToken = USDCToken;
  const outputToken = RAYToken;
  const slippage = new Percent(1, 100);

  const { minAmountOut, remainingAccounts } = AmmV3.computeAmountOutFormat({
    poolInfo: ammV3PoolInfo.state,
    tickArrayCache: tickCache[targetPoolId],
    amountIn: inputTokenAmount,
    currencyOut: outputToken,
    slippage,
  });

  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  const innerTx = await AmmV3.makeSwapBaseInInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo.state,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
    inputMint: inputToken.mint,
    amountIn: inputTokenAmount.raw,
    amountOutMin: minAmountOut.raw,
    remainingAccounts,
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

swapOnlyCLMM();
