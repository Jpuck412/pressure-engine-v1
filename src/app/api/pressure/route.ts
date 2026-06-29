// src/app/api/pressure/route.ts

import { NextResponse } from "next/server";
import { calculatePressure } from "@/lib/pressure/formula";
import {
  getSecondsBetweenScans,
  getSnapshotContext,
  saveSnapshot,
} from "@/lib/pressure/snapshotStore";
import type {
  CatalystStrength,
  DirtyCatalystRisk,
  Exchange,
  PressureEngineInput,
  RankedPressureResponse,
  SymbolType,
} from "@/lib/pressure/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FmpGainer = {
  symbol?: string;
  ticker?: string;
  name?: string;
  companyName?: string;
  price?: number;
  changesPercentage?: number;
  change?: number;
  volume?: number;
};

type FmpQuote = {
  symbol?: string;
  name?: string;
  price?: number;
  changesPercentage?: number;
  change?: number;
  dayLow?: number;
  dayHigh?: number;
  yearHigh?: number;
  yearLow?: number;
  marketCap?: number;
  priceAvg50?: number;
  priceAvg200?: number;
  exchange?: string;
  volume?: number;
  avgVolume?: number;
  open?: number;
  previousClose?: number;
  eps?: number;
  pe?: number;
  earningsAnnouncement?: string;
  sharesOutstanding?: number;
  timestamp?: number;
};

type FmpNewsItem = {
  symbol?: string;
  publishedDate?: string;
  title?: string;
  text?: string;
  site?: string;
  url?: string;
};

function getApiKey() {
  return process.env.FMP_API_KEY;
}

function cleanSymbol(value: unknown): string | null {
  if (!value) return null;
  const symbol = String(value).trim().toUpperCase();
  if (!symbol) return null;
  return symbol;
}

function inferSymbolType(symbol: string): SymbolType {
  const s = symbol.toUpperCase();

  if (s.includes(".WS") || s.endsWith("WS") || s.endsWith("W")) return "WARRANT";
  if (s.includes(".U") || s.endsWith("U")) return "UNIT";
  if (s.includes(".P") || s.includes("-P") || s.includes("PR")) return "PREFERRED";
  if (s.includes("ETF")) return "ETF";

  return "COMMON";
}

function inferExchange(exchange?: string): Exchange {
  const e = String(exchange ?? "").toUpperCase();

  if (e.includes("NASDAQ")) return "NASDAQ";
  if (e.includes("NYSE")) return "NYSE";
  if (e.includes("AMEX")) return "AMEX";
  if (e.includes("OTC")) return "OTC";

  return "UNKNOWN";
}

function estimateSupport(quote: FmpQuote): number | null {
  const price = Number(quote.price);
  const previousClose = Number(quote.previousClose);
  const dayLow = Number(quote.dayLow);
  const open = Number(quote.open);

  const candidates = [dayLow, previousClose, open]
    .filter((value) => Number.isFinite(value) && value > 0 && value <= price)
    .sort((a, b) => b - a);

  return candidates[0] ?? null;
}

function classifyNews(news?: FmpNewsItem): {
  catalystStrength: CatalystStrength;
  dirtyCatalystRisk: DirtyCatalystRisk;
  catalystLabel: string | null;
} {
  if (!news?.title) {
    return {
      catalystStrength: "NONE",
      dirtyCatalystRisk: "NONE",
      catalystLabel: null,
    };
  }

  const title = news.title;
  const lower = `${news.title} ${news.text ?? ""}`.toLowerCase();

  let catalystStrength: CatalystStrength = "MINOR";
  let dirtyCatalystRisk: DirtyCatalystRisk = "NONE";

  const majorWords = [
    "fda",
    "clinical",
    "phase 2",
    "phase ii",
    "phase 3",
    "phase iii",
    "contract",
    "merger",
    "acquisition",
    "buyout",
    "strategic investment",
    "partnership",
    "earnings",
    "guidance",
    "debt",
    "uplisting",
    "approval",
    "patent",
    "positive data",
  ];

  const dirtyWords = [
    "offering",
    "registered direct",
    "atm",
    "at-the-market",
    "reverse split",
    "delisting",
    "nasdaq notice",
    "warrant",
    "convertible",
    "dilution",
  ];

  if (majorWords.some((word) => lower.includes(word))) {
    catalystStrength = "MAJOR";
  }

  if (lower.includes("offering") || lower.includes("registered direct")) {
    dirtyCatalystRisk = "ACTIVE_OFFERING";
  } else if (lower.includes("atm") || lower.includes("at-the-market")) {
    dirtyCatalystRisk = "ATM_FILING";
  } else if (lower.includes("reverse split")) {
    dirtyCatalystRisk = "REVERSE_SPLIT_ONLY";
  } else if (lower.includes("delisting") || lower.includes("nasdaq notice")) {
    dirtyCatalystRisk = "DELISTING_WARNING";
  } else if (dirtyWords.some((word) => lower.includes(word))) {
    dirtyCatalystRisk = "DILUTION_HEAVY_FILING";
  }

  return {
    catalystStrength,
    dirtyCatalystRisk,
    catalystLabel: title,
  };
}

