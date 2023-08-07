import {
  AmmV3,
  ApiAmmV3PoolsItem,
  fetchMultipleMintInfos,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  DEFAULT_TOKEN,
  ENDPOINT,
  makeTxVersion,
  RAYDIUM_MAINNET_API,
  wallet,
} from '../config';
import {
  buildAndSendTx,
  getWalletTokenAccount,
} from './util';

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  outputToken: Token
  targetPool: string
  inputTokenAmount: TokenAmount
  slippage: Percent
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
}

async function swapOnlyCLMM(input: TestTxInputInfo) {
  // -------- pre-action: fetch ammV3 pools info --------
  const clmmPools: ApiAmmV3PoolsItem[] = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data.filter(
    (pool: ApiAmmV3PoolsItem) => pool.id === input.targetPool
  )
  const { [input.targetPool]: ammV3PoolInfo } = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: clmmPools,
    chainTime: new Date().getTime() / 1000,
  })

  // -------- step 1: fetch tick array --------
  const tickCache = await AmmV3.fetchMultiplePoolTickArrays({
    connection,
    poolKeys: [ammV3PoolInfo.state],
    batchRequest: true,
  })

  // -------- step 2: calc amount out by SDK function --------
  // Configure input/output parameters, in this example, this token amount will swap 0.0001 USDC to RAY
  const { minAmountOut, remainingAccounts } = AmmV3.computeAmountOutFormat({
    poolInfo: ammV3PoolInfo.state,
    tickArrayCache: tickCache[input.targetPool],
    amountIn: input.inputTokenAmount,
    currencyOut: input.outputToken,
    slippage: input.slippage,
    epochInfo: await connection.getEpochInfo(),
    token2022Infos: await fetchMultipleMintInfos({connection, mints: [
      ...clmmPools.map(i => [{mint: i.mintA, program: i.mintProgramIdA}, {mint: i.mintB, program: i.mintProgramIdB}]).flat().filter(i => i.program === TOKEN_2022_PROGRAM_ID.toString()).map(i => new PublicKey(i.mint)),
    ]}),
  })

  // -------- step 3: create instructions by SDK function --------
  const { innerTransactions } = await AmmV3.makeSwapBaseInInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo.state,
    ownerInfo: {
      feePayer: input.wallet.publicKey,
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
    inputMint: input.inputTokenAmount.token.mint,
    amountIn: input.inputTokenAmount.raw,
    amountOutMin: minAmountOut.amount.raw,
    remainingAccounts,
    makeTxVersion,
  })

  return { txids: await buildAndSendTx(innerTransactions) }
}

async function howToUse() {
  const inputToken = DEFAULT_TOKEN.USDC // USDC
  const outputToken = DEFAULT_TOKEN.RAY // RAY
  const targetPool = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht' // USDC-RAY pool
  const inputTokenAmount = new TokenAmount(inputToken, 100)
  const slippage = new Percent(1, 100)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)

  swapOnlyCLMM({
    outputToken,
    targetPool,
    inputTokenAmount,
    slippage,
    walletTokenAccounts,
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
