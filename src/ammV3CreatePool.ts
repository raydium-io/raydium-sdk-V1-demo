import BN from 'bn.js';
import Decimal from 'decimal.js';

import { AmmV3, AmmV3ConfigInfo, buildTransaction, Token } from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection, RAYDIUM_AMM_V3_PROGRAM_ID, wallet, wantBuildTxVersion } from '../config';
import { getWalletTokenAccount } from './util';

// THIS DEMO HAS NOT BEEN TESTING YET!!!!!

async function ammV3CreatePool() {
  const ammConfigs = (await (await fetch('https://api.raydium.io/v2/ammV3/ammConfigs')).json()) as {
    data: Record<string, AmmV3ConfigInfo>;
  };
  const ammConfig = ammConfigs.data['E64NGkDLLCdQ2yFNPcavaKptrEgmiQaNykUuLC1Qgwyp'];
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

  const programId = new PublicKey(RAYDIUM_AMM_V3_PROGRAM_ID);
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);

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
  });

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

  const createPooltransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeCreatePoolInstruction.innerTransactions,
  });

  const openPoolPositiontransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: wallet.publicKey,
    innerTransactions: makeOpenPositionInstruction.innerTransactions,
  });

  console.log(
    await Promise.all(createPooltransactions.map(async (i) => await connection.simulateTransaction(i)))
  );

  console.log(
    await Promise.all(openPoolPositiontransactions.map(async (i) => await connection.simulateTransaction(i)))
  );
}

ammV3CreatePool();
