import BN from 'bn.js';
import Decimal from 'decimal.js';

import {
  AmmV3,
  AmmV3ConfigInfo,
  ENDPOINT,
  Token,
} from '@raydium-io/raydium-sdk';
import {
  Keypair,
  PublicKey,
} from '@solana/web3.js';

import {
  connection,
  DEFAULT_TOKEN,
  makeTxVersion,
  PROGRAMIDS,
  RAYDIUM_MAINNET_API,
  wallet,
} from '../config';
import { buildAndSendTx } from './util';

type TestTxInputInfo = {
  baseToken: Token
  quoteToken: Token
  ammV3ConfigId: string
  wallet: Keypair
  startPoolPrice: Decimal
  startTime: BN
}

/**
 * pre-action: fetch basic ammConfig info
 *
 * step 1: make create pool instructions
 * step 2: (optional) get mockPool info
 * step 3: compose instructions to several transactions
 * step 4: send transactions
 */
async function ammV3CreatePool(input: TestTxInputInfo) {
  // -------- pre-action: fetch basic ammConfig info --------
  const ammConfigs = (await (await fetch(ENDPOINT + RAYDIUM_MAINNET_API.ammV3Configs)).json()).data as Record<
    string,
    Omit<AmmV3ConfigInfo, 'id'> & { id: string }
  >
  const makePublickey = (config: Omit<AmmV3ConfigInfo, 'id'> & { id: string }): AmmV3ConfigInfo => ({
    ...config,
    id: new PublicKey(config.id),
  })
  const ammConfig = makePublickey(ammConfigs[input.ammV3ConfigId])

  // -------- step 1: make create pool instructions --------
  const makeCreatePoolInstruction = await AmmV3.makeCreatePoolInstructionSimple({
    connection,
    programId: PROGRAMIDS.CLMM,
    owner: input.wallet.publicKey,
    mint1: input.baseToken,
    mint2: input.quoteToken,
    ammConfig,
    initialPrice: input.startPoolPrice,
    startTime: input.startTime,
    makeTxVersion,
    payer: wallet.publicKey,
  })

  // -------- step 2: (optional) get mockPool info --------
  const mockPoolInfo = AmmV3.makeMockPoolInfo({
    programId: PROGRAMIDS.CLMM,
    mint1: input.baseToken,
    mint2: input.quoteToken,
    ammConfig,
    createPoolInstructionSimpleAddress: makeCreatePoolInstruction.address,
    owner: input.wallet.publicKey,
    initialPrice: input.startPoolPrice,
    startTime: input.startTime
  })

  return { txids: await buildAndSendTx(makeCreatePoolInstruction.innerTransactions), mockPoolInfo }
}

async function howToUse() {
  const baseToken = DEFAULT_TOKEN.USDC // USDC
  const quoteToken = DEFAULT_TOKEN.RAY // RAY
  const ammV3ConfigId = 'E64NGkDLLCdQ2yFNPcavaKptrEgmiQaNykUuLC1Qgwyp'
  const startPoolPrice = new Decimal(1)
  const startTime = new BN(Math.floor(new Date().getTime() / 1000))

  ammV3CreatePool({
    baseToken,
    quoteToken,
    ammV3ConfigId,
    wallet: wallet,
    startPoolPrice,
    startTime,
  }).then(({ txids, mockPoolInfo }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
