// src/app/api/gainers/route.ts

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FmpGainer = {
  symbol?: string;
  name?: string;
  price?: number;
  change?: number;
  changesPercentage?: number;
  changePercentage?: number;
  volume?: number;
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

    const url = `https://financialmodelingprep.com/stable/biggest-gainers?apikey=${apiKey}`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();

      return NextResponse.json(
        {
          ok: false,
          error: `FMP stable gainers error: ${response.status}`,
          detail: text,
        },
        { status: response.status }
      );
    }

    const raw = (await response.json()) as FmpGainer[];

    const gainers = raw
      .map((item) => {
        const symbol = cleanSymbol(item.symbol);

        if (!symbol) return null;

        return {
          symbol,
          name: item.name ?? null,
          price: item.price ?? null,
          changesPercentage:
            item.changesPercentage ?? item.changePercentage ?? null,
          change: item.change ?? null,
          volume: item.volume ?? null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      count: gainers.length,
      gainers,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Unknown gainers route error.",
      },
      { status: 500 }
    );
  }
}
