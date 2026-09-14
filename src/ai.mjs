export const QWEN_TIMEOUT_MS = 45_000;

function fallbackCounterargument(result, top, p1) {
  const metrics = result.metrics;
  if (!top) return `历史最差 1% 情况下，价格波动约为 ${p1}。风险仍然存在。`;
  if (top.code === "RISK_BUDGET") {
    return `历史极端情况下可能亏损 ${metrics.stressLossUsdt.toFixed(2)} USDT，超过你设定的 ${result.proposal.riskBudgetUsdt.toFixed(2)} USDT。`;
  }
  if (top.code === "CONCENTRATION") {
    return `交易完成后，同类资产会占组合的 ${(metrics.sectorConcentration * 100).toFixed(1)}%，风险过于集中。`;
  }
  if (top.code === "STALE_TICKER") return "价格数据已经过期，当前风险无法可靠判断。";
  if (top.code === "WINDOWS") return "可用的历史样本太少，暂时无法计算极端风险。";
  if (top.code === "MISSING_TIME") return "关键数据缺少采集时间，暂时无法确认它是否仍然有效。";
  if (top.code === "OFF_SESSION_GAP") return `休市价格偏离达到历史正常波动的 ${metrics.offSessionMadScore.toFixed(2)} 倍。`;
  if (top.code === "EVENT_RISK") return "公司事件就在计划持有期内，价格可能出现额外波动。";
  return top.detail;
}

function fallbackNarrative(result) {
  const top = result.reasons[0];
  const p1 = result.metrics.p1LossRate == null ? "无法计算" : `${(result.metrics.p1LossRate * 100).toFixed(2)}%`;
  return {
    provider: "DETERMINISTIC_FALLBACK",
    generated: false,
    strongestCounterargument: fallbackCounterargument(result, top, p1),
    hiddenAssumptions: [
      "过去的波动能代表你计划持有的这段时间",
      "填写的持仓金额足以反映真实的集中风险",
      "你下单前，价格和公司信息不会明显变化"
    ],
    falsifiers: [
      "Bitget 行情或公司信息出现明显变化",
      "减少交易金额后，压力亏损回到预算以内",
      "恢复常规交易后，价格偏离仍没有收窄"
    ],
    humanPrompt: "先核对数据时间和金额上限，再决定是否继续。系统不会替你下单。"
  };
}

function promptFor(result) {
  const market = result.market || {};
  return `你是一个交易观点的反方审讯员，不预测收益，也不下单。只根据给定 JSON 返回严格 JSON，字段为 strongestCounterargument(string)、hiddenAssumptions(string[3])、falsifiers(string[3])、humanPrompt(string)。不得改变 verdict，不得编造 JSON 中没有的事实。\n${JSON.stringify({
    verdict: result.verdict,
    proposal: result.proposal,
    metrics: result.metrics,
    market: {
      symbol: market.symbol,
      session: market.session,
      lastPrice: market.lastPrice,
      referenceClose: market.referenceClose,
      capturedAt: market.capturedAt,
      mode: market.mode
    },
    reasons: result.reasons,
    historicalAnalogs: result.historicalAnalogs || [],
    evidence: (result.evidence || []).map(({ title, source, observedAt, effectiveAt, freshness, kind, summary }) => ({
      title,
      source,
      observedAt,
      effectiveAt,
      freshness,
      kind,
      summary
    }))
  })}`;
}

function qwenConfig() {
  return {
    apiKey: process.env.BITGET_QWEN_API_KEY || process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY,
    baseUrl: (process.env.QWEN_BASE_URL || "https://hackathon.bitgetops.com/v1").replace(/\/$/, ""),
    model: process.env.QWEN_MODEL || "qwen3.8-max"
  };
}

function responseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  if (typeof payload.choices?.[0]?.message?.content === "string") {
    return payload.choices[0].message.content;
  }
  return "";
}

function parseQwenJson(text) {
  const value = String(text || "").trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Qwen returned non-JSON text");
  return JSON.parse(value.slice(start, end + 1));
}

export async function explainWithQwen(result) {
  const { apiKey, baseUrl, model } = qwenConfig();
  if (!apiKey) return fallbackNarrative(result);
  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: "你只做基于证据的交易前压力测试解释。人类保留最终决定。" }]
          },
          { role: "user", content: [{ type: "input_text", text: promptFor(result) }] }
        ]
      }),
      signal: AbortSignal.timeout(QWEN_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`Qwen HTTP ${response.status}`);
    const payload = await response.json();
    const parsed = parseQwenJson(responseText(payload));
    if (
      typeof parsed.strongestCounterargument !== "string" ||
      !Array.isArray(parsed.hiddenAssumptions) ||
      !Array.isArray(parsed.falsifiers) ||
      typeof parsed.humanPrompt !== "string"
    ) throw new Error("Qwen returned an invalid shape");
    return { provider: `Bitget Qwen · ${model}`, generated: true, ...parsed };
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || /aborted|timeout/i.test(error?.message || "");
    console.warn(`[qwen] ${timedOut ? "timeout" : error?.message || "unknown error"}`);
    const warning = timedOut
      ? "Qwen 响应超时，已显示规则生成的说明。"
      : "Qwen 暂时不可用，已显示规则生成的说明。";
    return { ...fallbackNarrative(result), warning };
  }
}

export { fallbackNarrative, parseQwenJson, qwenConfig, responseText };
