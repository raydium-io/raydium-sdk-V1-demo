import assert from 'assert';
import BN from 'bn.js';

import {
  buildTransaction,
  Liquidity,
  MarketV2,
  SPL_MINT_LAYOUT,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection, wallet, wantBuildTxVersion } from '../config';
import { getWalletTokenAccount } from './util';

// THIS DEMO HAS NOT BEEN TESTING YET!!!!!

async function ammCreatePool() {
  const openBookProgramId = 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX';

  // coin info
  const RAYToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY');
  const USDCToken = new Token(
    new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    6,
    'USDC',
    'USDC'
  );

  const baseToken = RAYToken;
  const quoteToken = USDCToken;

  const { address, innerTransactions } = await MarketV2.makeCreateMarketInstructionSimple({
    connection,
    wallet: wallet.publicKey,
    baseInfo: {
      mint: baseToken.mint,
      decimals: baseToken.decimals,
    },
    quoteInfo: {
      mint: quoteToken.mint,
      decimals: quoteToken.decimals,
    },
    lotSize: 1,
    tickSize: 0.01,
    dexProgramId: new PublicKey(openBookProgramId),
  });

  console.log('marketId: ', address.marketId);

  const createMarketIdTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: innerTransactions,
  });

  console.log(
    await Promise.all(createMarketIdTransactions.map(async (i) => await connection.simulateTransaction(i)))
  );

  const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: baseToken.mint,
    quoteMint: quoteToken.mint,
    baseDecimals: baseToken.decimals,
    quoteDecimals: quoteToken.decimals,
    marketId: new PublicKey(address.marketId),
    programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),
    marketProgramId: new PublicKey(openBookProgramId),
  });

  const { id: ammId, lpMint } = associatedPoolKeys;

  const lpMintInfoOnChain = (await connection?.getAccountInfo(new PublicKey(lpMint)))?.data;
  const ammInfoOnChain = (await connection?.getAccountInfo(new PublicKey(ammId)))?.data;

  const isAlreadyCreated = Boolean(
    lpMintInfoOnChain?.length && Number(SPL_MINT_LAYOUT.decode(lpMintInfoOnChain).supply) === 0
  );
  const isAlreadyInited = Boolean(
    ammInfoOnChain?.length && !Liquidity.getStateLayout(4).decode(ammInfoOnChain)?.status.eq(new BN(0))
  );

  assert(!isAlreadyCreated, 'pool has not been created, yet');
  assert(!isAlreadyInited, 'pool already inited');

  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  const initPoolInstructionResponse = await Liquidity.makeInitPoolInstructionSimple({
    poolKeys: associatedPoolKeys,
    startTime: undefined,
    baseAmount: new TokenAmount(baseToken, 100),
    quoteAmount: new TokenAmount(quoteToken, 100),
    connection,
    userKeys: { owner: wallet.publicKey, payer: wallet.publicKey, tokenAccounts: walletTokenAccountFormat },
  });

  const initPoolInstructionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: initPoolInstructionResponse.innerTransactions,
  });

  console.log(
    await Promise.all(
      initPoolInstructionTransactions.map(async (i) => await connection.simulateTransaction(i))
    )
  );
}

ammCreatePool();
