import { AmmV3, ApiAmmV3PoolsItem, buildTransaction, Percent, Token, TokenAmount } from '@raydium-io/raydium-sdk'
import { Keypair, PublicKey } from '@solana/web3.js'

import { connection, ENDPOINT, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'

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
  const ammV3Pool = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools)).json()).data.filter(
    (pool: ApiAmmV3PoolsItem) => pool.id === input.targetPool
  )
  const { [input.targetPool]: ammV3PoolInfo } = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: ammV3Pool,
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
    amountOutMin: minAmountOut.raw,
    remainingAccounts,
  })

  // -------- step 4: step 3: compose instructions to several transactions --------
  const transactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: innerTransactions,
  })

  // -------- step 5: send transaction --------
  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, transactions)
  return { txids }
}

async function howToUse() {
  const inputToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC
  const outputToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
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
