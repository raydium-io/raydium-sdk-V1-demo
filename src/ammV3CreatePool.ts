import BN from 'bn.js';
import Decimal from 'decimal.js';

import { AmmV3, AmmV3ConfigInfo, buildTransaction, ENDPOINT, Token } from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection, PROGRAMIDS, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config';
import { getWalletTokenAccount } from './util';

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

  const programId = PROGRAMIDS.CLMM;

  // get wallet token accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

  // prepare instruction
  const makeCreatePoolInstruction = await AmmV3.makeCreatePoolInstructionSimple({
    connection,
    programId,
    owner: wallet.publicKey,
    mint1: {
      mint: baseToken.mint,
      decimals: baseToken.decimals,
    },
    mint2: {
      mint: quoteToken.mint,
      decimals: quoteToken.decimals,
    },
    ammConfig,
    initialPrice: new Decimal(1),
  });

  // prepare mock pool info
  const mockPoolInfo = AmmV3.makeMockPoolInfo({
    programId,
    mint1: {
      mint: baseToken.mint,
      decimals: baseToken.decimals,
    },
    mint2: {
      mint: quoteToken.mint,
      decimals: quoteToken.decimals,
    },
    ammConfig,
    createPoolInstructionSimpleAddress: { ...makeCreatePoolInstruction.address },
    owner: wallet.publicKey,
    initialPrice: new Decimal(1),
  });

  // get closest tick w/ prefer price range
  const { tick: tickLower } = AmmV3.getPriceAndTick({
    poolInfo: mockPoolInfo,
    baseIn: true,
    price: new Decimal(0.5),
  });
  const { tick: tickUpper } = AmmV3.getPriceAndTick({
    poolInfo: mockPoolInfo,
    baseIn: true,
    price: new Decimal(1.5),
  });

  // prepare instruction
  const makeOpenPositionInstruction = await AmmV3.makeOpenPositionInstructionSimple({
    connection,
    poolInfo: mockPoolInfo,
    ownerInfo: {
      feePayer: wallet.publicKey,
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
    tickLower: tickLower,
    tickUpper: tickUpper,
    liquidity: new BN(1),
    slippage: 1,
  });

  // prepare transactions
  const createPooltransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeCreatePoolInstruction.innerTransactions,
  });

  // prepare transactions
  const openPoolPositiontransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeOpenPositionInstruction.innerTransactions,
  });

  // simulate transactions
  console.log(
    await Promise.all(createPooltransactions.map(async (i) => await connection.simulateTransaction(i)))
  );

  console.log(
    await Promise.all(openPoolPositiontransactions.map(async (i) => await connection.simulateTransaction(i)))
  );
}

ammV3CreatePool();
