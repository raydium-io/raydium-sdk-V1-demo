import { Liquidity } from '@raydium-io/raydium-sdk'
import { PublicKey } from '@solana/web3.js'

async function generateV4PoolInfo() {
  // RAY-USDC
  const poolInfo = Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
    quoteMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    baseDecimals: 6,
    quoteDecimals: 6,
    programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'),

    marketId: new PublicKey('DZjbn4XC8qoHKikZqzmhemykVzmossoayV9ffbsUqxVj'),
    marketProgramId: new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'),
  })

  return { poolInfo }
}

async function howToUse() {
  generateV4PoolInfo().then(({ poolInfo }) => {
    console.log('poolInfo: ', poolInfo)
  })
}
