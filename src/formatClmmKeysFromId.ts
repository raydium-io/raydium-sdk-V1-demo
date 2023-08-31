import {
  AmmConfigLayout,
  ApiAmmV3ConfigItem,
  ApiAmmV3PoolsItem,
  ApiAmmV3PoolsItemStatistics,
  PoolInfoLayout,
} from '@raydium-io/raydium-sdk';
import {
  AccountInfo,
  PublicKey,
} from '@solana/web3.js';

import { connection } from '../config';

async function getMintProgram(mint: PublicKey) {
  const account = await connection.getAccountInfo(mint)
  if (account === null) throw Error(' get id info error ')
  return account.owner
}
async function getConfigInfo(configId: PublicKey): Promise<ApiAmmV3ConfigItem> {
  const account = await connection.getAccountInfo(configId)
  if (account === null) throw Error(' get id info error ')
  return formatConfigInfo(configId, account)
}
function formatConfigInfo(id: PublicKey, account: AccountInfo<Buffer>) {
  const info = AmmConfigLayout.decode(account.data)

  return {
    id: id.toBase58(),
    index: info.index,
    protocolFeeRate: info.protocolFeeRate,
    tradeFeeRate: info.tradeFeeRate,
    tickSpacing: info.tickSpacing,
    fundFeeRate: info.fundFeeRate,
    fundOwner: info.fundOwner.toString(),
    description: '',
  }
}
function getApiAmmV3PoolsItemStatistics(): ApiAmmV3PoolsItemStatistics {
  return {
    volume: 0,
    volumeFee: 0,
    feeA: 0,
    feeB: 0,
    feeApr: 0,
    rewardApr: { A: 0, B: 0, C: 0 },
    apr: 0,
    priceMin: 0,
    priceMax: 0,
  }
}

export async function formatClmmKeysFromId(id: string): Promise<ApiAmmV3PoolsItem> {
  const account = await connection.getAccountInfo(new PublicKey(id))
  if (account === null) throw Error(' get id info error ')
  const info = PoolInfoLayout.decode(account.data)

  return {
    id,
    mintProgramIdA: (await getMintProgram(info.mintA)).toString(),
    mintProgramIdB: (await getMintProgram(info.mintB)).toString(),
    mintA: info.mintA.toString(),
    mintB: info.mintB.toString(),
    vaultA: info.vaultA.toString(),
    vaultB: info.vaultB.toString(),
    mintDecimalsA: info.mintDecimalsA,
    mintDecimalsB: info.mintDecimalsB,
    ammConfig: await getConfigInfo(info.ammConfig),
    rewardInfos: await Promise.all(
      info.rewardInfos
        .filter((i) => !i.tokenMint.equals(PublicKey.default))
        .map(async (i) => ({
          mint: i.tokenMint.toString(),
          programId: (await getMintProgram(i.tokenMint)).toString(),
        }))
    ),
    tvl: 0,
    day: getApiAmmV3PoolsItemStatistics(),
    week: getApiAmmV3PoolsItemStatistics(),
    month: getApiAmmV3PoolsItemStatistics(),
    lookupTableAccount: PublicKey.default.toBase58(),
  }
}
