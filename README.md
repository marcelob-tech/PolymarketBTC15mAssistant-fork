# Polymarket BTC Up/Down Assistant

A real-time console trading assistant for Polymarket **"Bitcoin Up or Down"** markets (5m, 15m, or any series).

It combines:
- Polymarket market auto-selection by series slug (5m, 15m, etc.)
- Polymarket live WS **Chainlink BTC/USD CURRENT PRICE** (same feed shown on the Polymarket UI)
- Fallback to on-chain Chainlink (Polygon) via HTTP/WSS RPC
- Binance spot price for reference
- Short-term TA snapshot (Heiken Ashi, RSI, MACD, VWAP, Delta 1/3m)
- **Smart Analyzer** with confidence scoring, regime detection, spread-aware edge, and price-to-beat momentum
- **Automated trading** via Polymarket CLOB API (optional, disabled by default)

## Requirements

- Node.js **18+** (https://nodejs.org/en)
- npm (comes with Node)

## Quick Start

### 1) Clone the repository

```bash
git clone https://github.com/marcelob-tech/PolymarketBTC15mAssistant-fork.git
```

Alternative (no git): click the green `<> Code` button on GitHub → `Download ZIP` → extract → open terminal in the folder.

### 2) Install dependencies

```bash
npm install
```

### 3) Configure

Create/edit `src/.env`:

```env
# Market selection (auto-resolves series_id from slug)
POLYMARKET_SERIES_SLUG="btc-up-or-down-5m"
CANDLE_WINDOW_MINUTES=5

# Display
DISPLAY_TIMEZONE="America/Sao_Paulo"

# Trading (set TRADING_ENABLED=true to activate)
TRADING_ENABLED=false
WALLET_PRIVATE_KEY=
POLYMARKET_API_KEY=
POLYMARKET_API_SECRET=
POLYMARKET_API_PASSPHRASE=
SIGNATURE_TYPE=1
TRADE_SIZE_USDC=5
TRADE_SLIPPAGE_BPS=300
TRADE_MIN_EDGE=0.05
TRADE_MAX_PER_MARKET=1
```

### 4) Run

```bash
npm start
```

Press `Ctrl + C` to stop.

## Configuration

All configuration is via environment variables in `src/.env`.

### Market Selection

| Variable | Default | Description |
|----------|---------|-------------|
| `POLYMARKET_SERIES_SLUG` | `btc-up-or-down-15m` | Series slug. The `series_id` is resolved automatically. Examples: `btc-up-or-down-5m`, `btc-up-or-down-15m`, `eth-up-or-down-5m` |
| `POLYMARKET_SERIES_ID` | *(auto-resolved)* | Override series ID manually if needed |
| `POLYMARKET_SLUG` | *(empty)* | Pin a specific market slug instead of auto-selecting |
| `POLYMARKET_AUTO_SELECT_LATEST` | `true` | Auto-pick the latest live market from the series |
| `CANDLE_WINDOW_MINUTES` | `15` | Match this to your market window (5 for 5m, 15 for 15m) |

### Display

| Variable | Default | Description |
|----------|---------|-------------|
| `DISPLAY_TIMEZONE` | `America/New_York` | Timezone for title and session display (e.g. `America/Sao_Paulo`) |

### Trading

Trading is **disabled by default**. Set `TRADING_ENABLED=true` to activate.

| Variable | Default | Description |
|----------|---------|-------------|
| `TRADING_ENABLED` | `false` | Enable/disable automated trading |
| `WALLET_PRIVATE_KEY` | *(required)* | Your Polygon wallet private key |
| `POLYMARKET_API_KEY` | *(optional)* | API key (auto-derived on first run if empty) |
| `POLYMARKET_API_SECRET` | *(optional)* | API secret (auto-derived on first run if empty) |
| `POLYMARKET_API_PASSPHRASE` | *(optional)* | API passphrase (auto-derived on first run if empty) |
| `SIGNATURE_TYPE` | `1` | `0` = EOA wallet (MetaMask), `1` = Email wallet, `2` = Browser proxy |
| `TRADE_SIZE_USDC` | `5` | Amount in USDC per trade |
| `TRADE_SLIPPAGE_BPS` | `300` | Max slippage in basis points (300 = 3%) |
| `TRADE_MIN_EDGE` | `0.05` | Minimum edge (5%) required to execute a trade |
| `TRADE_MAX_PER_MARKET` | `1` | Max trades per market window |

On first run without API credentials, the app derives them automatically and prints them to the console. Copy them to your `.env`.

Trades are logged to `logs/trades.csv`.

### Chainlink on Polygon (fallback)

| Variable | Default | Description |
|----------|---------|-------------|
| `POLYGON_RPC_URL` | `https://polygon-rpc.com` | Primary Polygon HTTP RPC |
| `POLYGON_RPC_URLS` | *(empty)* | Comma-separated fallback RPCs |
| `POLYGON_WSS_URL` | *(empty)* | Polygon WebSocket RPC |
| `POLYGON_WSS_URLS` | *(empty)* | Comma-separated fallback WSS RPCs |

### Proxy Support

Supports HTTP(S) and SOCKS5 proxies for all connections.

| Variable | Example |
|----------|---------|
| `HTTPS_PROXY` | `http://127.0.0.1:8080` |
| `ALL_PROXY` | `socks5://127.0.0.1:1080` |

With authentication: `http://USERNAME:PASSWORD@HOST:PORT`

If your password contains `@` or `:`, URL-encode them (e.g. `p@ss:word` → `p%40ss%3Aword`).

## Console Display

```
Bitcoin Up or Down - April 5, 23:05-23:10 America/Sao Paulo
Market:         btc-updown-5m-1775441100
Time left:      03:44
────────────────────────────────────────────────────────
TA Predict:     LONG 60% / SHORT 40%
Heiken Ashi:    green x7
RSI:            67.3 ↓
MACD:           bullish (expanding)
Delta 1/3:      +$11.26, +0.02% | +$59.08, +0.09%
VWAP:           68,821 (0.16%) | slope
────────────────────────────────────────────────────────
ANALYZER:       ENTER UP [██████░░░░] 63% (LATE)
────────────────────────────────────────────────────────
POLYMARKET:     ↑ UP 0.49¢  |  ↓ DOWN 0.5¢
Liquidity:      17,952
Time left:      03:44
PRICE TO BEAT:  $68,890
CURRENT PRICE:  $68,899.42 ↑ (+$9.45)
────────────────────────────────────────────────────────
BTC (Binance):  $68,931 ↑ (+$31.14, +0.05%)
────────────────────────────────────────────────────────
TRADING:        DISABLED
────────────────────────────────────────────────────────
America/Sao Paulo | Session: 23:06:15 | Evening
```

### Analyzer

The smart analyzer combines all signals into a confidence score (0-100%):

- **Regime-aware** — requires more edge in choppy markets, less in trends
- **Spread-aware** — deducts bid-ask spread from edge before deciding
- **Price-to-beat momentum** — bonus when price moves in model direction
- **Indicator alignment** — checks how many indicators agree
- **Warnings** — `choppy_market`, `indicators_divergent`, `rsi_against_trade`, `low_liquidity`, `price_against_trade_late`

## Update

```bash
git pull
npm install
npm start
```

## Safety

This is not financial advice. Use at your own risk. Always test with small amounts first.
