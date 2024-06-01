import 'dotenv/config';

import {
  ENDPOINT as _ENDPOINT,
  Currency,
  DEVNET_PROGRAM_ID,
  LOOKUP_TABLE_CACHE,
  MAINNET_PROGRAM_ID,
  ProgramId,
  RAYDIUM_MAINNET,
  Token,
  TOKEN_PROGRAM_ID,
  TxVersion,
} from '@raydium-io/raydium-sdk';
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';

export const rpcUrl: string = process.env.RPC_URL!

export const rpcToken: string | undefined = undefined

export const wallet = Keypair.fromSecretKey(new Uint8Array(process.env.PRIVATE_KEY!.split(",").map(Number)))

export const connection = new Connection(rpcUrl);

export const PROGRAMIDS = process.env.ENV == "MAINNET" ? MAINNET_PROGRAM_ID: DEVNET_PROGRAM_ID;

export const FEE_DESTINATION = process.env.ENV == "MAINNET" 
  ? new PublicKey('7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5') 
  : new PublicKey('3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR');

export const ENDPOINT = _ENDPOINT;

export const RAYDIUM_MAINNET_API = RAYDIUM_MAINNET;

export const makeTxVersion = TxVersion.V0; // LEGACY

export const addLookupTableInfo = process.env.ENV == "MAINNET" ? LOOKUP_TABLE_CACHE: undefined; // only mainnet. other = undefined

export const DEFAULT_TOKEN = {
  'SOL': new Currency(9, 'USDC', 'USDC'),
  'WSOL': new Token(TOKEN_PROGRAM_ID, new PublicKey('So11111111111111111111111111111111111111112'), 9, 'WSOL', 'WSOL'),
  'USDC': new Token(TOKEN_PROGRAM_ID, new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 6, 'USDC', 'USDC'),
  'RAY': new Token(TOKEN_PROGRAM_ID, new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'), 6, 'RAY', 'RAY'),
  'RAY_USDC-LP': new Token(TOKEN_PROGRAM_ID, new PublicKey('FGYXP4vBkMEtKhxrmEBcWN8VNmXX8qNgEJpENKDETZ4Y'), 6, 'RAY-USDC', 'RAY-USDC'),
}