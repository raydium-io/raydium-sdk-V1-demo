import {
  AuthorityType,
  createSetAuthorityInstruction,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';

(async () => {
  const wallet = Keypair.fromSecretKey(Buffer.from(' your wallet secret key '))
  const connection = new Connection(' rpc url ')

  const tx = new Transaction()
  tx.add(createSetAuthorityInstruction(
    new PublicKey(' mint address '),
    wallet.publicKey,
    AuthorityType.FreezeAccount,
    null, // change -> new PublicKey(' new authority address ')
  ))
  
  const txid = await connection.sendTransaction(tx, [wallet])
  console.log(txid)
})()