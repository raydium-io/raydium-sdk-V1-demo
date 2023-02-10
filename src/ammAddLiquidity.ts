import assert from 'assert';

import {
  buildTransaction,
  ENDPOINT,
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
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

async function ammAddLiquidity() {
  // target pool public key string, in this example, RAY-USDC pool
  const targetPoolPublicKeyString = 'EVzLJhqMtdC1nPmz8rNd6xGfVjDPxpLZgq7XJuNfMZ6';
  // get v2 pool list
  const ammV2Pool = await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.poolInfo)).json(); // If the Liquidity pool is not required for routing, then this variable can be configured as undefined
  // get target pool
  const targetPoolInfos = [...ammV2Pool.official, ...ammV2Pool.unOfficial].filter(
    (info) => info.id === targetPoolPublicKeyString
  );

  assert(targetPoolInfos.length > 0, 'cannot find the target pool');

  // get first pool
  const targetPoolInfo = targetPoolInfos[0];

  // coin info
  const baseToken = new Token(
    new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    6,
    'USDC',
    'USDC'
  );
  const quoteToken = new Token(
    new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
    6,
    'RAY',
    'RAY'
  );

  // set slippage
  const slippage = new Percent(1, 100);

  // set input token amount
  const inputTokenAmount = new TokenAmount(baseToken, 100);

  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

  const extraPoolInfo = await Liquidity.fetchInfo({ connection, poolKeys });

  const { maxAnotherAmount, anotherAmount } = Liquidity.computeAnotherAmount({
    poolKeys,
    poolInfo: { ...targetPoolInfo, ...extraPoolInfo },
    amount: inputTokenAmount,
    anotherCurrency: quoteToken,
    slippage: slippage,
  });

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // prepare instruction
  const addLiquidityInstructionResponse = await Liquidity.makeAddLiquidityInstructionSimple({
    connection,
    poolKeys,
    userKeys: { owner: wallet.publicKey, payer: wallet.publicKey, tokenAccounts: walletTokenAccountFormat },
    amountInA: inputTokenAmount,
    amountInB: maxAnotherAmount,
    fixedSide: 'a',
  });

  // prepare transactions
  const addLiquidityInstructionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: addLiquidityInstructionResponse.innerTransactions,
  });

  // send transactions
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, addLiquidityInstructionTransactions);
  console.log(txids);
}

ammAddLiquidity();
