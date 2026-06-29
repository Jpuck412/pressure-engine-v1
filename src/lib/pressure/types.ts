// src/lib/pressure/types.ts

export type DataMode = "FMP_ONLY" | "FMP_PLUS_TRADIER";

export type LiquidityConfidence =
  | "REAL_BID_ASK"
  | "PROXY_ONLY"
  | "UNKNOWN";

export type DataFreshness =
  | "LIVE_OR_RECENT"
  | "STALE"
  | "DELAYED_TEST_ONLY"
  | "UNKNOWN";

export type PressureVerdict =
  | "REJECT"
  | "WATCH_ONLY"
  | "PRESSURE_BUILDING"
  | "RUNNER_CANDIDATE"
  | "PRIORITY_RUNNER_WATCH";

export type PermissionStatus =
  | "NO_PERMISSION"
  | "NEED_PROOF"
  | "PERMISSION_READY";

export type CatalystStrength =
  | "NONE"
  | "ABNORMAL_VOLUME_ONLY"
  | "MINOR"
  | "MAJOR";

export type DirtyCatalystRisk =
  | "NONE"
  | "ACTIVE_OFFERING"
  | "ATM_FILING"
  | "REVERSE_SPLIT_ONLY"
  | "DELISTING_WARNING"
  | "DILUTION_HEAVY_FILING";

export type Exchange =
  | "NASDAQ"
  | "NYSE"
  | "AMEX"
  | "OTC"
  | "UNKNOWN";

export type SymbolType =
  | "COMMON"
  | "ETF"
  | "WARRANT"
  | "UNIT"
  | "PREFERRED"
  | "UNKNOWN";

export type NumericInput = number | string | null | undefined;

export type PressureEngineInput = {
  symbol: string;

  dataMode?: DataMode;
  exchange?: Exchange;
  symbolType?: SymbolType;

  currentPrice: NumericInput;
  previousClose: NumericInput;
  currentVolume: NumericInput;

  previousSnapshotPrice?: NumericInput;
  previousSnapshotVolume?: NumericInput;
  secondsBetweenScans?: NumericInput;

  dayHigh?: NumericInput;
  dayLow?: NumericInput;

  premarketHigh?: NumericInput;
  premarketLow?: NumericInput;

  recentHigh?: NumericInput;
  recentLow?: NumericInput;
  previousRecentHigh?: NumericInput;
  previousRecentLow?: NumericInput;

  vwap?: NumericInput;
  recentBreakoutLevel?: NumericInput;
  nearestSupport?: NumericInput;

  bid?: NumericInput;
  ask?: NumericInput;

  floatShares?: NumericInput;

  catalystStrength?: CatalystStrength;
  dirtyCatalystRisk?: DirtyCatalystRisk;
  catalystLabel?: string | null;

  quoteTimestamp?: string | null;
  isDataStale?: boolean;
  isDelayed?: boolean;

  volumeDeltas?: number[];
};

export type PressureScoreBreakdown = {
  attentionScore: number;
  volumePressureScore: number;
  volumePersistenceBonus: number;
  pricePressureScore: number;
  structureScore: number;
  liquidityScore: number;
  rawSpreadBonus: number;
  locationScore: number;
  catalystScore: number;
  rangeScore: number;
  floatScore: number;

  extensionPenalty: number;
  spreadPenalty: number;
  weakTapePenalty: number;
  dirtyCatalystPenalty: number;
  staleDataPenalty: number;
};

export type PressureEngineCalculations = {
  gapPct: number | null;
  priceVelocityPct: number | null;
  volumeDelta: number | null;
  volumePerSecond: number | null;
  volumeVelocityPct: number | null;
  dollarVolume: number | null;
  premarketRangePct: number | null;

  higherHigh: boolean;
  higherLow: boolean;
  lower
