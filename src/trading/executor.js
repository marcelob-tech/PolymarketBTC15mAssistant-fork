import fs from "fs";
import path from "path";
import { getTradingClient, Side, OrderType } from "./client.js";
import { CONFIG } from "../config.js";

const tradedMarkets = new Map();

function canTrade(marketSlug) {
  if (!CONFIG.trading.enabled) return { ok: false, reason: "trading_disabled" };
  if (!getTradingClient()) return { ok: false, reason: "client_not_initialized" };
  if (!marketSlug) return { ok: false, reason: "no_market" };

  const count = tradedMarkets.get(marketSlug) ?? 0;
  if (count >= CONFIG.trading.maxTradesPerMarket) {
    return { ok: false, reason: "max_trades_reached" };
  }
  return { ok: true };
}

function applySlippage(price, side) {
  const bps = CONFIG.trading.slippageBps / 10_000;
  if (side === "UP") return Math.min(price + bps, 0.99);
  return Math.min(price + bps, 0.99);
}

function roundToTick(price, tickSize) {
  const tick = tickSize || 0.001;
  return Math.round(price / tick) * tick;
}

export async function executeTrade({ side, tokenId, marketSlug, marketPrice, negRisk, tickSize }) {
  const check = canTrade(marketSlug);
  if (!check.ok) return { executed: false, reason: check.reason };

  const client = getTradingClient();
  const sizeUsdc = CONFIG.trading.sizeUsdc;
  const rawPrice = applySlippage(marketPrice, side);
  const price = roundToTick(rawPrice, tickSize);

  const orderParams = {
    tokenID: tokenId,
    price,
    size: sizeUsdc,
    side: Side.BUY,
  };

  const orderOptions = {
    tickSize: String(tickSize || "0.001"),
    negRisk: negRisk ?? false,
  };

  try {
    const result = await client.createAndPostOrder(orderParams, orderOptions, OrderType.FOK);

    const count = (tradedMarkets.get(marketSlug) ?? 0) + 1;
    tradedMarkets.set(marketSlug, count);

    const trade = {
      timestamp: new Date().toISOString(),
      marketSlug,
      side,
      tokenId,
      price,
      sizeUsdc,
      orderType: "FOK",
      success: true,
      orderId: result?.orderID ?? result?.id ?? null,
      status: result?.status ?? null,
      raw: JSON.stringify(result),
    };

    logTrade(trade);
    return { executed: true, trade, result };
  } catch (err) {
    const trade = {
      timestamp: new Date().toISOString(),
      marketSlug,
      side,
      tokenId,
      price,
      sizeUsdc,
      orderType: "FOK",
      success: false,
      error: err?.message ?? String(err),
    };

    logTrade(trade);
    return { executed: false, reason: "order_failed", error: err?.message ?? String(err), trade };
  }
}

const TRADE_LOG_HEADER = [
  "timestamp", "market_slug", "side", "token_id", "price",
  "size_usdc", "order_type", "success", "order_id", "status", "error"
];

function logTrade(trade) {
  try {
    const logDir = "./logs";
    const logFile = path.join(logDir, "trades.csv");
    fs.mkdirSync(logDir, { recursive: true });

    const exists = fs.existsSync(logFile);
    if (!exists) {
      fs.writeFileSync(logFile, TRADE_LOG_HEADER.join(",") + "\n", "utf8");
    }

    const row = [
      trade.timestamp,
      trade.marketSlug ?? "",
      trade.side ?? "",
      trade.tokenId ?? "",
      trade.price ?? "",
      trade.sizeUsdc ?? "",
      trade.orderType ?? "",
      trade.success ?? "",
      trade.orderId ?? "",
      trade.status ?? "",
      trade.error ?? "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");

    fs.appendFileSync(logFile, row + "\n", "utf8");
  } catch {
    // ignore logging errors
  }
}

export function resetMarketTradeCount(marketSlug) {
  tradedMarkets.delete(marketSlug);
}

export function getTradeCount(marketSlug) {
  return tradedMarkets.get(marketSlug) ?? 0;
}
