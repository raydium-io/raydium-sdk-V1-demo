import { FARM_STATE_LAYOUT_V3, FARM_STATE_LAYOUT_V5, FARM_STATE_LAYOUT_V6 } from "@raydium-io/raydium-sdk"
import { ParsedAccountData, PublicKey } from "@solana/web3.js"
import { BN } from "bn.js"
import Decimal from "decimal.js"
import { ENDPOINT, PROGRAMIDS, RAYDIUM_MAINNET_API, connection } from "../config"


async function calculateFarmApr() {
  const poolId = ''

  const poolAccountInfo = await connection.getAccountInfo(new PublicKey(poolId))

  if (poolAccountInfo === null) throw Error('get pool account data error')

  const mintPrice: { [mint: string]: number } = {}
  for (const [mint, price] of Object.entries(await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.price)).json()) as [string, number][]) mintPrice[mint] = price

  const poolTvl: { [poolId: string]: number } = {}
  for (const info of (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.farmApr)).json()).data) poolTvl[info.id] = info.tvl

  const rewardInfo: { mint: string, price: number, sendCountYear: number, sendCountYearToU: number, tvl: number, apr: number }[] = []

  switch (poolAccountInfo.owner.toString()) {
    case PROGRAMIDS.FarmV3.toString():
    case PROGRAMIDS.FarmV5.toString(): {
      const layout = PROGRAMIDS.FarmV3.toString() === poolAccountInfo.owner.toString() ? FARM_STATE_LAYOUT_V3 : FARM_STATE_LAYOUT_V5
      const poolInfo = layout.decode(poolAccountInfo.data)

      const poolVaultAccount = await connection.getParsedAccountInfo(poolInfo.lpVault)
      const poolVaultAccountData = poolVaultAccount.value?.data as ParsedAccountData
      if (poolVaultAccountData.program !== 'spl-token') break

      for (const itemRewardInfo of poolInfo.rewardInfos) {
        const rewardVaultAdress = itemRewardInfo.rewardVault
        const rewardVaultAccount = await connection.getParsedAccountInfo(rewardVaultAdress)
        const rewardVaultAccountData = rewardVaultAccount.value?.data as ParsedAccountData
        if (rewardVaultAccountData.program !== 'spl-token') continue

        const sendCountYear = new Decimal(itemRewardInfo.perSlotReward.mul(new BN(2.5 * 3600 * 24 * 365)).toString()).div(10 ** rewardVaultAccountData.parsed.info.tokenAmount.decimals) // one slot -> 400ms
        const sendCountYearToU = sendCountYear.mul(mintPrice[rewardVaultAccountData.parsed.info.mint] ?? 0)

        const tvl = poolTvl[poolId] !== undefined ? poolTvl[poolId] : poolVaultAccountData.parsed.info.tokenAmount.uiAmount * (mintPrice[poolVaultAccountData.parsed.info.mint] ?? 0)

        rewardInfo.push({
          mint: rewardVaultAccountData.parsed.info.mint,
          price: mintPrice[rewardVaultAccountData.parsed.info.mint] ?? 0,
          sendCountYear: sendCountYear.toNumber(),
          sendCountYearToU: sendCountYearToU.toNumber(),
          tvl,
          apr: tvl !== 0 ? sendCountYearToU.div(tvl).toNumber() : 0,
        })
      }
      break
    }
    case PROGRAMIDS.FarmV6.toString(): {
      const layout = FARM_STATE_LAYOUT_V6
      const poolInfo = layout.decode(poolAccountInfo.data)

      const chainTime = await connection.getBlockTime(await connection.getSlot())
      if (chainTime === null) throw Error('get chain time error')

      const poolVaultAccount = await connection.getParsedAccountInfo(poolInfo.lpVault)
      const poolVaultAccountData = poolVaultAccount.value?.data as ParsedAccountData
      if (poolVaultAccountData.program !== 'spl-token') break

      for (const itemRewardInfo of poolInfo.rewardInfos) {
        const rewardVaultAdress = itemRewardInfo.rewardVault
        const rewardVaultAccount = await connection.getParsedAccountInfo(rewardVaultAdress)
        const rewardVaultAccountData = rewardVaultAccount.value?.data as ParsedAccountData
        if (rewardVaultAccountData.program !== 'spl-token') continue

        const rewardPerSecond = (itemRewardInfo.rewardOpenTime.toNumber() < chainTime && itemRewardInfo.rewardEndTime.toNumber() > chainTime) ? itemRewardInfo.rewardPerSecond : new BN(0)

        const sendCountYear = new Decimal(rewardPerSecond.mul(new BN(3600 * 24 * 365)).toString()).div(10 ** rewardVaultAccountData.parsed.info.tokenAmount.decimals)
        const sendCountYearToU = sendCountYear.mul(mintPrice[rewardVaultAccountData.parsed.info.mint] ?? 0)

        const tvl = poolTvl[poolId] !== undefined ? poolTvl[poolId] : poolVaultAccountData.parsed.info.tokenAmount.uiAmount * (mintPrice[poolVaultAccountData.parsed.info.mint] ?? 0)

        rewardInfo.push({
          mint: rewardVaultAccountData.parsed.info.mint,
          price: mintPrice[rewardVaultAccountData.parsed.info.mint] ?? 0,
          sendCountYear: sendCountYear.toNumber(),
          sendCountYearToU: sendCountYearToU.toNumber(),
          tvl,
          apr: tvl !== 0 ? sendCountYearToU.div(tvl).toNumber() : 0,
        })
      }
      break
    }
    default:
      throw Error('program Id check error')
  }
  console.log(rewardInfo)
}
