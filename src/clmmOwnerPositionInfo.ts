import { Clmm, ENDPOINT } from '@raydium-io/raydium-sdk'
import { Keypair } from '@solana/web3.js'

import { connection, RAYDIUM_MAINNET_API, wallet } from '../config'
import { getWalletTokenAccount } from './util'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}
async function clmmOwnerPositionInfo(input: TestTxInputInfo) {
  const poolKeys = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.clmmPools)).json()).data

  const infos = await Clmm.fetchMultiplePoolInfos({
    connection,
    poolKeys,
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

  clmmOwnerPositionInfo({
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ infos }) => {
    /** continue with infos */
    console.log('infos', infos)
  })
}
