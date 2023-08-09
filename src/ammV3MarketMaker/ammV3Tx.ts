import {
  AmmV3,
  AmmV3PoolInfo,
  fetchMultipleMintInfos,
  TokenAccount,
  TxVersion,
  AmmV3PoolPersonalPosition,
} from "@raydium-io/raydium-sdk";
import Decimal from "decimal.js";
import BN from "bn.js";
import { Connection, Keypair, Signer } from "@solana/web3.js";
import { buildAndSendTx } from "./util";

export async function createPositionTx({
  connection,
  poolInfo,
  priceLower,
  priceUpper,
  owner,
  tokenAccounts,
  makeTxVersion = TxVersion.V0,
  amountA,
}: {
  connection: Connection;
  poolInfo: AmmV3PoolInfo;
  priceLower: Decimal;
  priceUpper: Decimal;
  owner: Keypair | Signer;
  tokenAccounts: TokenAccount[];
  makeTxVersion?: TxVersion;
  amountA: BN;
}) {
  const { tick: tickLower } = AmmV3.getPriceAndTick({
    poolInfo,
    baseIn: true,
    price: priceLower, // will add position start price
  });
  const { tick: tickUpper } = AmmV3.getPriceAndTick({
    poolInfo,
    baseIn: true,
    price: priceUpper, // will add position end price
  });

  const { liquidity, amountSlippageA, amountSlippageB } =
    AmmV3.getLiquidityAmountOutFromAmountIn({
      poolInfo,
      slippage: 0,
      inputA: true,
      tickUpper,
      tickLower,
      amount: amountA, // e.g. new BN(100000),
      add: true, // SDK flag for math round direction

      amountHasFee: true,

      token2022Infos: await fetchMultipleMintInfos({
        connection,
        mints: [poolInfo.mintA.mint, poolInfo.mintB.mint],
      }),
      epochInfo: await connection.getEpochInfo(),
    });

  const makeOpenPositionInstruction =
    await AmmV3.makeOpenPositionFromLiquidityInstructionSimple({
      connection,
      poolInfo,
      ownerInfo: {
        feePayer: owner.publicKey,
        wallet: owner.publicKey,
        tokenAccounts,
      },
      tickLower,
      tickUpper,
      liquidity,
      makeTxVersion,
      amountMaxA: amountSlippageA.amount,
      amountMaxB: amountSlippageB.amount,
    });

  return {
    txids: await buildAndSendTx({
      connection,
      makeTxVersion,
      owner,
      innerSimpleV0Transaction: makeOpenPositionInstruction.innerTransactions,
    }),
  };
}

export async function closePositionTx({
  connection,
  poolInfo,
  position,
  owner,
  tokenAccounts,
  makeTxVersion = TxVersion.V0,
}: {
  connection: Connection;
  poolInfo: AmmV3PoolInfo;
  position: AmmV3PoolPersonalPosition;
  owner: Keypair | Signer;
  tokenAccounts: TokenAccount[];
  makeTxVersion?: TxVersion;
}) {
  const makeDecreaseLiquidityInstruction =
    await AmmV3.makeDecreaseLiquidityInstructionSimple({
      connection,
      poolInfo,
      ownerPosition: position,
      ownerInfo: {
        feePayer: owner.publicKey,
        wallet: owner.publicKey,
        tokenAccounts: tokenAccounts,
        closePosition: true, // for close
      },
      liquidity: position.liquidity, //for close position, use 'ammV3Position.liquidity' without dividend
      // slippage: 1, // if encouter slippage check error, try uncomment this line and set a number manually
      makeTxVersion,
      amountMinA: new BN(0),
      amountMinB: new BN(0),
    });

  return {
    txids: await buildAndSendTx({
      connection,
      makeTxVersion,
      owner,
      innerSimpleV0Transaction:
        makeDecreaseLiquidityInstruction.innerTransactions,
    }),
  };
}
