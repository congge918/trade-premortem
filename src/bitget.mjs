const API_BASE = "https://api.bitget.com";

const companyCode = Object.freeze({
  RAAPLUSDT: "AAPL",
  RNVDAUSDT: "NVDA",
  RGOOGLUSDT: "GOOGL",
  RCOINUSDT: "COIN"
});

async function fetchJson(path, timeoutMs = 15_000) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "TradePremortem/0.1" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Bitget ${response.status} for ${path}`);
  const payload = await response.json();
  if (payload.code !== "00000") throw new Error(`Bitget ${payload.code}: ${payload.msg}`);
  return payload;
}

function evidence(id, title, path, payload, effectiveAt, kind = "FACT") {
  const observedAt = new Date(Number(payload.requestTime)).toISOString();
  return {
    id,
    title,
    source: "Bitget UTA v3",
    sourceUrl: `${API_BASE}${path}`,
    observedAt,
    effectiveAt: effectiveAt || observedAt,
    freshness: "LIVE",
    kind
  };
}

function nyParts(timestamp) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function currentSession(timestamp, calendar) {
  const parts = nyParts(timestamp);
  const closedDay = { Sat: "SATURDAY", Sun: "SUNDAY" }[parts.weekday];
  if (closedDay && calendar?.regularConfig?.includes(closedDay)) return "CLOSED";
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  if (minutes >= 570 && minutes < 960) return "REGULAR";
  if (minutes >= 240 && minutes < 570) return "PRE_MARKET";
  if (minutes >= 960 && minutes < 1200) return "AFTER_HOURS";
  return "OVERNIGHT";
}

function findReferenceClose(candles) {
  const ordered = [...candles].sort((a, b) => b.ts - a.ts);
  const closing = ordered.find((candle) => {
    const parts = nyParts(candle.ts);
    return parts.weekday !== "Sat" && parts.weekday !== "Sun" && Number(parts.hour) === 15;
  });
  return closing?.close || ordered[0]?.close || null;
}

export async function loadLiveMarket(symbol) {
  const encodedSymbol = encodeURIComponent(symbol);
  const code = companyCode[symbol];
  if (!code) throw new TypeError("unsupported live symbol");
  const instrumentPath = `/api/v3/market/instruments?category=SPOT&symbol=${encodedSymbol}`;
  const tickerPath = `/api/v3/market/tickers?category=SPOT&symbol=${encodedSymbol}`;
  const candlePath = `/api/v3/market/candles?category=SPOT&symbol=${encodedSymbol}&interval=1H&type=market&limit=1000`;
  const statePath = "/api/v3/reality/market/states";
  const calendarPath = "/api/v3/reality/market/calendar";
  const overviewPath = `/api/v3/reality/market/company-overview?code=${encodeURIComponent(code)}`;

  const [instrumentPayload, tickerPayload, candlePayload, statePayload, calendarPayload, overviewResult] = await Promise.all([
    fetchJson(instrumentPath),
    fetchJson(tickerPath),
    fetchJson(candlePath),
    fetchJson(statePath),
    fetchJson(calendarPath),
    fetchJson(overviewPath).catch((error) => ({ error: error.message }))
  ]);
  const instrument = instrumentPayload.data?.[0];
  const ticker = tickerPayload.data?.[0];
  if (instrument?.isReality !== "yes" || !ticker) throw new Error("Bitget did not return an active Reality instrument");
  const candles = (candlePayload.data || []).map((row) => ({
    ts: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: row[5] === "" ? null : Number(row[5])
  }));
  const capturedAt = new Date(Number(ticker.ts || tickerPayload.requestTime)).toISOString();
  const calendar = calendarPayload.data;
  const outputEvidence = [
    evidence("instrument", "Reality 交易产品状态", instrumentPath, instrumentPayload, new Date(Number(instrument.launchTime)).toISOString()),
    evidence("ticker", "rToken 实时行情", tickerPath, tickerPayload, capturedAt),
    evidence("candles", "rToken 1 小时 K 线", candlePath, candlePayload, new Date(candles.at(-1)?.ts || candlePayload.requestTime).toISOString()),
    evidence("market_state", "美股交易时段", statePath, statePayload),
    evidence("market_calendar", "美股休市日历", calendarPath, calendarPayload)
  ];
  if (!overviewResult.error) {
    outputEvidence.push(evidence("company", `${code} 公司概览`, overviewPath, overviewResult));
  }
  return {
    market: {
      mode: "LIVE",
      ticker: { lastPrice: Number(ticker.lastPrice), capturedAt },
      candles,
      referenceClose: Number(findReferenceClose(candles)),
      session: currentSession(Number(ticker.ts), calendar),
      event: null,
      instrument,
      states: statePayload.data,
      company: overviewResult.data || null
    },
    evidence: outputEvidence,
    clockAt: capturedAt,
    warnings: overviewResult.error ? [`公司概览暂不可用：${overviewResult.error}`] : []
  };
}

export function getCompanyCode(symbol) {
  return companyCode[symbol] || null;
}
