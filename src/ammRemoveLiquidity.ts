import assert from 'assert';

import {
  buildTransaction,
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection, wallet, wantBuildTxVersion } from '../config';
import { getWalletTokenAccount, sendTx } from './util';

async function ammRemoveLiquidity() {
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

  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);
  const lpToken = new Token(
    new PublicKey('FGYXP4vBkMEtKhxrmEBcWN8VNmXX8qNgEJpENKDETZ4Y'),
    6,
    'RAY-USDC',
    'RAY-USDC'
  );
  const inputTokenAmount = new TokenAmount(lpToken, 100);

  const removeLiquidityInstructionResponse = await Liquidity.makeRemoveLiquidityInstructionSimple({
    connection,
    poolKeys,
    userKeys: { owner: wallet.publicKey, payer: wallet.publicKey, tokenAccounts: walletTokenAccountFormat },
    amountIn: inputTokenAmount,
  });

  const removeLiquidityInstructionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: removeLiquidityInstructionResponse.innerTransactions,
  });

  const txids = await sendTx(connection, wallet, wantBuildTxVersion, removeLiquidityInstructionTransactions);
  console.log(txids);
}

ammRemoveLiquidity();
