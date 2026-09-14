function fallbackNarrative(result) {
  const top = result.reasons[0];
  const p1 = result.metrics.p1LossRate == null ? "无法计算" : `${(result.metrics.p1LossRate * 100).toFixed(2)}%`;
  return {
    provider: "DETERMINISTIC_FALLBACK",
    generated: false,
    strongestCounterargument: top
      ? `${top.label}：${top.detail}`
      : `即使当前闸门通过，历史 P1 不利波动仍达到 ${p1}，这不是收益保证。`,
    hiddenAssumptions: [
      "rToken 的历史波动分布能代表拟议持有期",
      "现有组合名义金额能近似表达集中度",
      "当前证据在人工决策前没有发生实质变化"
    ],
    falsifiers: [
      "Bitget 最新行情或公司事件数据发生显著变化",
      "压力亏损重新计算后超过用户预算",
      "市场恢复常规交易后偏离没有收敛"
    ],
    humanPrompt: "请先核对证据时间与仓位上限，再由你决定是否继续；系统不会下单。"
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
  return "";
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
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Qwen HTTP ${response.status}`);
    const payload = await response.json();
    const parsed = JSON.parse(responseText(payload) || "{}");
    if (
      typeof parsed.strongestCounterargument !== "string" ||
      !Array.isArray(parsed.hiddenAssumptions) ||
      !Array.isArray(parsed.falsifiers) ||
      typeof parsed.humanPrompt !== "string"
    ) throw new Error("Qwen returned an invalid shape");
    return { provider: `Bitget Qwen · ${model}`, generated: true, ...parsed };
  } catch (error) {
    return { ...fallbackNarrative(result), warning: `千问调用失败，已使用确定性说明：${error.message}` };
  }
}

export { fallbackNarrative, qwenConfig, responseText };
