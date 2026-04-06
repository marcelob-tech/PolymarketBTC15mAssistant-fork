import fs from "fs";
import path from "path";
import { CONFIG } from "../config.js";

/**
 * Paper trade simulator.
 * Records simulated entries and resolves them when the market settles.
 * Tracks winrate, P&L, and streak statistics.
 */

const openTrades = new Map();
const closedTrades = [];
const tradedMarkets = new Map();

const LOG_HEADER = [
  "timestamp", "market_slug", "side", "entry_price", "size_usdc",
  "confidence", "phase", "strength",
  "result", "payout", "pnl",
  "price_to_beat", "final_price", "resolved_at"
];

export function canPaperTrade(marketSlug) {
  if (!marketSlug) return false;
  const count = tradedMarkets.get(marketSlug) ?? 0;
  return count < CONFIG.trading.maxTradesPerMarket;
}

export function paperTrade({ side, marketSlug, entryPrice, sizeUsdc, confidence, phase, strength, priceToBeat, endDateMs }) {
  if (!canPaperTrade(marketSlug)) return null;

  const trade = {
    timestamp: new Date().toISOString(),
    marketSlug,
    side,
    entryPrice,
    sizeUsdc,
    confidence,
    phase,
    strength,
    priceToBeat,
    endDateMs,
    result: null,
    payout: null,
    pnl: null,
    finalPrice: null,
    resolvedAt: null,
  };

  openTrades.set(marketSlug, trade);
  const count = (tradedMarkets.get(marketSlug) ?? 0) + 1;
  tradedMarkets.set(marketSlug, count);

  return trade;
}

export function resolveOpenTrades(currentPrice, nowMs = Date.now()) {
  for (const [slug, trade] of openTrades) {
    if (!trade.endDateMs || nowMs < trade.endDateMs) continue;

    trade.finalPrice = currentPrice;
    trade.resolvedAt = new Date().toISOString();

    if (trade.priceToBeat !== null && currentPrice !== null) {
      const wentUp = currentPrice >= trade.priceToBeat;
      const betUp = trade.side === "UP";
      const won = (betUp && wentUp) || (!betUp && !wentUp);

      trade.result = won ? "WIN" : "LOSS";
      // Payout: if you buy at entryPrice and win, you get $1 per share
      // shares = sizeUsdc / entryPrice, payout = shares * 1.0
      const shares = trade.sizeUsdc / trade.entryPrice;
      trade.payout = won ? shares : 0;
      trade.pnl = won ? shares - trade.sizeUsdc : -trade.sizeUsdc;
    } else {
      trade.result = "UNKNOWN";
      trade.payout = 0;
      trade.pnl = 0;
    }

    closedTrades.push(trade);
    logPaperTrade(trade);
    openTrades.delete(slug);
  }
}

export function getOpenTrade(marketSlug) {
  return openTrades.get(marketSlug) ?? null;
}

export function getPaperTradeCount(marketSlug) {
  return tradedMarkets.get(marketSlug) ?? 0;
}

export function resetPaperTradeCount(marketSlug) {
  tradedMarkets.delete(marketSlug);
}

export function getStats() {
  const total = closedTrades.length;
  if (total === 0) return { total: 0, wins: 0, losses: 0, winrate: 0, pnl: 0, avgPnl: 0, streak: 0 };

  const wins = closedTrades.filter(t => t.result === "WIN").length;
  const losses = closedTrades.filter(t => t.result === "LOSS").length;
  const pnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  // Current streak
  let streak = 0;
  for (let i = closedTrades.length - 1; i >= 0; i--) {
    if (i === closedTrades.length - 1) {
      streak = closedTrades[i].result === "WIN" ? 1 : -1;
    } else {
      const same = (streak > 0 && closedTrades[i].result === "WIN") || (streak < 0 && closedTrades[i].result === "LOSS");
      if (same) streak += streak > 0 ? 1 : -1;
      else break;
    }
  }

  return {
    total,
    wins,
    losses,
    winrate: total > 0 ? (wins / total) * 100 : 0,
    pnl,
    avgPnl: total > 0 ? pnl / total : 0,
    streak,
  };
}

function logPaperTrade(trade) {
  try {
    const logDir = "./logs";
    const logFile = path.join(logDir, "paper_trades.csv");
    fs.mkdirSync(logDir, { recursive: true });

    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, LOG_HEADER.join(",") + "\n", "utf8");
    }

    const row = [
      trade.timestamp,
      trade.marketSlug ?? "",
      trade.side ?? "",
      trade.entryPrice ?? "",
      trade.sizeUsdc ?? "",
      trade.confidence ?? "",
      trade.phase ?? "",
      trade.strength ?? "",
      trade.result ?? "",
      trade.payout?.toFixed(4) ?? "",
      trade.pnl?.toFixed(4) ?? "",
      trade.priceToBeat ?? "",
      trade.finalPrice ?? "",
      trade.resolvedAt ?? "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");

    fs.appendFileSync(logFile, row + "\n", "utf8");
  } catch {
    // ignore
  }
}
