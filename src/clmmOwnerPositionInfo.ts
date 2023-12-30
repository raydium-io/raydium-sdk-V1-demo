import { Clmm } from '@raydium-io/raydium-sdk'
import { Keypair } from '@solana/web3.js'

import { connection, PROGRAMIDS, wallet } from '../config'
import { formatClmmKeys } from './formatClmmKeys'
import { getWalletTokenAccount } from './util'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}
async function clmmOwnerPositionInfo(input: TestTxInputInfo) {
  const poolKeys = await formatClmmKeys(PROGRAMIDS.CLMM.toString())

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
