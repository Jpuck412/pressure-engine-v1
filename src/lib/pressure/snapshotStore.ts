// src/lib/pressure/snapshotStore.ts

import type { SnapshotRecord } from "./types";

type SnapshotHistory = SnapshotRecord[];

declare global {
  // eslint-disable-next-line no-var
  var __PRESSURE_ENGINE_SNAPSHOTS__: Map<string, SnapshotHistory> | undefined;
}

const store =
  globalThis.__PRESSURE_ENGINE_SNAPSHOTS__ ??
  new Map<string, SnapshotHistory>();

globalThis.__PRESSURE_ENGINE_SNAPSHOTS__ = store;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getSnapshotHistory(symbol: string): SnapshotHistory {
  return store.get(symbol.toUpperCase()) ?? [];
}

export function getLatestSnapshot(symbol: string): SnapshotRecord | null {
  const history = getSnapshotHistory(symbol);
  return history.length ? history[history.length - 1] : null;
}

export function getSnapshotContext(symbol: string) {
  const history = getSnapshotHistory(symbol);
  const latest = history.length ? history[history.length - 1] : null;

  const volumeDeltas: number[] = [];

  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1];
    const curr = history[i];

    if (prev.volume !== null && curr.volume !== null) {
      volumeDeltas.push(curr.volume - prev.volume);
    }
  }

  return {
    previousSnapshotPrice: latest?.price ?? null,
    previousSnapshotVolume: latest?.volume ?? null,
    previousSnapshotTimestamp: latest?.timestamp ?? null,
    volumeDeltas,
  };
}

export function saveSnapshot(symbol: string, priceInput: unknown, volumeInput: unknown) {
  const normalizedSymbol = symbol.toUpperCase();
  const price = toNumber(priceInput);
  const volume = toNumber(volumeInput);

  const record: SnapshotRecord = {
    symbol: normalizedSymbol,
    price,
    volume,
    timestamp: Date.now(),
  };

  const history = store.get(normalizedSymbol) ?? [];
  history.push(record);

  const trimmed = history.slice(-10);
  store.set(normalizedSymbol, trimmed);

  return record;
}

export function getSecondsBetweenScans(symbol: string): number {
  const latest = getLatestSnapshot(symbol);
  if (!latest) return 5;

  const deltaMs = Date.now() - latest.timestamp;
  const seconds = Math.max(1, Math.round(deltaMs / 1000));

  return seconds;
}

export function clearSnapshots() {
  store.clear();
}
