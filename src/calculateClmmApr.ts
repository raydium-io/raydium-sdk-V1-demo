import { ApiClmmPoolsItem, MathUtil, PoolInfoLayout } from "@raydium-io/raydium-sdk"
import { ParsedAccountData, PublicKey } from "@solana/web3.js"
import Decimal from "decimal.js"
import { ENDPOINT, PROGRAMIDS, RAYDIUM_MAINNET_API, connection } from "../config"
import { formatClmmKeys } from "./formatClmmKeys"


async function calculateClmmApr() {
  const poolId = ''

  const poolAccountInfo = await connection.getAccountInfo(new PublicKey(poolId))

  if (poolAccountInfo === null) throw Error('get pool account data error')

  const mintPrice: { [mint: string]: number } = {}
  for (const [mint, price] of Object.entries(await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.price)).json()) as [string, number][]) mintPrice[mint] = price

  const poolApiInfo: { [poolId: string]: ApiClmmPoolsItem } = {}
  for (const item of await formatClmmKeys(PROGRAMIDS.CLMM.toString(), true)) poolApiInfo[item.id] = item

  const apiPoolInfo = poolApiInfo[poolId]
  if (apiPoolInfo === undefined) throw Error('api pool info check error')

  const poolInfo = PoolInfoLayout.decode(poolAccountInfo.data)

  const chainTime = await connection.getBlockTime(await connection.getSlot())
  if (chainTime === null) throw Error('get chain time error')

  const formatRewardInfo: {
    mint: string,
    price: number,
    sendCountYear: number,
    sendCountYearToU: number,
    tvl: number,
    apr: number,
  }[] = []

  for (const rewardInfo of poolInfo.rewardInfos) {
    if (rewardInfo.tokenMint.equals(PublicKey.default)) continue

    const rewardVaultAdress = rewardInfo.tokenVault
    const rewardVaultAccount = await connection.getParsedAccountInfo(rewardVaultAdress)
    const rewardVaultAccountData = rewardVaultAccount.value?.data as ParsedAccountData
    if (rewardVaultAccountData.program !== 'spl-token') continue

    const rewardPerSecond = (rewardInfo.openTime.toNumber() < chainTime && rewardInfo.endTime.toNumber() > chainTime) ? MathUtil.x64ToDecimal(rewardInfo.emissionsPerSecondX64) : new Decimal(0)

    const sendCountYear = new Decimal(rewardPerSecond.mul(3600 * 24 * 365).toString()).div(10 ** rewardVaultAccountData.parsed.info.tokenAmount.decimals)
    const sendCountYearToU = sendCountYear.mul(mintPrice[rewardVaultAccountData.parsed.info.mint] ?? 0)

    const tvl = apiPoolInfo.tvl

    formatRewardInfo.push({
      mint: rewardVaultAccountData.parsed.info.mint,
      price: mintPrice[rewardVaultAccountData.parsed.info.mint] ?? 0,
      sendCountYear: sendCountYear.toNumber(),
      sendCountYearToU: sendCountYearToU.toNumber(),
      tvl,
      apr: tvl !== 0 ? sendCountYearToU.div(tvl).toNumber() : 0,
    })
  }

  console.log(formatRewardInfo)
}

calculateClmmApr()