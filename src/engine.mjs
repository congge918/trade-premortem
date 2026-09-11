import { canonicalJson, sha256 } from "./crypto.mjs";

export const ALLOWED_SYMBOLS = Object.freeze([
  "RAAPLUSDT",
  "RNVDAUSDT",
  "RGOOGLUSDT",
  "RCOINUSDT"
]);

export const LIMITS = Object.freeze({
  minimumWindows: 30,
  maxTickerAgeMs: 5 * 60 * 1000,
  maxConcentration: 0.45,
  offSessionMadLimit: 2.5
});

const sectorBySymbol = Object.freeze({
  RAAPLUSDT: "TECH",
  RNVDAUSDT: "TECH",
  RGOOGLUSDT: "TECH",
  RCOINUSDT: "CRYPTO_FINANCE"
});

function finiteNumber(value, label, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`${label} must be a finite number between ${min} and ${max}`);
  }
  return parsed;
}

export function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

export function validateProposal(input) {
  const symbol = normalizeSymbol(input?.symbol);
  if (!ALLOWED_SYMBOLS.includes(symbol)) throw new TypeError("symbol is not in the demo rToken set");
  const side = String(input?.side || "BUY").toUpperCase();
  if (!new Set(["BUY", "SELL"]).has(side)) throw new TypeError("side must be BUY or SELL");
  const horizonHours = finiteNumber(input?.horizonHours, "horizonHours", { min: 1, max: 24 });
  if (![1, 4, 24].includes(horizonHours)) throw new TypeError("horizonHours must be 1, 4, or 24");
  const notionalUsdt = finiteNumber(input?.notionalUsdt, "notionalUsdt", { min: 10, max: 1_000_000 });
  const riskBudgetUsdt = finiteNumber(input?.riskBudgetUsdt, "riskBudgetUsdt", { min: 1, max: notionalUsdt });
  const thesis = String(input?.thesis || "").trim();
  if (thesis.length < 12 || thesis.length > 800) throw new TypeError("thesis must be 12-800 characters");
  const portfolio = Array.isArray(input?.portfolio)
    ? input.portfolio.map((position) => ({
        symbol: normalizeSymbol(position.symbol),
        notionalUsdt: finiteNumber(position.notionalUsdt, "portfolio notionalUsdt", { min: 0, max: 10_000_000 })
      }))
    : [];
  return { symbol, side, horizonHours, notionalUsdt, riskBudgetUsdt, thesis, portfolio };
}

function percentile(sorted, probability) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function median(values) {
  return percentile([...values].sort((a, b) => a - b), 0.5);
}

export function calculateReturns(candles, horizonHours) {
  const closes = [...candles]
    .map((candle) => ({ ts: Number(candle.ts), close: Number(candle.close) }))
    .filter((candle) => Number.isFinite(candle.ts) && Number.isFinite(candle.close) && candle.close > 0)
    .sort((a, b) => a.ts - b.ts);
  const output = [];
  for (let index = horizonHours; index < closes.length; index += 1) {
    output.push(closes[index].close / closes[index - horizonHours].close - 1);
  }
  return output;
}

function adversePercentiles(returns, side) {
  const sorted = [...returns].sort((a, b) => a - b);
  if (side === "SELL") {
    return { p1: percentile(sorted, 0.99), p5: percentile(sorted, 0.95) };
  }
  return { p1: percentile(sorted, 0.01), p5: percentile(sorted, 0.05) };
}

function lossRate(value, side) {
  return Math.max(0, side === "SELL" ? value : -value);
}

function concentration(proposal) {
  const positions = proposal.portfolio;
  const currentTotal = positions.reduce((sum, item) => sum + item.notionalUsdt, 0);
  const totalAfter = currentTotal + proposal.notionalUsdt;
  const targetAfter = positions
    .filter((item) => item.symbol === proposal.symbol)
    .reduce((sum, item) => sum + item.notionalUsdt, proposal.notionalUsdt);
  const sector = sectorBySymbol[proposal.symbol] || "OTHER";
  const sectorAfter = positions
    .filter((item) => (sectorBySymbol[item.symbol] || "OTHER") === sector)
    .reduce((sum, item) => sum + item.notionalUsdt, proposal.notionalUsdt);
  return {
    target: totalAfter ? targetAfter / totalAfter : 1,
    sector: totalAfter ? sectorAfter / totalAfter : 1,
    totalAfter,
    sectorName: sector
  };
}

function robustDeviation(currentPrice, referenceClose, returns) {
  if (!(currentPrice > 0) || !(referenceClose > 0) || returns.length < LIMITS.minimumWindows) return null;
  const currentReturn = currentPrice / referenceClose - 1;
  const center = median(returns);
  const mad = median(returns.map((value) => Math.abs(value - center)));
  if (!(mad > 0)) return { currentReturn, madScore: 0, median: center, mad };
  return { currentReturn, madScore: Math.abs(currentReturn - center) / mad, median: center, mad };
}

function freshnessState(timestamp, now) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return { ageMs: Infinity, fresh: false };
  const ageMs = Math.max(0, now - parsed);
  return { ageMs, fresh: ageMs <= LIMITS.maxTickerAgeMs };
}

function reason(code, label, detail, severity = "HIGH") {
  return { code, label, detail, severity };
}

