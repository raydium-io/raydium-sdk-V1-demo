import BN from 'bn.js';
import Decimal from 'decimal.js';

import {
  Clmm,
  ClmmConfigInfo,
  Token
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
  wallet
} from '../config';
import { formatClmmConfigs } from './formatClmmConfigs';
import { buildAndSendTx } from './util';

type TestTxInputInfo = {
  baseToken: Token
  quoteToken: Token
  clmmConfigId: string
  wallet: Keypair
  startPoolPrice: Decimal
  startTime: BN
}

async function clmmCreatePool(input: TestTxInputInfo) {
  // -------- pre-action: fetch basic ammConfig info --------
  const _ammConfig = (await formatClmmConfigs(PROGRAMIDS.CLMM.toString()))[input.clmmConfigId]
  const ammConfig: ClmmConfigInfo = { ..._ammConfig, id: new PublicKey(_ammConfig.id) }

  // -------- step 1: make create pool instructions --------
  const makeCreatePoolInstruction = await Clmm.makeCreatePoolInstructionSimple({
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
  const mockPoolInfo = Clmm.makeMockPoolInfo({
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
  const clmmConfigId = 'pool id'
  const startPoolPrice = new Decimal(1)
  const startTime = new BN(Math.floor(new Date().getTime() / 1000))

  clmmCreatePool({
    baseToken,
    quoteToken,
    clmmConfigId,
    wallet: wallet,
    startPoolPrice,
    startTime,
  }).then(({ txids, mockPoolInfo }) => {
    /** continue with txids */
    console.log('txids', txids)
  })
}
