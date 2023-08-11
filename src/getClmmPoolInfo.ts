import {
  PoolInfoLayout,
  SqrtPriceMath,
} from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';

import { connection } from '../config';

async function getClmmPoolInfo() {
  const id = new PublicKey('< pool id >')

  const accountInfo = await connection.getAccountInfo(id)

  if (accountInfo === null) throw Error(' get pool info error ')

  const poolData = PoolInfoLayout.decode(accountInfo.data)

  console.log('current price -> ', SqrtPriceMath.sqrtPriceX64ToPrice(poolData.sqrtPriceX64, poolData.mintDecimalsA, poolData.mintDecimalsB))
}

getClmmPoolInfo()
