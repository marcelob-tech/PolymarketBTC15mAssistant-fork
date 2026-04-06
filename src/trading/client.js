import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { CONFIG } from "../config.js";

const CLOB_HOST = CONFIG.clobBaseUrl;
const CHAIN_ID = 137;

let _client = null;

export function getTradingClient() {
  return _client;
}

export async function initTradingClient() {
  const { privateKey, apiKey, apiSecret, apiPassphrase, signatureType } = CONFIG.trading;

  if (!privateKey) {
    throw new Error("WALLET_PRIVATE_KEY is required for trading");
  }

  const wallet = new ethers.Wallet(privateKey);

  let creds = null;
  if (apiKey && apiSecret && apiPassphrase) {
    creds = { key: apiKey, secret: apiSecret, passphrase: apiPassphrase };
  }

  if (!creds) {
    const tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, wallet);
    const derived = await tempClient.createOrDeriveApiKey();
    creds = { key: derived.apiKey, secret: derived.secret, passphrase: derived.passphrase };

    console.log("\n──── Polymarket API Credentials (save to .env) ──���─");
    console.log(`POLYMARKET_API_KEY="${creds.key}"`);
    console.log(`POLYMARKET_API_SECRET="${creds.secret}"`);
    console.log(`POLYMARKET_API_PASSPHRASE="${creds.passphrase}"`);
    console.log("────────────────────────────────────────────────────\n");
  }

  _client = new ClobClient(
    CLOB_HOST,
    CHAIN_ID,
    wallet,
    { apiKey: creds.key, secret: creds.secret, passphrase: creds.passphrase },
    signatureType
  );

  return _client;
}

export { Side, OrderType };
