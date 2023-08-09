import { PublicKey, Commitment, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { SPL_ACCOUNT_LAYOUT, TokenAccount, Spl } from "@raydium-io/raydium-sdk";

export interface TokenAccountInfo {
  programId?: PublicKey;
  publicKey?: PublicKey;
  mint?: PublicKey;
  isAssociated?: boolean;
  amount: BN;
  isNative: boolean;
}

export async function getUserTokenAccounts(props: {
  connection: Connection;
  owner: PublicKey;
  commitment: Commitment;
}) {
  const { connection, owner, commitment } = props;

  console.log("fetching token accounts...\n");

  const accounts: TokenAccountInfo[] = [];
  const accountsRawInfo: TokenAccount[] = [];

  const solReq = connection.getAccountInfo(owner, commitment);
  const tokenReq = connection.getTokenAccountsByOwner(
    owner,
    { programId: TOKEN_PROGRAM_ID },
    commitment
  );
  const token2022Req = connection.getTokenAccountsByOwner(
    owner,
    { programId: TOKEN_2022_PROGRAM_ID },
    commitment
  );
  const [solRes, tokenRes, token2022Res] = await Promise.all([
    solReq,
    tokenReq,
    token2022Req,
  ]);

  console.log("fetching token accounts done.\n");

  for (const { pubkey, account } of [
    ...tokenRes.value,
    ...token2022Res.value,
  ]) {
    const rawResult = SPL_ACCOUNT_LAYOUT.decode(account.data);
    const { mint, amount } = rawResult;
    const associatedTokenAddress = Spl.getAssociatedTokenAccount({
      mint,
      owner,
      programId: account.owner,
    });
    accounts.push({
      publicKey: pubkey,
      mint,
      isAssociated: associatedTokenAddress.equals(pubkey),
      amount,
      isNative: false,
    });

    accountsRawInfo.push({
      pubkey,
      accountInfo: rawResult,
      programId: account.owner,
    } as TokenAccount);
  }

  accounts.push({
    amount: new BN(solRes ? String(solRes.lamports) : 0),
    isNative: true,
  });

  return { accounts, accountsRawInfo };
}
