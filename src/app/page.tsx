// src/app/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import type { PressureEngineOutput, RankedPressureResponse } from "@/lib/pressure/types";

function verdictClass(verdict: string) {
  if (verdict === "PRIORITY_RUNNER_WATCH") return "bg-emerald-400/15 text-emerald-300 border-emerald-400/30";
  if (verdict === "RUNNER_CANDIDATE") return "bg-lime-400/15 text-lime-300 border-lime-400/30";
  if (verdict === "PRESSURE_BUILDING") return "bg-yellow-400/15 text-yellow-300 border-yellow-400/30";
  if (verdict === "WATCH_ONLY") return "bg-sky-400/15 text-sky-300 border-sky-400/30";
  return "bg-red-400/15 text-red-300 border-red-400/30";
}

function permissionClass(status: string) {
  if (status === "PERMISSION_READY") return "bg-emerald-500 text-black";
  if (status === "NEED_PROOF") return "bg-yellow-400 text-black";
  return "bg-zinc-700 text-zinc-200";
}

function formatNumber(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value < 1) return value.toFixed(4);
  return value.toFixed(2);
}

function StatCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/30">
      <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">{props.label}</div>
      <div className="mt-2 text-2xl font-black text-white">{props.value}</div>
      {props.sub ? <div className="mt-1 text-xs text-zinc-500">{props.sub}</div> : null}
    </div>
  );
}

function CandidateCard({ item, rank }: { item: PressureEngineOutput; rank: number }) {
  return (
    <div className="group rounded-3xl border border-white/10 bg-zinc-950/80 p-4 shadow-2xl shadow-black/40 transition hover:border-white/20 hover:bg-zinc-900/90">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-black">
              {rank}
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-white">{item.symbol}</div>
              <div className="text-xs text-zinc-500">
                Price ${formatPrice(item.price)} · Gap {formatNumber(item.calculations.gapPct, 2)}%
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-4xl font-black text-white">{item.runnerPressureScore}</div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Score</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${verdictClass(item.verdict)}`}>
          {item.verdict}
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${permissionClass(item.permissionStatus)}`}>
          {item.permissionStatus}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
          {item.liquidityConfidence}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
          {item.dataFreshness}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-black/30 p-3">
          <div className="text-xs text-zinc-500">Volume Δ</div>
          <div className="text-lg font-black text-white">
            {item.calculations.volumeDelta === null
              ? "—"
              : item.calculations.volumeDelta.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl bg-black/30 p-3">
          <div className="text-xs text-zinc-500">Price Velocity</div>
          <div className="text-lg font-black text-white">
            {formatNumber(item.calculations.priceVelocityPct, 2)}%
          </div>
        </div>
        <div className="rounded-2xl bg-black/30 p-3">
          <div className="text-xs text-zinc-500">Support</div>
          <div className="text-lg font-black text-white">
            ${formatPrice(item.nearestSupport)}
          </div>
        </div>
        <div className="rounded-2xl bg-black/30 p-3">
          <div className="text-xs text-zinc-500">Invalidation</div>
          <div className="text-lg font-black text-white">
            ${formatPrice(item.invalidationLevel)}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] p-3">
        <div className="text-xs uppercase tracking-[0.18em] text-yellow-300/80">Proof needed</div>
        <div className="mt-1 text-sm font-semibold text-yellow-100">{item.proofNeeded}</div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Reasons</div>
          <ul className="space-y-1 text-sm text-zinc-300">
            {item.reasons.length ? (
              item.reasons.slice(0, 5).map((reason, index) => <li key={index}>• {reason}</li>)
            ) : (
              <li>• No strong reason yet.</li>
            )}
          </ul>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">Warnings</div>
          <ul className="space-y-1 text-sm text-zinc-400">
            {item.warnings.length ? (
              item.warnings.slice(0, 5).map((warning, index) => <li key={index}>• {warning}</li>)
            ) : (
              <li>• No major warning detected.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<RankedPressureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);

  async function scan() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/pressure", {
        cache: "no-store",
      });

      const json = (await response.json()) as RankedPressureResponse;

      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Pressure scan failed.");
      }

      setData(json);
      setLastScan(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message ?? "Unknown scanner error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    scan();
  }, []);

  useEffect(() => {
    if (!autoScan) return;

    const interval = window.setInterval(() => {
      scan();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [autoScan]);

  const topResults = useMemo(() => {
    return data?.results?.slice(0, 15) ?? [];
  }, [data]);

  const priorityCount = useMemo(() => {
    return data?.results?.filter((item) => item.verdict === "PRIORITY_RUNNER_WATCH").length ?? 0;
  }, [data]);

  const runnerCount = useMemo(() => {
    return data?.results?.filter((item) => item.verdict === "RUNNER_CANDIDATE").length ?? 0;
  }, [data]);

  const pressureCount = useMemo(() => {
    return data?.results?.filter((item) => item.verdict === "PRESSURE_BUILDING").length ?? 0;
  }, [data]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#27272a_0,#09090b_38%,#000_100%)] px-4 py-6 text-white md:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/40 md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
                Pressure Engine V1
              </div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                Gainer-to-Runner Scanner
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
                Uses the gainers list as the pond, then ranks pressure with volume velocity, price structure,
                liquidity proxy, catalyst, support location, extension risk, and proof needed.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={scan}
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black shadow-xl shadow-black/30 transition hover:scale-[1.02] disabled:opacity-50"
              >
                {loading ? "Scanning..." : "New Scan"}
              </button>

              <button
                onClick={() => setAutoScan((value) => !value)}
                className={`rounded-2xl px-5 py-3 text-sm font-black shadow-xl shadow-black/30 transition hover:scale-[1.02] ${
                  autoScan
                    ? "bg-emerald-400 text-black"
                    : "border border-white/10 bg-white/[0.06] text-white"
                }`}
              >
                {autoScan ? "5 Sec Watch ON" : "5 Sec Watch OFF"}
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <StatCard label="Universe" value={String(data?.count ?? "—")} sub="FMP gainers filtered" />
            <StatCard label="Priority" value={String(priorityCount)} sub="90+ score" />
            <StatCard label="Runner" value={String(runnerCount)} sub="80–89 score" />
            <StatCard label="Pressure" value={String(pressureCount)} sub="65–79 score" />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
            <div>Data mode: {data?.dataMode ?? "FMP_ONLY"}</div>
            <div>Last scan: {lastScan ?? "—"}</div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4">
          {topResults.length ? (
            topResults.map((item, index) => (
              <CandidateCard key={`${item.symbol}-${index}`} item={item} rank={index + 1} />
            ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-zinc-400">
              No results yet. Hit New Scan.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
