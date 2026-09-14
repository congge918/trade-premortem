import { readFileSync } from "node:fs";
import { sha256, canonicalJson } from "./crypto.mjs";

const snapshotBundle = JSON.parse(
  readFileSync(new URL("../data/replay-snapshots.json", import.meta.url), "utf8")
);
const snapshots = new Map(snapshotBundle.snapshots.map((item) => [item.symbol, item]));
const SYMBOLS = [...snapshots.keys()];
const scenarioSourceUrl = "https://github.com/congge918/trade-premortem/blob/main/src/replays.mjs";

function scenarioEvidence(id, title, summary, observedAt, effectiveAt = observedAt) {
  return {
    id,
    title,
    source: "TradePremortem scenario fixture",
    sourceUrl: scenarioSourceUrl,
    observedAt,
    effectiveAt,
    freshness: "SCENARIO",
    kind: "INFERENCE",
    summary
  };
}

function portfolioFor(symbol, category) {
  if (category === "concentration") {
    if (symbol === "RCOINUSDT") {
      return [
        { symbol: "RCOINUSDT", notionalUsdt: 900 },
        { symbol: "RAAPLUSDT", notionalUsdt: 300 },
        { symbol: "USDT", notionalUsdt: 800 }
      ];
    }
    return [
      { symbol: "RAAPLUSDT", notionalUsdt: 700 },
      { symbol: "RNVDAUSDT", notionalUsdt: 500 },
      { symbol: "RGOOGLUSDT", notionalUsdt: 600 },
      { symbol: "USDT", notionalUsdt: 1200 }
    ];
  }
  return [
    { symbol: "RAAPLUSDT", notionalUsdt: 300 },
    { symbol: "RCOINUSDT", notionalUsdt: 250 },
    { symbol: "USDT", notionalUsdt: 2450 }
  ];
}

function titleFor(symbol, category) {
  const label = symbol.replace(/^R|USDT$/g, "");
  const titles = {
    gap: `${label} 休市追价：偏离是否已经失真？`,
    event: `${label} 事件窗口：论点能否承受财报冲击？`,
    concentration: `${label} 加仓：单笔合理但组合是否过载？`,
    stale: `${label} 旧行情：证据过期时必须拒答`,
    baseline: `${label} 常规盘：预算内的受限通过案例`
  };
  return titles[category];
}

export function buildReplay(symbol, category = "baseline") {
  const snapshot = snapshots.get(symbol);
  if (!snapshot) throw new TypeError("snapshot is not in the demo rToken set");
  const clockAt = snapshot.capturedAt;
  const market = structuredClone(snapshot.market);
  market.mode = "REPLAY";
  const evidence = snapshot.evidence.map((item) => ({ ...structuredClone(item), freshness: "REPLAY" }));
  const injections = [];

  if (category === "baseline" && market.session !== "REGULAR") {
    market.session = "REGULAR";
    injections.push(scenarioEvidence(
      "scenario_regular_session",
      "演示条件：常规交易时段",
      "仅将交易时段设为 REGULAR，用于验证预算内受限通过；价格和 K 线保持采集快照。",
      clockAt
    ));
  }
  if (category === "gap") {
    const capturedPrice = market.ticker.lastPrice;
    market.ticker.lastPrice = market.referenceClose * 1.075;
    injections.push(scenarioEvidence(
      "scenario_gap",
      "故障注入：休市价格偏离",
      `采集价 ${capturedPrice} 被替换为参考收盘的 107.5%，仅用于压力测试。`,
      clockAt
    ));
  }
  if (category === "event") {
    const eventAt = new Date(Date.parse(clockAt) + 3 * 3_600_000).toISOString();
    market.event = {
      label: "演示假设：3 小时后进入财报更新窗口",
      type: "EARNINGS",
      severity: "HIGH",
      hoursUntil: 3,
      eventAt
    };
    injections.push(scenarioEvidence(
      "scenario_event",
      "演示假设：财报事件窗口",
      "该事件是明确标记的情景假设，不代表 Bitget 返回了实际公司事件。",
      clockAt,
      eventAt
    ));
  }
  if (category === "stale") {
    const staleAt = new Date(Date.parse(clockAt) - 12 * 60_000).toISOString();
    market.ticker.capturedAt = staleAt;
    const tickerEvidence = evidence.find((item) => item.id === "ticker");
    if (tickerEvidence) tickerEvidence.effectiveAt = null;
    injections.push(scenarioEvidence(
      "scenario_stale",
      "故障注入：过期且缺失有效时间",
      "将 ticker 调整为 12 分钟前，并移除对应证据的 effectiveAt，用于验证 fail-closed。",
      clockAt
    ));
  }

  const proposal = {
    symbol,
    side: "BUY",
    notionalUsdt: category === "baseline" ? 240 : 1000,
    horizonHours: category === "event" ? 4 : 24,
    riskBudgetUsdt: category === "baseline" ? 30 : 25,
    thesis: category === "baseline"
      ? "常规交易时段内价格稳定，希望在明确亏损预算下建立小额观察仓。"
      : "美股常规盘之外出现新信息，计划立即建立仓位捕捉可能的价格重估。",
    portfolio: portfolioFor(symbol, category)
  };
  const id = `${symbol.toLowerCase()}-${category}`;
  const output = {
    id,
    title: titleFor(symbol, category),
    category,
    symbol,
    clockAt,
    proposal,
    market,
    evidence: [...evidence, ...injections],
    baseSnapshotHash: snapshot.normalizedSourceHash,
    scenarioInjections: injections.map((item) => item.id)
  };
  return { ...output, snapshotHash: sha256(canonicalJson(output)) };
}

const benchmarkReplays = SYMBOLS.flatMap((symbol) =>
  ["gap", "event", "concentration", "stale"].map((category) => buildReplay(symbol, category))
);

const publicReplays = [
  buildReplay("RNVDAUSDT", "concentration"),
  buildReplay("RNVDAUSDT", "gap"),
  buildReplay("RAAPLUSDT", "baseline"),
  buildReplay("RGOOGLUSDT", "stale"),
  buildReplay("RCOINUSDT", "event")
];

export function listPublicReplays() {
  return publicReplays.map(({ id, title, category, symbol, snapshotHash, baseSnapshotHash, scenarioInjections, proposal }) => ({
    id,
    title,
    category,
    symbol,
    snapshotHash,
    baseSnapshotHash,
    scenarioInjections,
    proposal
  }));
}

export function getReplay(id) {
  const all = [...publicReplays, ...benchmarkReplays];
  return all.find((item) => item.id === id) || null;
}

export function getBenchmarkReplays() {
  return benchmarkReplays.map((item) => structuredClone(item));
}
