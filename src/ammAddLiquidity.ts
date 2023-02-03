import assert from 'assert';

import {
  buildTransaction,
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection, wallet, wantBuildTxVersion } from '../config';
import { getWalletTokenAccount, sendTx } from './util';

async function ammAddLiquidity() {
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
  const inputToken = new Token(
    new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    6,
    'USDC',
    'USDC'
  );
  const outputoken = new Token(
    new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
    6,
    'RAY',
    'RAY'
  );
  const slippage = new Percent(1, 100);

  const inputTokenAmount = new TokenAmount(inputToken, 100);

  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

  const extraPoolInfo = await Liquidity.fetchInfo({ connection, poolKeys });

  const { maxAnotherAmount, anotherAmount } = Liquidity.computeAnotherAmount({
    poolKeys,
    poolInfo: { ...targetPoolInfo, ...extraPoolInfo },
    amount: inputTokenAmount,
    anotherCurrency: outputoken,
    slippage: slippage,
  });

  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  const addLiquidityInstructionResponse = await Liquidity.makeAddLiquidityInstructionSimple({
    connection,
    poolKeys,
    userKeys: { owner: wallet.publicKey, payer: wallet.publicKey, tokenAccounts: walletTokenAccountFormat },
    amountInA: inputTokenAmount,
    amountInB: maxAnotherAmount,
    fixedSide: 'a',
  });

  const addLiquidityInstructionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: addLiquidityInstructionResponse.innerTransactions,
  });

  const txids = await sendTx(connection, wallet, wantBuildTxVersion, addLiquidityInstructionTransactions);
  console.log(txids);
}

ammAddLiquidity();
