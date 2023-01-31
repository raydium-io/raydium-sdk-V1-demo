import {
  buildTransaction,
  MarketV2,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import {
  connection,
  PROGRAMIDS,
  wallet,
  wantBuildTxVersion,
} from '../config';
import { sendTx } from './util';

export async function createMarket() {
  const createMarketIns = await MarketV2.makeCreateMarketInstructionSimple({
    connection,
    wallet: wallet.publicKey,
    baseInfo: {
      mint: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), // RAY
      decimals: 6
    },
    quoteInfo: {
      mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
      decimals: 6
    }, 
    lotSize: 1, // default 1
    tickSize: 0.01, // default 0.01
    dexProgramId: PROGRAMIDS.OPENBOOK_MARKET, 
  })

  const transactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: createMarketIns.innerTransactions,
  })

  const txids = await sendTx(connection, wallet, wantBuildTxVersion, transactions)
  console.log(txids)
}

createMarket()