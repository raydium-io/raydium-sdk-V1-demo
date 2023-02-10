import { BN } from 'bn.js';

import {
  buildTransaction,
  Liquidity,
  MAINNET_PROGRAM_ID,
} from '@raydium-io/raydium-sdk';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  PROGRAMIDS,
  wallet,
  wantBuildTxVersion,
} from '../config';
import {
  getWalletTokenAccount,
  sendTx,
} from './util';

async function ammCreatePool() {
  // info
  const marketId = Keypair.generate().publicKey
  // const marketId = new PublicKey('market id')
  const baseInfo = {
    mint: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
    decimals: 6
  }
  const quoteInfo = {
    mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    decimals: 6
  }

  const willAddBaseAmount = new BN(10000) // 10000 / 10 ** 6
  const willAddQuoteAmount = new BN(10000) // 10000 / 10 ** 6
  console.log('will pool start price ', (willAddBaseAmount.toNumber() / 10 ** 6) / (willAddQuoteAmount.toNumber() / 10 ** 6))

  const startTime = new BN(Math.floor(new Date().getTime() / 1000)) // start time

  // get associated pool keys
  const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: baseInfo.mint,
    quoteMint: quoteInfo.mint,
    baseDecimals: baseInfo.decimals,
    quoteDecimals: quoteInfo.decimals,
    marketId,
    programId: PROGRAMIDS.AmmV4,
    marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
  });

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // prepare instruction
  const initPoolInstructionResponse = await Liquidity.makeCreatePoolV4InstructionV2Simple({
    connection,
    programId: PROGRAMIDS.AmmV4,
    marketInfo: {
      marketId,
      programId: PROGRAMIDS.OPENBOOK_MARKET
    },
    baseMintInfo: baseInfo,
    quoteMintInfo: quoteInfo,
    baseAmount: willAddBaseAmount,
    quoteAmount: willAddQuoteAmount,
    startTime,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
      useSOLBalance: true
    },
    associatedOnly: false
  });

  // prepare transactions
  const createPoolTxs = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: initPoolInstructionResponse.innerTransactions,
  });

  // send transactions
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, createPoolTxs);
  console.log(txids);
}

ammCreatePool();
