import {
  AmmV3,
  ENDPOINT,
} from '@raydium-io/raydium-sdk';

import {
  connection,
  RAYDIUM_MAINNET_API,
  wallet,
} from '../config';
import { getWalletTokenAccount } from './util';

async function ammV3OwnerPositionInfo() {
  // wallet accounts
  const walletTokenAccountFormat = await getWalletTokenAccount(connection, wallet.publicKey);
  // get all pool info from api
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data

  const info = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: ammV3Pool,
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: walletTokenAccountFormat,
    },
  })

  console.log('pool and owner info', info)
}

ammV3OwnerPositionInfo();
