import { InstructionType } from '@raydium-io/raydium-sdk';
import {
  AuthorityType,
  createSetAuthorityInstruction,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

import { wallet } from '../config';
import { buildAndSendTx } from './util';

(async () => {
  console.log({
    txids: await buildAndSendTx([
      {
        instructionTypes: [
          InstructionType.test,
        ],
        instructions: [
          createSetAuthorityInstruction(
            new PublicKey(' mint address '),
            wallet.publicKey,
            AuthorityType.FreezeAccount,
            null // if will delete , change -> new PublicKey(' new authority address ')
          )
        ],
        signers: [],
      }
    ])
  })
})()
