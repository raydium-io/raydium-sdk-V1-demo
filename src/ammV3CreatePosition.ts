import { AmmV3, ApiAmmV3PoolsItem, buildTransaction, ENDPOINT, Token, TokenAmount } from '@raydium-io/raydium-sdk'
import { Keypair, PublicKey } from '@solana/web3.js'
import Decimal from 'decimal.js'
import { connection, RAYDIUM_MAINNET_API, wallet, wantBuildTxVersion } from '../config'
import { getWalletTokenAccount, sendTx } from './util'

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>
type TestTxInputInfo = {
  baseToken: Token
  quoteToken: Token
  targetPool: string
  inputTokenAmount: TokenAmount
  walletTokenAccounts: WalletTokenAccounts
  wallet: Keypair
  userCursorSide: 'base' | 'quote'
}

/**
 * pre-action: fetch basic AmmV3 info
 *
 * step 1: ammV3 info and ammV3 position
 * step 2: get tickUpper and tickLower
 * step 3: get liquidity
 * step 4: create instructions by SDK function
 * step 5: compose instructions to several transactions
 * step 6: send transactions
 */
async function ammV3CreatePosition(input: TestTxInputInfo) {
  // -------- pre-action: fetch basic info --------
  const ammV3Pools = (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Pools).then((res) => res.json())).data
  const ammV3Pool = ammV3Pools.find((pool: ApiAmmV3PoolsItem) => pool.id === input.targetPool)

  // -------- step 1: ammV3 info and ammV3 position --------
  const { [ammV3Pool.id]: sdkParsedAmmV3Info } = await AmmV3.fetchMultiplePoolInfos({
    connection,
    poolKeys: [ammV3Pool],
    chainTime: new Date().getTime() / 1000,
    ownerInfo: {
      wallet: wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
  })
  const { state: ammV3PoolInfo } = sdkParsedAmmV3Info

  // -------- step 2: get tickUpper and tickLower --------
  const { tick: tickLower } = AmmV3.getPriceAndTick({
    poolInfo: ammV3PoolInfo,
    baseIn: true,
    price: new Decimal(0.5), // will add position start price
  })
  const { tick: tickUpper } = AmmV3.getPriceAndTick({
    poolInfo: ammV3PoolInfo,
    baseIn: true,
    price: new Decimal(1.5), // will add position end price
  })

  // -------- step 3: get liquidity --------
  const isFocus1 = input.userCursorSide === 'base'
  const isCoin1Base = input.baseToken.mint.equals(ammV3Pool.state.mintA.mint)
  const isPairPoolDirectionEq = (isFocus1 && isCoin1Base) || (!isCoin1Base && !isFocus1)
  const { liquidity } = AmmV3.getLiquidityAmountOutFromAmountIn({
    poolInfo: ammV3PoolInfo,
    slippage: 0,
    inputA: isPairPoolDirectionEq,
    tickUpper,
    tickLower,
    amount: input.inputTokenAmount.raw,
    add: true, // SDK flag for math round direction
  })

  // -------- step 4: make open position instruction --------
  const makeOpenPositionInstruction = await AmmV3.makeOpenPositionInstructionSimple({
    connection,
    poolInfo: ammV3PoolInfo,
    ownerInfo: {
      feePayer: input.wallet.publicKey,
      wallet: input.wallet.publicKey,
      tokenAccounts: input.walletTokenAccounts,
    },
    tickLower,
    tickUpper,
    liquidity,
    slippage: 1,
  })

  // -------- step 5: compose instructions to several transactions --------
  const makeOpenPositionTransactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: makeOpenPositionInstruction.innerTransactions,
  })

  // -------- step 6: send transactions --------
  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, makeOpenPositionTransactions)
  return { txids }
}

async function howToUse() {
  const baseToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC
  const quoteToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
  const targetPool = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht' // USDC-RAY pool
  const inputTokenAmount = new TokenAmount(quoteToken, 10000)
  const walletTokenAccounts = await getWalletTokenAccount(connection, wallet.publicKey)
  const userCursorSide: 'base' | 'quote' = 'base'

  ammV3CreatePosition({
    baseToken,
    quoteToken,
    targetPool,
    inputTokenAmount,
    walletTokenAccounts,
    wallet: wallet,
    userCursorSide,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
