import {
  ENDPOINT as _ENDPOINT,
  MAINNET_PROGRAM_ID,
  RAYDIUM_MAINNET,
  TxVersion,
} from '@raydium-io/raydium-sdk';
import {
  Connection,
  Keypair,
} from '@solana/web3.js';

export const wallet = Keypair.fromSecretKey(Buffer.from(' wallet secret key'));

export const connection = new Connection(' url ');

export const PROGRAMIDS = MAINNET_PROGRAM_ID;

export const ENDPOINT = _ENDPOINT;

export const RAYDIUM_MAINNET_API = RAYDIUM_MAINNET;

export const wantBuildTxVersion = TxVersion.V0; // LEGACY
