import { AmmV3, ENDPOINT } from '@raydium-io/raydium-sdk'
import { Keypair } from '@solana/web3.js'

import { connection, RAYDIUM_MAINNET_API, wallet } from '../config'
import { getWalletTokenAccount } from './util'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}
async function ammV3OwnerPositionInfo(input: TestTxInputInfo) {
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data

  const infos = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: ammV3Pool,
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
  })

  return { infos }
}

async function howToUse() {
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  ammV3OwnerPositionInfo({
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ infos }) => {
    /** continue with infos */
    console.log('infos', infos)
  })
}
