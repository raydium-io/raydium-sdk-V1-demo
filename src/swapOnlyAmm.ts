import assert from 'assert';

import {
  buildTransaction,
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  LiquiditySwapInstructionSimpleParams,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection, wallet, wantBuildTxVersion } from '../config';
import { getWalletTokenAccount, sendTx } from './util';

async function swapOnlyAmm() {
  // target pool public key string, in this example, USDC-RAY pool
  const targetPoolPublicKeyString = 'EVzLJhqMtdC1nPmz8rNd6xGfVjDPxpLZgq7XJuNfMZ6';
  // get v2 pool list
  const ammV2Pool = await (await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json')).json(); // If the Liquidity pool is not required for routing, then this variable can be configured as undefined
  // get target pool
  const targetPoolInfos = [...ammV2Pool.official, ...ammV2Pool.unOfficial].filter(
    (info) => info.id === targetPoolPublicKeyString
  );

  assert(targetPoolInfos.length > 0, 'cannot find the target pool');

  const targetPoolInfo = targetPoolInfos[0];

  // coin info
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY');
  const USDCToken = new Token(
    new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    6,
    'USDC',
    'USDC'
  );

  // Configure input/output parameters, in this example, this token amount will swap 0.0001 USDC to RAY
  const inputTokenAmount = new TokenAmount(USDCToken, 100);
  const outputToken = RAYToken;
  const slippage = new Percent(1, 100);

  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

  const { amountOut } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
    amountIn: inputTokenAmount,
    currencyOut: outputToken,
    slippage,
  });

  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // prepare swap instruction parameters
  const instructionParams: LiquiditySwapInstructionSimpleParams = {
    connection,
    poolKeys,
    userKeys: {
      tokenAccounts: walletTokenAccountFormat,
      owner: wallet.publicKey,
    },
    amountIn: inputTokenAmount,
    amountOut,
    fixedSide: 'in',
  };

  const innerTx = await Liquidity.makeSwapInstructionSimple(instructionParams);

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
