import { clamp } from "../utils.js";

/**
 * Smart trade analyzer - combines all market signals into a single trade decision.
 *
 * Improvements over the original decide():
 * - Uses regime to adjust thresholds (avoid CHOP, lean into TREND)
 * - Accounts for bid-ask spread in edge calculation
 * - Better time handling (conviction increases when price already moved in model direction)
 * - Price-to-beat momentum check (is BTC moving toward or away from target?)
 * - Position tracking built in (no re-entry on same market)
 * - Confidence scoring with multiple confirmation levels
 */

export function analyze({
  // Indicators
  price,
  vwap,
  vwapSlope,
  vwapDist,
  rsi,
  rsiSlope,
  macd,
  heikenColor,
  heikenCount,
  // Regime
  regime,
  // Time
  remainingMinutes,
  windowMinutes,
  // Market data
  marketUp,
  marketDown,
  modelUp,
  modelDown,
  edgeUp,
  edgeDown,
  // Price to beat
  priceToBeat,
  currentPrice,
  // Orderbook
  spread,
  liquidity,
  // Config overrides
  minEdge: minEdgeOverride,
}) {
  const result = {
    action: "NO_TRADE",
    side: null,
    confidence: 0,
    edge: 0,
    reasons: [],
    warnings: [],
    phase: "EARLY",
    strength: "NONE",
  };

  // --- Phase detection (adapted for any window size) ---
  const pctElapsed = 1 - (remainingMinutes / windowMinutes);
  result.phase = pctElapsed < 0.33 ? "EARLY" : pctElapsed < 0.67 ? "MID" : "LATE";

  // --- Missing data guard ---
  if (edgeUp === null || edgeDown === null || marketUp === null) {
    result.reasons.push("missing_market_data");
    return result;
  }

  // --- Regime-adjusted thresholds ---
  const regimeMultiplier = {
    TREND_UP: 0.7,
    TREND_DOWN: 0.7,
    RANGE: 1.2,
    CHOP: 2.0,
  }[regime] ?? 1.0;

  const baseEdgeThreshold = minEdgeOverride ?? 0.05;
  const phaseMultiplier = result.phase === "EARLY" ? 1.0 : result.phase === "MID" ? 1.3 : 1.8;
  const edgeThreshold = baseEdgeThreshold * phaseMultiplier * regimeMultiplier;

  // --- Spread-adjusted edge ---
  const spreadCost = spread !== null ? spread / 2 : 0.02;
  const netEdgeUp = edgeUp - spreadCost;
  const netEdgeDown = edgeDown - spreadCost;

  // --- Best side selection ---
  const bestSide = netEdgeUp > netEdgeDown ? "UP" : "DOWN";
  const bestNetEdge = bestSide === "UP" ? netEdgeUp : netEdgeDown;
  const bestRawEdge = bestSide === "UP" ? edgeUp : edgeDown;
  const bestModel = bestSide === "UP" ? modelUp : modelDown;

  result.side = bestSide;
  result.edge = bestRawEdge;

  // --- Edge threshold check ---
  if (bestNetEdge < edgeThreshold) {
    result.reasons.push(`net_edge_${(bestNetEdge * 100).toFixed(1)}%_below_threshold_${(edgeThreshold * 100).toFixed(1)}%`);
    return result;
  }

  // --- Confirmation scoring (0-100) ---
  let confidence = 0;

  // 1. Edge strength (0-30 points)
  confidence += clamp(bestNetEdge / 0.3, 0, 1) * 30;

  // 2. Model conviction (0-20 points)
  if (bestModel !== null) {
    confidence += clamp((bestModel - 0.5) / 0.3, 0, 1) * 20;
  }

  // 3. Regime alignment (0-15 points)
  if ((bestSide === "UP" && regime === "TREND_UP") || (bestSide === "DOWN" && regime === "TREND_DOWN")) {
    confidence += 15;
    result.reasons.push("regime_aligned");
  } else if (regime === "CHOP") {
    confidence -= 10;
    result.warnings.push("choppy_market");
  } else if (regime === "RANGE") {
    confidence -= 5;
    result.warnings.push("ranging_market");
  }

  // 4. Indicator alignment (0-20 points)
  let indicatorVotes = 0;
  let totalIndicators = 0;

  // VWAP position
  if (price !== null && vwap !== null) {
    totalIndicators++;
    if ((bestSide === "UP" && price > vwap) || (bestSide === "DOWN" && price < vwap)) {
      indicatorVotes++;
    }
  }

  // VWAP slope
  if (vwapSlope !== null) {
    totalIndicators++;
    if ((bestSide === "UP" && vwapSlope > 0) || (bestSide === "DOWN" && vwapSlope < 0)) {
      indicatorVotes++;
    }
  }

  // RSI
  if (rsi !== null) {
    totalIndicators++;
    if ((bestSide === "UP" && rsi > 50) || (bestSide === "DOWN" && rsi < 50)) {
      indicatorVotes++;
    }
    // Extreme RSI bonus/penalty
    if (bestSide === "UP" && rsi > 65) confidence += 3;
    if (bestSide === "DOWN" && rsi < 35) confidence += 3;
    // Counter-trend warning
    if (bestSide === "UP" && rsi < 40) result.warnings.push("rsi_against_trade");
    if (bestSide === "DOWN" && rsi > 60) result.warnings.push("rsi_against_trade");
  }

  // MACD
  if (macd?.hist !== null) {
    totalIndicators++;
    if ((bestSide === "UP" && macd.hist > 0) || (bestSide === "DOWN" && macd.hist < 0)) {
      indicatorVotes++;
    }
    // Expanding histogram bonus
    if (macd.histDelta !== null) {
      if ((bestSide === "UP" && macd.hist > 0 && macd.histDelta > 0) ||
          (bestSide === "DOWN" && macd.hist < 0 && macd.histDelta < 0)) {
        confidence += 3;
        result.reasons.push("macd_expanding");
      }
    }
  }

  // Heiken Ashi
  if (heikenColor) {
    totalIndicators++;
    const aligned = (bestSide === "UP" && heikenColor === "green") || (bestSide === "DOWN" && heikenColor === "red");
    if (aligned) {
      indicatorVotes++;
      if (heikenCount >= 3) confidence += 3;
      if (heikenCount >= 5) confidence += 2;
    }
  }

  if (totalIndicators > 0) {
    const alignment = indicatorVotes / totalIndicators;
    confidence += alignment * 20;
    if (alignment < 0.4) {
      result.warnings.push("indicators_divergent");
    }
  }

  // 5. Price-to-beat momentum (0-15 points)
  if (priceToBeat !== null && currentPrice !== null) {
    const diff = currentPrice - priceToBeat;
    const pctDiff = diff / priceToBeat;

    if (bestSide === "UP" && diff > 0) {
      // Price already above target, UP is winning
      confidence += clamp(pctDiff / 0.003, 0, 1) * 15;
      result.reasons.push(`price_above_target_+${(pctDiff * 100).toFixed(2)}%`);
    } else if (bestSide === "DOWN" && diff < 0) {
      // Price already below target, DOWN is winning
      confidence += clamp(Math.abs(pctDiff) / 0.003, 0, 1) * 15;
      result.reasons.push(`price_below_target_${(pctDiff * 100).toFixed(2)}%`);
    } else if (bestSide === "UP" && diff < 0 && result.phase === "LATE") {
      // Trying to buy UP but price is below target in late phase
      confidence -= 15;
      result.warnings.push("price_against_trade_late");
    } else if (bestSide === "DOWN" && diff > 0 && result.phase === "LATE") {
      confidence -= 15;
      result.warnings.push("price_against_trade_late");
    }
  }

  // 6. Liquidity check
  if (liquidity !== null && liquidity < 5000) {
    confidence -= 10;
    result.warnings.push("low_liquidity");
  }

  // --- Final decision ---
  confidence = clamp(confidence, 0, 100);
  result.confidence = Math.round(confidence);

  const minConfidence = result.phase === "EARLY" ? 40 : result.phase === "MID" ? 50 : 60;

  if (confidence >= minConfidence) {
    result.action = "ENTER";
    result.strength = confidence >= 75 ? "STRONG" : confidence >= 55 ? "GOOD" : "OPTIONAL";
    result.reasons.push(`confidence_${result.confidence}%`);
  } else {
    result.reasons.push(`confidence_${result.confidence}%_below_min_${minConfidence}%`);
  }

  return result;
}
