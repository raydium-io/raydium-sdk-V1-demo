import { TxVersion } from '@raydium-io/raydium-sdk';
import {
  AuthorityType,
  createSetAuthorityInstruction,
} from '@solana/spl-token';
import {
  PublicKey,
  Transaction,
} from '@solana/web3.js';

import {
  connection,
  wallet,
} from '../config';
import { sendTx } from './util';

(async () => {
  const tx = new Transaction();
  tx.add(
    createSetAuthorityInstruction(
      new PublicKey(' mint address '),
      wallet.publicKey,
      AuthorityType.FreezeAccount,
      null // if will delete , change -> new PublicKey(' new authority address ')
    )
  );

  const txids = await sendTx(connection, wallet, TxVersion.LEGACY, [tx]);
  console.log(txids);
})();
