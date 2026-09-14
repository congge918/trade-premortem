import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../src/crypto.mjs";

const symbols = ["RAAPLUSDT", "RNVDAUSDT", "RGOOGLUSDT", "RCOINUSDT"];
const outputPath = fileURLToPath(new URL("../data/replay-snapshots.json", import.meta.url));
const snapshots = [];
const nativeFetch = globalThis.fetch;
const execFileAsync = promisify(execFile);

globalThis.fetch = async (url, options) => {
  try {
    return await nativeFetch(url, options);
  } catch (error) {
    if (process.platform !== "win32") throw error;
    const { stdout } = await execFileAsync("curl.exe", [
      "--silent",
      "--show-error",
      "--fail-with-body",
      "--max-time",
      "30",
      String(url)
    ], { maxBuffer: 10 * 1024 * 1024 });
    return new Response(stdout, { status: 200, headers: { "Content-Type": "application/json" } });
  }
};

const { loadLiveMarket } = await import("../src/bitget.mjs");

for (const symbol of symbols) {
  const context = await loadLiveMarket(symbol);
  const market = {
    mode: "REPLAY",
    ticker: context.market.ticker,
    candles: context.market.candles.slice(-400),
    referenceClose: context.market.referenceClose,
    session: context.market.session,
    event: context.market.event,
    company: context.market.company,
    valuation: context.market.valuation,
    forecast: context.market.forecast,
    suspension: context.market.suspension
  };
  const evidence = context.evidence.map((item) => ({ ...item, freshness: "REPLAY" }));
  const normalizedSourceHash = sha256(canonicalJson({ symbol, market, evidence }));
  snapshots.push({
    symbol,
    capturedAt: context.clockAt,
    normalizedSourceHash,
    market,
    evidence
  });
  console.log(`${symbol}: ${market.candles.length} candles · ${evidence.length} evidence items · ${normalizedSourceHash.slice(0, 12)}`);
}

await mkdir(fileURLToPath(new URL("../data/", import.meta.url)), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), snapshots }, null, 2)}\n`, "utf8");
console.log(`Saved ${snapshots.length} normalized Bitget snapshots to ${outputPath}`);
