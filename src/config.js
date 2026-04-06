import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

export const CONFIG = {
  symbol: "BTCUSDT",
  binanceBaseUrl: "https://api.binance.com",
  gammaBaseUrl: "https://gamma-api.polymarket.com",
  clobBaseUrl: "https://clob.polymarket.com",

  pollIntervalMs: 1_000,
  candleWindowMinutes: parseInt(process.env.CANDLE_WINDOW_MINUTES || "15", 10),

  vwapSlopeLookbackMinutes: 5,
  rsiPeriod: 14,
  rsiMaPeriod: 14,

  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,

  polymarket: {
    marketSlug: process.env.POLYMARKET_SLUG || "",
    seriesId: process.env.POLYMARKET_SERIES_ID || "",
    seriesSlug: process.env.POLYMARKET_SERIES_SLUG || "btc-up-or-down-15m",
    autoSelectLatest: (process.env.POLYMARKET_AUTO_SELECT_LATEST || "true").toLowerCase() === "true",
    liveDataWsUrl: process.env.POLYMARKET_LIVE_WS_URL || "wss://ws-live-data.polymarket.com",
    upOutcomeLabel: process.env.POLYMARKET_UP_LABEL || "Up",
    downOutcomeLabel: process.env.POLYMARKET_DOWN_LABEL || "Down"
  },

  trading: {
    enabled: (process.env.TRADING_ENABLED || "false").toLowerCase() === "true",
    paperTrade: (process.env.PAPER_TRADE || "false").toLowerCase() === "true",
    privateKey: process.env.WALLET_PRIVATE_KEY || "",
    apiKey: process.env.POLYMARKET_API_KEY || "",
    apiSecret: process.env.POLYMARKET_API_SECRET || "",
    apiPassphrase: process.env.POLYMARKET_API_PASSPHRASE || "",
    signatureType: parseInt(process.env.SIGNATURE_TYPE || "1", 10),
    sizeUsdc: parseFloat(process.env.TRADE_SIZE_USDC || "5"),
    slippageBps: parseInt(process.env.TRADE_SLIPPAGE_BPS || "300", 10),
    minEdge: parseFloat(process.env.TRADE_MIN_EDGE || "0.05"),
    maxTradesPerMarket: parseInt(process.env.TRADE_MAX_PER_MARKET || "1", 10),
  },

  chainlink: {
    polygonRpcUrls: (process.env.POLYGON_RPC_URLS || "").split(",").map((s) => s.trim()).filter(Boolean),
    polygonRpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    polygonWssUrls: (process.env.POLYGON_WSS_URLS || "").split(",").map((s) => s.trim()).filter(Boolean),
    polygonWssUrl: process.env.POLYGON_WSS_URL || "",
    btcUsdAggregator: process.env.CHAINLINK_BTC_USD_AGGREGATOR || "0xc907E116054Ad103354f2D350FD2514433D57F6f"
  }
};