async function fetchFmpGainers(apiKey: string) {
  const url = `https://financialmodelingprep.com/api/v3/stock_market/gainers?apikey=${apiKey}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`FMP gainers error: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as FmpGainer[];
}

async function fetchFmpQuotes(apiKey: string, symbols: string[]) {
  if (!symbols.length) return [];

  const joined = symbols.join(",");
  const url = `https://financialmodelingprep.com/api/v3/quote/${joined}?apikey=${apiKey}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`FMP quote error: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as FmpQuote[];
}

async function fetchFmpNews(apiKey: string, symbols: string[]) {
  if (!symbols.length) return new Map<string, FmpNewsItem>();

  const joined = symbols.slice(0, 50).join(",");
  const url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${joined}&limit=100&apikey=${apiKey}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return new Map<string, FmpNewsItem>();
  }

  const items = (await response.json()) as FmpNewsItem[];
  const map = new Map<string, FmpNewsItem>();

  for (const item of items) {
    const symbol = cleanSymbol(item.symbol);
    if (!symbol) continue;
    if (!map.has(symbol)) map.set(symbol, item);
  }

  return map;
}

export async function GET() {
  try {
    const apiKey = getApiKey();

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing FMP_API_KEY environment variable.",
        },
        { status: 500 }
      );
    }

    const gainers = await fetchFmpGainers(apiKey);

    const symbols = gainers
      .map((gainer) => cleanSymbol(gainer.symbol ?? gainer.ticker))
      .filter((symbol): symbol is string => Boolean(symbol))
      .filter((symbol) => inferSymbolType(symbol) === "COMMON")
      .slice(0, 80);

    const [quotes, newsMap] = await Promise.all([
      fetchFmpQuotes(apiKey, symbols),
      fetchFmpNews(apiKey, symbols),
    ]);

    const quoteMap = new Map<string, FmpQuote>();

    for (const quote of quotes) {
      const symbol = cleanSymbol(quote.symbol);
      if (symbol) quoteMap.set(symbol, quote);
    }

    const results = symbols.map((symbol) => {
      const quote = quoteMap.get(symbol);
      const news = newsMap.get(symbol);
      const catalyst = classifyNews(news);

      const context = getSnapshotContext(symbol);
      const secondsBetweenScans = getSecondsBetweenScans(symbol);

      const price = quote?.price ?? null;
      const volume = quote?.volume ?? null;

      const previousRecentHigh = context.previousSnapshotPrice ?? null;
      const previousRecentLow = context.previousSnapshotPrice ?? null;

      const nearestSupport = quote ? estimateSupport(quote) : null;

      const input: PressureEngineInput = {
        symbol,
        dataMode: "FMP_ONLY",
        exchange: inferExchange(quote?.exchange),
        symbolType: inferSymbolType(symbol),

        currentPrice: price,
        previousClose: quote?.previousClose ?? null,
        currentVolume: volume,

        previousSnapshotPrice: context.previousSnapshotPrice,
        previousSnapshotVolume: context.previousSnapshotVolume,
        secondsBetweenScans,

        dayHigh: quote?.dayHigh ?? null,
        dayLow: quote?.dayLow ?? null,

        premarketHigh: quote?.dayHigh ?? null,
        premarketLow: quote?.dayLow ?? null,

        recentHigh: quote?.dayHigh ?? price,
        recentLow: quote?.dayLow ?? price,
        previousRecentHigh,
        previousRecentLow,

        vwap: null,
        recentBreakoutLevel: quote?.dayHigh ?? null,
        nearestSupport,

        bid: null,
        ask: null,

        floatShares: quote?.sharesOutstanding ?? null,

        catalystStrength: catalyst.catalystStrength,
        dirtyCatalystRisk: catalyst.dirtyCatalystRisk,
        catalystLabel: catalyst.catalystLabel,

        quoteTimestamp: quote?.timestamp ? String(quote.timestamp) : null,
        isDataStale: false,
        isDelayed: false,

        volumeDeltas: context.volumeDeltas,
      };

      const output = calculatePressure(input);

      saveSnapshot(symbol, price, volume);

      return output;
    });

    const ranked = results.sort((a, b) => b.runnerPressureScore - a.runnerPressureScore);

    const response: RankedPressureResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      dataMode: "FMP_ONLY",
      count: ranked.length,
      results: ranked,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        dataMode: "FMP_ONLY",
        count: 0,
        results: [],
        error: error?.message ?? "Unknown pressure route error.",
      },
      { status: 500 }
    );
  }
}
