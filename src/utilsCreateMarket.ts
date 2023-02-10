import { buildTransaction, MarketV2, Token } from '@raydium-io/raydium-sdk'
import { Keypair, PublicKey } from '@solana/web3.js'
import { connection, PROGRAMIDS, wallet, wantBuildTxVersion } from '../config'
import { sendTx } from './util'

type TestTxInputInfo = {
  baseToken: Token
  quoteToken: Token
  wallet: Keypair
}

/**
 * step 1: make instructions
 * step 2: compose instructions to several transactions
 * step 3: send transactions
 */
export async function createMarket(input: TestTxInputInfo) {
  // -------- step 1: make instructions --------
  const createMarketInstruments = await MarketV2.makeCreateMarketInstructionSimple({
    connection,
    wallet: input.wallet.publicKey,
    baseInfo: input.baseToken,
    quoteInfo: input.quoteToken,
    lotSize: 1, // default 1
    tickSize: 0.01, // default 0.01
    dexProgramId: PROGRAMIDS.OPENBOOK_MARKET,
  })

  // -------- step 2: compose instructions to several transactions --------
  const transactions = await buildTransaction({
    connection,
    txType: wantBuildTxVersion,
    payer: input.wallet.publicKey,
    innerTransactions: createMarketInstruments.innerTransactions,
  })

  // -------- step 3: send transactions --------
  const txids = await sendTx(connection, input.wallet, wantBuildTxVersion, transactions)
  return { txids }
}

async function howToUse() {
  const baseToken = new Token(new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY') // RAY
  const quoteToken = new Token(new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC') // USDC

  createMarket({
    baseToken,
    quoteToken,
    wallet: wallet,
  }).then(({ txids }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
