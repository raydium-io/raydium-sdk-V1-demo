import Decimal from 'decimal.js';

import {
  AmmV3,
  AmmV3ConfigInfo,
  buildTransaction,
  ENDPOINT,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import {
  connection,
  PROGRAMIDS,
  RAYDIUM_MAINNET_API,
  wallet,
  wantBuildTxVersion,
} from '../config';
import { sendTx } from './util';

// THIS DEMO HAS NOT BEEN TESTING YET!!!!!

async function ammV3CreatePool() {
  // fetch amm config list
  const ammConfigs = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Configs)).json()) as {
    data: Record<string, AmmV3ConfigInfo>;
  };

  // get config, in this example,
  let ammConfig = ammConfigs.data['E64NGkDLLCdQ2yFNPcavaKptrEgmiQaNykUuLC1Qgwyp'] as AmmV3ConfigInfo;
  ammConfig = { ...ammConfig, id: new PublicKey(ammConfig.id) };

  // coin info
  const baseToken = {
    mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    decimals: 6,
    symbol: 'USDC'
  }
  const quoteToken = {
    mint: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
    decimals: 6,
    symbol: 'RAY'
  }

  const startPoolPrice = new Decimal(1)

  const programId = PROGRAMIDS.CLMM;

  // prepare instruction
  const makeCreatePoolInstruction = await AmmV3.makeCreatePoolInstructionSimple({
    connection,
    programId,
    owner: wallet.publicKey,
    mint1: baseToken,
    mint2: quoteToken,
    ammConfig,
    initialPrice: startPoolPrice,
  });

  // prepare mock pool info
  const mockPoolInfo = AmmV3.makeMockPoolInfo({
    programId,
    mint1: baseToken,
    mint2: quoteToken,
    ammConfig,
    createPoolInstructionSimpleAddress: makeCreatePoolInstruction.address,
    owner: wallet.publicKey,
    initialPrice: startPoolPrice,
  });

  console.log('pool info', mockPoolInfo)

  // prepare transactions
  const createPooltransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeCreatePoolInstruction.innerTransactions,
  });

  // send transactions
  const txids = await sendTx(connection, wallet, wantBuildTxVersion, createPooltransactions);
  console.log(txids);
}

ammV3CreatePool();
