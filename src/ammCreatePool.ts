import assert from 'assert';
import BN from 'bn.js';

import {
  buildTransaction,
  Liquidity,
  MAINNET_PROGRAM_ID,
  MarketV2,
  SPL_MINT_LAYOUT,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection, PROGRAMIDS, wallet, wantBuildTxVersion } from '../config';
import { getWalletTokenAccount } from './util';

// THIS DEMO HAS NOT BEEN TESTING YET!!!!!

async function ammCreatePool() {
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

  // prepare instruction
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
    dexProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
  });

  // prepare transactions
  const createMarketIdTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: innerTransactions,
  });

  // simulate transactions
  console.log(
    await Promise.all(createMarketIdTransactions.map(async (i) => await connection.simulateTransaction(i)))
  );

  // get associated pool keys
  const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: baseToken.mint,
    quoteMint: quoteToken.mint,
    baseDecimals: baseToken.decimals,
    quoteDecimals: quoteToken.decimals,
    marketId: new PublicKey(address.marketId),
    programId: PROGRAMIDS.AmmV4,
    marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
  });

  const { id: ammId, lpMint } = associatedPoolKeys;

  // check whether pool has been created or inited
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

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // prepare instruction
  const initPoolInstructionResponse = await Liquidity.makeInitPoolInstructionSimple({
    poolKeys: associatedPoolKeys,
    startTime: undefined,
    baseAmount: new TokenAmount(baseToken, 100),
    quoteAmount: new TokenAmount(quoteToken, 100),
    connection,
    userKeys: { owner: wallet.publicKey, payer: wallet.publicKey, tokenAccounts: walletTokenAccountFormat },
  });

  // prepare transactions
  const initPoolInstructionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: initPoolInstructionResponse.innerTransactions,
  });

  // simulate transactions
  console.log(
    await Promise.all(
      initPoolInstructionTransactions.map(async (i) => await connection.simulateTransaction(i))
    )
  );
}

ammCreatePool();