export function evaluateStressTest({ proposal: rawProposal, market, evidence = [], clockAt = new Date().toISOString() }) {
  const proposal = validateProposal(rawProposal);
  const now = Date.parse(clockAt);
  if (!Number.isFinite(now)) throw new TypeError("clockAt must be an ISO timestamp");
  const returns = calculateReturns(market?.candles || [], proposal.horizonHours);
  const tickerFreshness = freshnessState(market?.ticker?.capturedAt, now);
  const missingTimestamp = evidence.some((item) => !item.observedAt || !item.effectiveAt);
  const qualityFailures = [];
  if (returns.length < LIMITS.minimumWindows) {
    qualityFailures.push(reason("WINDOWS", "历史窗口不足", `${returns.length} / ${LIMITS.minimumWindows} 个有效窗口`));
  }
  if (!tickerFreshness.fresh) {
    const ageMinutes = Number.isFinite(tickerFreshness.ageMs) ? Math.round(tickerFreshness.ageMs / 60000) : "未知";
    qualityFailures.push(reason("STALE_TICKER", "实时价格已过期", `${ageMinutes} 分钟前，阈值为 5 分钟`));
  }
  if (missingTimestamp) {
    qualityFailures.push(reason("MISSING_TIME", "证据时间戳缺失", "至少一条关键证据无法确认观察时间或有效时间"));
  }

  const portfolio = concentration(proposal);
  const percentiles = returns.length ? adversePercentiles(returns, proposal.side) : { p1: null, p5: null };
  const p1LossRate = percentiles.p1 == null ? null : lossRate(percentiles.p1, proposal.side);
  const p5LossRate = percentiles.p5 == null ? null : lossRate(percentiles.p5, proposal.side);
  const recommendedMaxNotional = p1LossRate > 0 ? proposal.riskBudgetUsdt / p1LossRate : null;
  const stressLossUsdt = p1LossRate == null ? null : proposal.notionalUsdt * p1LossRate;
  const deviation = robustDeviation(
    Number(market?.ticker?.lastPrice),
    Number(market?.referenceClose),
    returns
  );
  const blockers = [];
  if (qualityFailures.length === 0) {
    if (recommendedMaxNotional != null && proposal.notionalUsdt > recommendedMaxNotional) {
      blockers.push(reason(
        "RISK_BUDGET",
        "压力亏损超过预算",
        `P1 压力亏损 ${stressLossUsdt.toFixed(2)} USDT，高于预算 ${proposal.riskBudgetUsdt.toFixed(2)} USDT`
      ));
    }
    if (portfolio.sector > LIMITS.maxConcentration) {
      blockers.push(reason(
        "CONCENTRATION",
        "组合集中度过高",
        `${portfolio.sectorName} 板块占交易后组合的 ${(portfolio.sector * 100).toFixed(1)}%`
      ));
    }
    if (market?.session !== "REGULAR" && deviation?.madScore > LIMITS.offSessionMadLimit) {
      blockers.push(reason(
        "OFF_SESSION_GAP",
        "休市偏离异常",
        `相对常规盘参考收盘偏离为 ${deviation.madScore.toFixed(2)} MAD，阈值为 ${LIMITS.offSessionMadLimit}`
      ));
    }
    if (market?.event?.severity === "HIGH" && market.event.hoursUntil <= proposal.horizonHours) {
      blockers.push(reason(
        "EVENT_RISK",
        "关键公司事件进入持有窗口",
        `${market.event.label} 距离现在 ${market.event.hoursUntil} 小时`
      ));
    }
  }

  const verdict = qualityFailures.length
    ? "INSUFFICIENT_EVIDENCE"
    : blockers.length
      ? "WAIT"
      : "PROCEED_WITH_LIMITS";
  const checks = [
    { id: "data_quality", passed: qualityFailures.length === 0, detail: qualityFailures[0]?.detail || "数据窗口、时效和时间戳通过" },
    { id: "risk_budget", passed: !blockers.some((item) => item.code === "RISK_BUDGET"), detail: recommendedMaxNotional == null ? "无法计算" : `建议名义金额上限 ${recommendedMaxNotional.toFixed(2)} USDT` },
    { id: "concentration", passed: !blockers.some((item) => item.code === "CONCENTRATION"), detail: `${portfolio.sectorName} 集中度 ${(portfolio.sector * 100).toFixed(1)}%` },
    { id: "session_gap", passed: !blockers.some((item) => item.code === "OFF_SESSION_GAP"), detail: deviation ? `${deviation.madScore.toFixed(2)} MAD` : "无法计算" },
    { id: "event_risk", passed: !blockers.some((item) => item.code === "EVENT_RISK"), detail: market?.event?.label || "持有窗口内无已知高风险事件" }
  ];
  const core = {
    verdict,
    proposal,
    metrics: {
      validWindows: returns.length,
      p1Return: percentiles.p1,
      p5Return: percentiles.p5,
      p1LossRate,
      p5LossRate,
      stressLossUsdt,
      recommendedMaxNotional,
      targetConcentration: portfolio.target,
      sectorConcentration: portfolio.sector,
      offSessionMadScore: deviation?.madScore ?? null,
      currentVsReferenceReturn: deviation?.currentReturn ?? null
    },
    checks,
    reasons: [...qualityFailures, ...blockers],
    evidence,
    market: {
      symbol: proposal.symbol,
      session: market?.session,
      lastPrice: Number(market?.ticker?.lastPrice),
      referenceClose: Number(market?.referenceClose),
      capturedAt: market?.ticker?.capturedAt,
      mode: market?.mode || "LIVE",
      event: market?.event || null,
      sparkline: (market?.candles || []).slice(-64).map((item) => Number(item.close))
    },
    evaluatedAt: new Date(now).toISOString()
  };
  return { ...core, auditHash: sha256(canonicalJson(core)) };
}
