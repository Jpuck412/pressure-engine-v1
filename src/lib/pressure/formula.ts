// src/lib/pressure/formula.ts

import type {
  CatalystStrength,
  DataFreshness,
  DirtyCatalystRisk,
  LiquidityConfidence,
  PermissionStatus,
  PressureEngineCalculations,
  PressureEngineInput,
  PressureEngineOutput,
  PressureScoreBreakdown,
  PressureVerdict,
} from "./types";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value: number | null, decimals = 4): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function safePct(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function scoreAttention(gapPct: number | null): number {
  if (gapPct === null) return 0;
  if (gapPct < 5) return 0;
  if (gapPct < 10) return 5;
  if (gapPct <= 40) return 15;
  if (gapPct <= 80) return 12;
  if (gapPct <= 150) return 6;
  return 2;
}

function scoreVolumePressure(volumeDelta: number | null): number {
  if (volumeDelta === null || volumeDelta <= 0) return 0;
  if (volumeDelta < 5_000) return 3;
  if (volumeDelta < 20_000) return 8;
  if (volumeDelta < 50_000) return 15;
  if (volumeDelta < 100_000) return 20;
  return 25;
}

function scoreVolumePersistence(volumeDeltas?: number[]): number {
  if (!volumeDeltas || volumeDeltas.length < 3) return 0;
  const lastThree = volumeDeltas.slice(-3);
  return lastThree.every((delta) => delta > 0) ? 5 : 0;
}

function scorePricePressure(priceVelocityPct: number | null, volumePressureScore: number): number {
  let score = 0;

  if (priceVelocityPct === null || priceVelocityPct <= 0) score = 0;
  else if (priceVelocityPct < 0.5) score = 4;
  else if (priceVelocityPct < 1.5) score = 8;
  else if (priceVelocityPct < 3) score = 12;
  else score = 15;

  if (volumePressureScore < 8) return Math.min(score, 5);
  return score;
}

function scoreStructure(params: {
  higherHigh: boolean;
  higherLow: boolean;
  priceAboveVWAP: boolean;
  reclaimingRecentBreakoutLevel: boolean;
}): number {
  let score = 0;

  if (params.higherHigh && params.higherLow) score += 10;
  else if (params.higherHigh) score += 5;
  else if (params.higherLow) score += 3;

  if (params.priceAboveVWAP) score += 5;
  if (params.reclaimingRecentBreakoutLevel) score += 5;

  return Math.min(score, 20);
}

function scoreLiquidity(params: {
  spreadPct: number | null;
  dollarVolume: number | null;
  hasBidAsk: boolean;
}): number {
  const { spreadPct, dollarVolume, hasBidAsk } = params;

  if (hasBidAsk) {
    if (spreadPct === null) return 0;
    if (spreadPct <= 0.5) return 20;
    if (spreadPct <= 1) return 15;
    if (spreadPct <= 2) return 8;
    if (spreadPct <= 5) return 3;
    return 0;
  }

  if (dollarVolume === null) return 0;
  if (dollarVolume >= 1_000_000) return 12;
  if (dollarVolume >= 500_000) return 10;
  if (dollarVolume >= 100_000) return 7;
  if (dollarVolume >= 25_000) return 3;
  return 0;
}

function scoreRawSpreadBonus(rawSpread: number | null, hasBidAsk: boolean): number {
  if (!hasBidAsk || rawSpread === null) return 0;
  if (rawSpread <= 0.0005) return 5;
  if (rawSpread <= 0.001) return 3;
  return 0;
}

function scoreLocation(distanceFromSupportPct: number | null): number {
  if (distanceFromSupportPct === null) return 0;
  if (distanceFromSupportPct <= 1) return 15;
  if (distanceFromSupportPct <= 3) return 10;
  if (distanceFromSupportPct <= 5) return 5;
  return 0;
}

function scoreCatalyst(strength: CatalystStrength): number {
  if (strength === "MAJOR") return 15;
  if (strength === "MINOR") return 8;
  if (strength === "ABNORMAL_VOLUME_ONLY") return 3;
  return 0;
}

function scoreRange(premarketRangePct: number | null): number {
  if (premarketRangePct === null) return 0;
  if (premarketRangePct < 5) return 0;
  if (premarketRangePct < 10) return 5;
  if (premarketRangePct < 25) return 10;
  if (premarketRangePct < 50) return 8;
  return 3;
}

function scoreFloat(floatShares: number | null): number {
  if (floatShares === null || floatShares <= 0) return 0;
  if (floatShares <= 5_000_000) return 10;
  if (floatShares <= 10_000_000) return 8;
  if (floatShares <= 20_000_000) return 5;
  if (floatShares <= 50_000_000) return 2;
  return 0;
}

function penaltyExtension(params: {
  extensionFromSupportPct: number | null;
  supportExists: boolean;
  gapPct: number | null;
}): number {
  const { extensionFromSupportPct, supportExists, gapPct } = params;

  if (!supportExists && gapPct !== null && gapPct > 80) return 15;
  if (extensionFromSupportPct === null) return 0;
  if (extensionFromSupportPct < 10) return 0;
  if (extensionFromSupportPct < 20) return 6;
  if (extensionFromSupportPct < 30) return 12;
  return 20;
}

function penaltySpread(spreadPct: number | null, hasBidAsk: boolean): number {
  if (!hasBidAsk || spreadPct === null) return 0;
  if (spreadPct <= 1) return 0;
  if (spreadPct <= 2) return 5;
  if (spreadPct <= 5) return 12;
  return 99;
}

function penaltyWeakTape(params: {
  priceVelocityPct: number | null;
  volumeDelta: number | null;
  lowerHigh: boolean;
  priceBelowSupport: boolean;
}): number {
  if (params.priceBelowSupport) return 99;
  let penalty = 0;

  if (
    params.priceVelocityPct !== null &&
    params.priceVelocityPct <= 0 &&
    params.volumeDelta !== null &&
    params.volumeDelta > 0
  ) {
    penalty += 15;
  } else if (
    params.priceVelocityPct !== null &&
    params.priceVelocityPct <= 0 &&
    (params.volumeDelta === null || params.volumeDelta <= 0)
  ) {
    penalty += 10;
  }

  if (params.lowerHigh) penalty += 10;

  return penalty;
}

function penaltyDirtyCatalyst(risk: DirtyCatalystRisk): number {
  if (risk === "ACTIVE_OFFERING") return 20;
  if (risk === "ATM_FILING") return 10;
  if (risk === "REVERSE_SPLIT_ONLY") return 8;
  if (risk === "DELISTING_WARNING") return 8;
  if (risk === "DILUTION_HEAVY_FILING") return 15;
  return 0;
}

function penaltyStaleData(params: {
  isDataStale?: boolean;
  isDelayed?: boolean;
  priceVelocityPct: number | null;
  volumeDelta: number | null;
}): number {
  let penalty = 0;
  if (params.isDataStale) penalty += 20;
  if (params.isDelayed) penalty += 0;
  if (params.volumeDelta === 0) penalty += 10;
  if (params.priceVelocityPct === 0) penalty += 10;
  return Math.min(penalty, 30);
}

function getVerdict(score: number, hardRejected: boolean): PressureVerdict {
  if (hardRejected || score < 50) return "REJECT";
  if (score < 65) return "WATCH_ONLY";
  if (score < 80) return "PRESSURE_BUILDING";
  if (score < 90) return "RUNNER_CANDIDATE";
  return "PRIORITY_RUNNER_WATCH";
}

function getPermissionStatus(params: {
  score: number;
  hardRejected: boolean;
  supportExists: boolean;
  priceAboveSupport: boolean;
  distanceFromSupportPct: number | null;
  volumeDelta: number | null;
  priceVelocityPct: number | null;
  spreadPct: number | null;
  hasBidAsk: boolean;
  higherHigh: boolean;
  reclaimingRecentBreakoutLevel: boolean;
  invalidationLevel: number | null;
}): PermissionStatus {
  if (params.hardRejected) return "NO_PERMISSION";
  if (params.score < 80) return "NO_PERMISSION";

  const spreadGood =
    !params.hasBidAsk || (params.spreadPct !== null && params.spreadPct <= 2);

  const proofReady =
    params.supportExists &&
    params.priceAboveSupport &&
    params.distanceFromSupportPct !== null &&
    params.distanceFromSupportPct <= 5 &&
    params.volumeDelta !== null &&
    params.volumeDelta > 0 &&
    params.priceVelocityPct !== null &&
    params.priceVelocityPct > 0 &&
    spreadGood &&
    (params.higherHigh || params.reclaimingRecentBreakoutLevel) &&
    params.invalidationLevel !== null;

  return proofReady ? "PERMISSION_READY" : "NEED_PROOF";
}

function buildProofNeeded(params: {
  nearestSupport: number | null;
  spreadPct: number | null;
  hasBidAsk: boolean;
  priceVelocityPct: number | null;
  volumeDelta: number | null;
  higherHigh: boolean;
  higherLow: boolean;
  reclaimingRecentBreakoutLevel: boolean;
  priceAboveVWAP: boolean;
}): string {
  const needs: string[] = [];

  if (params.nearestSupport !== null) {
    needs.push(`support hold above ${params.nearestSupport.toFixed(4)}`);
  } else {
    needs.push("identified support");
  }

  if (params.volumeDelta === null || params.volumeDelta <= 0) {
    needs.push("fresh volume increase");
  }

  if (params.priceVelocityPct === null || params.priceVelocityPct <= 0) {
    needs.push("price acceleration");
  }

  if (!params.higherHigh && !params.reclaimingRecentBreakoutLevel) {
    needs.push("higher high or reclaim");
  }

  if (!params.higherLow) {
    needs.push("higher low");
  }

  if (!params.priceAboveVWAP) {
    needs.push("VWAP reclaim if available");
  }

  if (params.hasBidAsk && (params.spreadPct === null || params.spreadPct > 2)) {
    needs.push("spread below 2%");
  }

  return `Needs ${needs.join(" + ")}.`;
}

function inferFreshness(isDataStale?: boolean, isDelayed?: boolean): DataFreshness {
  if (isDelayed) return "DELAYED_TEST_ONLY";
  if (isDataStale) return "STALE";
  return "LIVE_OR_RECENT";
}

function inferLiquidityConfidence(hasBidAsk: boolean): LiquidityConfidence {
  return hasBidAsk ? "REAL_BID_ASK" : "PROXY_ONLY";
}

export function calculatePressure(input: PressureEngineInput): PressureEngineOutput {
  const symbol = String(input.symbol || "").trim().toUpperCase();

  const currentPrice = toNumber(input.currentPrice);
  const previousClose = toNumber(input.previousClose);
  const currentVolume = toNumber(input.currentVolume);

  const previousSnapshotPrice = toNumber(input.previousSnapshotPrice);
  const previousSnapshotVolume = toNumber(input.previousSnapshotVolume);
  const secondsBetweenScans = toNumber(input.secondsBetweenScans) ?? 5;

  const dayHigh = toNumber(input.dayHigh);
  const dayLow = toNumber(input.dayLow);

  const premarketHigh = toNumber(input.premarketHigh) ?? dayHigh;
  const premarketLow = toNumber(input.premarketLow) ?? dayLow;

  const recentHigh = toNumber(input.recentHigh) ?? dayHigh;
  const recentLow = toNumber(input.recentLow) ?? dayLow;
  const previousRecentHigh = toNumber(input.previousRecentHigh);
  const previousRecentLow = toNumber(input.previousRecentLow);

  const vwap = toNumber(input.vwap);
  const recentBreakoutLevel = toNumber(input.recentBreakoutLevel);
  const nearestSupport = toNumber(input.nearestSupport);

  const bid = toNumber(input.bid);
  const ask = toNumber(input.ask);

  const floatShares = toNumber(input.floatShares);

  const catalystStrength = input.catalystStrength ?? "NONE";
  const dirtyCatalystRisk = input.dirtyCatalystRisk ?? "NONE";
  const catalystLabel = input.catalystLabel ?? null;

  const hasBidAsk =
    bid !== null &&
    ask !== null &&
    bid > 0 &&
    ask > 0 &&
    ask >= bid &&
    currentPrice !== null &&
    currentPrice > 0;

  const rawSpread = hasBidAsk ? ask! - bid! : null;
  const spreadPct =
    hasBidAsk && rawSpread !== null && currentPrice !== null
      ? safePct(rawSpread, currentPrice)
      : null;

  const gapPct =
    currentPrice !== null && previousClose !== null
      ? safePct(currentPrice - previousClose, previousClose)
      : null;

  const priceVelocityPct =
    currentPrice !== null && previousSnapshotPrice !== null
      ? safePct(currentPrice - previousSnapshotPrice, previousSnapshotPrice)
      : null;

  const volumeDelta =
    currentVolume !== null && previousSnapshotVolume !== null
      ? currentVolume - previousSnapshotVolume
      : null;

  const volumePerSecond =
    volumeDelta !== null && secondsBetweenScans > 0
      ? volumeDelta / secondsBetweenScans
      : null;

  const volumeVelocityPct =
    volumeDelta !== null && previousSnapshotVolume !== null
      ? safePct(volumeDelta, Math.max(previousSnapshotVolume, 1))
      : null;

  const dollarVolume =
    currentPrice !== null && currentVolume !== null
      ? currentPrice * currentVolume
      : null;

  const premarketRangePct =
    premarketHigh !== null && premarketLow !== null && previousClose !== null
      ? safePct(premarketHigh - premarketLow, previousClose)
      : null;

  const higherHigh =
    recentHigh !== null &&
    previousRecentHigh !== null &&
    recentHigh > previousRecentHigh;

  const higherLow =
    recentLow !== null &&
    previousRecentLow !== null &&
    recentLow > previousRecentLow;

  const lowerHigh =
    recentHigh !== null &&
    previousRecentHigh !== null &&
    recentHigh < previousRecentHigh;

  const priceAboveVWAP =
    currentPrice !== null && vwap !== null && currentPrice > vwap;

  const reclaimingRecentBreakoutLevel =
    currentPrice !== null &&
    recentBreakoutLevel !== null &&
    currentPrice > recentBreakoutLevel;

  const supportExists = nearestSupport !== null && nearestSupport > 0;
  const priceBelowSupport =
    supportExists && currentPrice !== null && currentPrice < nearestSupport;
  const priceAboveSupport =
    supportExists && currentPrice !== null && currentPrice >= nearestSupport;

  const distanceFromSupportPct =
    supportExists && currentPrice !== null
      ? safePct(currentPrice - nearestSupport, currentPrice)
      : null;

  const extensionFromSupportPct =
    supportExists && currentPrice !== null
      ? safePct(currentPrice - nearestSupport, nearestSupport)
      : null;

  const hardRejectReasons: string[] = [];

  if (!symbol) hardRejectReasons.push("Missing symbol.");
  if (currentPrice === null || currentPrice <= 0) hardRejectReasons.push("Invalid current price.");
  if (previousClose === null || previousClose <= 0) hardRejectReasons.push("Invalid previous close.");
  if (currentVolume === null || currentVolume < 100_000) hardRejectReasons.push("Volume below 100,000.");
  if (currentPrice !== null && currentPrice < 0.2) hardRejectReasons.push("Price below $0.20.");
  if (currentPrice !== null && currentPrice > 10) hardRejectReasons.push("Price above $10.");
  if (input.exchange === "OTC") hardRejectReasons.push("OTC symbol rejected.");
  if (input.symbolType && input.symbolType !== "COMMON" && input.symbolType !== "UNKNOWN") {
    hardRejectReasons.push(`${input.symbolType} rejected.`);
  }
  if (spreadPct !== null && spreadPct > 5) hardRejectReasons.push("Spread above 5%.");
  if (priceBelowSupport) hardRejectReasons.push("Price below confirmed support.");
  if (input.isDataStale) hardRejectReasons.push("Data is stale.");

  const calculations: PressureEngineCalculations = {
    gapPct: round(gapPct),
    priceVelocityPct: round(priceVelocityPct),
    volumeDelta: round(volumeDelta, 0),
    volumePerSecond: round(volumePerSecond, 2),
    volumeVelocityPct: round(volumeVelocityPct),
    dollarVolume: round(dollarVolume, 2),
    premarketRangePct: round(premarketRangePct),

    higherHigh,
    higherLow,
    lowerHigh,
    priceAboveVWAP,
    reclaimingRecentBreakoutLevel,

    rawSpread: round(rawSpread, 6),
    spreadPct: round(spreadPct),

    distanceFromSupportPct: round(distanceFromSupportPct),
    extensionFromSupportPct: round(extensionFromSupportPct),
  };

  const volumePressureBase = scoreVolumePressure(volumeDelta);
  const volumePersistenceBonus = scoreVolumePersistence(input.volumeDeltas);
  const volumePressureScore = Math.min(volumePressureBase + volumePersistenceBonus, 30);

  const pricePressureScore = scorePricePressure(priceVelocityPct, volumePressureScore);

  const scores: PressureScoreBreakdown = {
    attentionScore: scoreAttention(gapPct),
    volumePressureScore,
    volumePersistenceBonus,
    pricePressureScore,
    structureScore: scoreStructure({
      higherHigh,
      higherLow,
      priceAboveVWAP,
      reclaimingRecentBreakoutLevel,
    }),
    liquidityScore: scoreLiquidity({
      spreadPct,
      dollarVolume,
      hasBidAsk,
    }),
    rawSpreadBonus: scoreRawSpreadBonus(rawSpread, hasBidAsk),
    locationScore: scoreLocation(distanceFromSupportPct),
    catalystScore: scoreCatalyst(catalystStrength),
    rangeScore: scoreRange(premarketRangePct),
    floatScore: scoreFloat(floatShares),

    extensionPenalty: penaltyExtension({
      extensionFromSupportPct,
      supportExists,
      gapPct,
    }),
    spreadPenalty: penaltySpread(spreadPct, hasBidAsk),
    weakTapePenalty: penaltyWeakTape({
      priceVelocityPct,
      volumeDelta,
      lowerHigh,
      priceBelowSupport,
    }),
    dirtyCatalystPenalty: penaltyDirtyCatalyst(dirtyCatalystRisk),
    staleDataPenalty: penaltyStaleData({
      isDataStale: input.isDataStale,
      isDelayed: input.isDelayed,
      priceVelocityPct,
      volumeDelta,
    }),
  };

  const positive =
    scores.attentionScore +
    scores.volumePressureScore +
    scores.pricePressureScore +
    scores.structureScore +
    scores.liquidityScore +
    scores.rawSpreadBonus +
    scores.locationScore +
    scores.catalystScore +
    scores.rangeScore +
    scores.floatScore;

  const negative =
    scores.extensionPenalty +
    scores.spreadPenalty +
    scores.weakTapePenalty +
    scores.dirtyCatalystPenalty +
    scores.staleDataPenalty;

  const hardRejected = hardRejectReasons.length > 0 || negative >= 99;
  const runnerPressureScore = hardRejected ? 0 : clamp(Math.round(positive - negative));

  const verdict = getVerdict(runnerPressureScore, hardRejected);
  const invalidationLevel = nearestSupport ?? recentLow ?? dayLow ?? null;

  const permissionStatus = getPermissionStatus({
    score: runnerPressureScore,
    hardRejected,
    supportExists,
    priceAboveSupport,
    distanceFromSupportPct,
    volumeDelta,
    priceVelocityPct,
    spreadPct,
    hasBidAsk,
    higherHigh,
    reclaimingRecentBreakoutLevel,
    invalidationLevel,
  });

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (gapPct !== null && gapPct >= 10) reasons.push(`Gap attention: ${round(gapPct, 2)}%.`);
  if (volumeDelta !== null && volumeDelta > 0) reasons.push(`Volume increased by ${Math.round(volumeDelta).toLocaleString()}.`);
  if (priceVelocityPct !== null && priceVelocityPct > 0) reasons.push(`Price velocity positive: ${round(priceVelocityPct, 2)}%.`);
  if (higherHigh) reasons.push("Higher high detected.");
  if (higherLow) reasons.push("Higher low detected.");
  if (priceAboveVWAP) reasons.push("Price above VWAP.");
  if (reclaimingRecentBreakoutLevel) reasons.push("Reclaiming recent breakout level.");
  if (catalystStrength !== "NONE") reasons.push(`Catalyst: ${catalystLabel ?? catalystStrength}.`);
  if (nearestSupport !== null) reasons.push(`Support/invalidation near ${nearestSupport.toFixed(4)}.`);

  if (!hasBidAsk) warnings.push("Bid/ask unavailable. Liquidity is proxy-only.");
  if (spreadPct !== null && spreadPct > 2) warnings.push(`Spread risk: ${round(spreadPct, 2)}%.`);
  if (distanceFromSupportPct !== null && distanceFromSupportPct > 5) warnings.push("Price is far from support.");
  if (scores.extensionPenalty > 0) warnings.push("Extension penalty applied.");
  if (scores.weakTapePenalty > 0) warnings.push("Weak tape penalty applied.");
  if (dirtyCatalystRisk !== "NONE") warnings.push(`Dirty catalyst risk: ${dirtyCatalystRisk}.`);
  if (input.isDelayed) warnings.push("Delayed test only.");
  if (hardRejected) warnings.push(...hardRejectReasons);

  return {
    symbol,
    price: round(currentPrice, 6),
    previousClose: round(previousClose, 6),
    currentVolume: currentVolume === null ? null : Math.round(currentVolume),

    bid: round(bid, 6),
    ask: round(ask, 6),

    nearestSupport: round(nearestSupport, 6),
    invalidationLevel: round(invalidationLevel, 6),

    floatShares: floatShares === null ? null : Math.round(floatShares),

    catalystLabel,
    catalystStrength,
    dirtyCatalystRisk,

    calculations,
    scores,

    runnerPressureScore,
    verdict,
    permissionStatus,

    liquidityConfidence: inferLiquidityConfidence(hasBidAsk),
    dataFreshness: inferFreshness(input.isDataStale, input.isDelayed),

    hardRejected,
    hardRejectReasons,

    reasons,
    warnings,
    proofNeeded: buildProofNeeded({
      nearestSupport,
      spreadPct,
      hasBidAsk,
      priceVelocityPct,
      volumeDelta,
      higherHigh,
      higherLow,
      reclaimingRecentBreakoutLevel,
      priceAboveVWAP,
    }),
  };
}
