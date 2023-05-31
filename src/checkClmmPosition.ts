import BN from 'bn.js';
import Decimal from 'decimal.js';

import {
  LiquidityMath,
  PoolInfoLayout,
  PositionInfoLayout,
  SPL_ACCOUNT_LAYOUT,
  SqrtPriceMath,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import {
  connection,
  PROGRAMIDS,
} from '../config';

async function checkClmmPosition() {
  const poolId = new PublicKey("poolId")

  const poolInfoAccount = await connection.getAccountInfo(poolId)
  if (poolInfoAccount === null) throw Error(' pool id error ')

  const poolInfo = PoolInfoLayout.decode(poolInfoAccount.data)

  console.log("current activated liquidity:", poolInfo.liquidity.toString());

  const gPA = await connection.getProgramAccounts(PROGRAMIDS.CLMM, {
    commitment: "confirmed",
    filters: [
      {dataSize: PositionInfoLayout.span},
      {memcmp: {bytes: poolId.toBase58(), offset: PositionInfoLayout.offsetOf('poolId')}},
    ]
  });

  console.log("num of positions:", gPA.length);
  let check_sum = new BN(0);
  for (const account of gPA) {
    const parsed = PositionInfoLayout.decode(account.account.data);

    const owner = await findNftOwner(parsed.nftMint);

    const status = checkPositionStatus(poolInfo, parsed);
    if (status === "InRange") check_sum = check_sum.add(parsed.liquidity);

    const amounts = LiquidityMath.getAmountsFromLiquidity(
      poolInfo.sqrtPriceX64,
      SqrtPriceMath.getSqrtPriceX64FromTick(parsed.tickLower),
      SqrtPriceMath.getSqrtPriceX64FromTick(parsed.tickUpper),
      poolInfo.liquidity,
      false
    );
    const amountA = new Decimal(amounts.amountA.toString()).div(10 ** poolInfo.mintDecimalsA)
    const amountB = new Decimal(amounts.amountB.toString()).div(10 ** poolInfo.mintDecimalsB)

    console.log(
      "\tposition",
      "address:", account.pubkey.toBase58(),
      "owner:", owner?.toBase58() ?? "NOTFOUND",
      "liquidity:", parsed.liquidity.toString(),
      "status:", status,
      "amountA:", amountA.toString(),
      "amountB:", amountB.toString(),
    );
  }

  console.log("check sum:", check_sum.eq(poolInfo.liquidity));
}

function checkPositionStatus(poolInfo: {tickCurrent: number}, position: {tickLower: number, tickUpper: number}) {
  if (position.tickUpper <= poolInfo.tickCurrent) return "OutOfRange(PriceIsAboveRange)";
  if (position.tickLower >  poolInfo.tickCurrent) return "OutOfRange(PriceIsBelowRange)";
  return "InRange";
}

async function findNftOwner(mint: PublicKey): Promise<PublicKey|null> {
  const res = await connection.getTokenLargestAccounts(mint);
  if (!res.value) return null;
  if (res.value.length === 0) return null;
  if (res.value[0].uiAmount !== 1) return null;

  const account = await connection.getAccountInfo(res.value[0].address)
  const info = SPL_ACCOUNT_LAYOUT.decode(account?.data!)
  
  return info.owner
}

checkClmmPosition()