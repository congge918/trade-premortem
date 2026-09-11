import { sha256, canonicalJson } from "./crypto.mjs";

const SYMBOLS = ["RAAPLUSDT", "RNVDAUSDT", "RGOOGLUSDT", "RCOINUSDT"];
const basePrices = { RAAPLUSDT: 231, RNVDAUSDT: 223, RGOOGLUSDT: 252, RCOINUSDT: 183 };
const clockAt = "2026-09-10T10:00:00.000Z";

function seededRandom(seedText) {
  let seed = [...seedText].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}

function makeCandles(symbol, count = 280) {
  const random = seededRandom(symbol);
  const end = Date.parse(clockAt) - 60 * 60 * 1000;
  let close = basePrices[symbol];
  const candles = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const wave = Math.sin(index / 11) * 0.0015;
    const change = (random() - 0.5) * 0.009 + wave;
    const open = close;
    close = Math.max(1, open * (1 + change));
    candles.push({
      ts: end - index * 60 * 60 * 1000,
      open,
      high: Math.max(open, close) * 1.0018,
      low: Math.min(open, close) * 0.9982,
      close,
      volume: 20_000 + Math.round(random() * 80_000)
    });
  }
  return candles;
}

function evidenceFor(symbol, category, capturedAt) {
  const base = `https://api.bitget.com/api/v3`;
  const items = [
    ["instrument", "Reality 交易产品状态", `${base}/market/instruments?category=SPOT&symbol=${symbol}`],
    ["ticker", "rToken 实时行情", `${base}/market/tickers?category=SPOT&symbol=${symbol}`],
    ["candles", "rToken 1 小时 K 线", `${base}/market/candles?category=SPOT&symbol=${symbol}&interval=1H&type=market`],
    ["market_state", "美股交易时段", `${base}/reality/market/states`],
    ["market_calendar", "美股休市日历", `${base}/reality/market/calendar`]
  ].map(([id, title, sourceUrl]) => ({
    id,
    title,
    source: "Bitget UTA v3",
    sourceUrl,
    observedAt: capturedAt,
    effectiveAt: capturedAt,
    freshness: "REPLAY",
    kind: "FACT"
  }));
  if (category === "stale") items[1].effectiveAt = null;
  return items;
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
  const candles = makeCandles(symbol);
  const referenceClose = candles.at(-2).close;
  const capturedAt = category === "stale" ? "2026-09-10T09:48:00.000Z" : "2026-09-10T09:59:00.000Z";
  const gapMultiplier = category === "gap" ? 1.075 : 1.002;
  const tickerPrice = referenceClose * gapMultiplier;
  const event = category === "event"
    ? { label: "财报更新窗口", type: "EARNINGS", severity: "HIGH", hoursUntil: 3 }
    : null;
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
    market: {
      mode: "REPLAY",
      ticker: { lastPrice: tickerPrice, capturedAt },
      candles,
      referenceClose,
      session: category === "baseline" ? "REGULAR" : "OVERNIGHT",
      event
    },
    evidence: evidenceFor(symbol, category, capturedAt)
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
  return publicReplays.map(({ id, title, category, symbol, snapshotHash, proposal }) => ({
    id,
    title,
    category,
    symbol,
    snapshotHash,
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
