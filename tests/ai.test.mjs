import test from "node:test";
import assert from "node:assert/strict";
import { QWEN_TIMEOUT_MS, explainWithQwen, qwenConfig, responseText } from "../src/ai.mjs";

const result = {
  verdict: "WAIT",
  proposal: { symbol: "RNVDAUSDT" },
  metrics: { p1LossRate: 0.08 },
  reasons: [{ label: "仓位超限", detail: "拟议仓位超过风险预算反推上限。" }],
  evidence: [{
    title: "Bitget ticker",
    source: "https://www.bitget.com/api",
    observedAt: "2026-09-13T00:00:00.000Z",
    effectiveAt: "2026-09-13T00:00:00.000Z",
    kind: "FACT"
  }]
};

test("Qwen defaults match the Bitget hackathon provider", () => {
  assert.equal(QWEN_TIMEOUT_MS, 45_000);
  const previous = {
    BITGET_QWEN_API_KEY: process.env.BITGET_QWEN_API_KEY,
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    QWEN_BASE_URL: process.env.QWEN_BASE_URL,
    QWEN_MODEL: process.env.QWEN_MODEL
  };
  delete process.env.BITGET_QWEN_API_KEY;
  delete process.env.QWEN_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.QWEN_BASE_URL;
  delete process.env.QWEN_MODEL;
  try {
    assert.deepEqual(qwenConfig(), {
      apiKey: undefined,
      baseUrl: "https://hackathon.bitgetops.com/v1",
      model: "qwen3.8-max"
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Qwen Responses payload is parsed without changing the verdict", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.BITGET_QWEN_API_KEY;
  process.env.BITGET_QWEN_API_KEY = "test-only-key";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      async json() {
        return {
          output: [{
            content: [{
              type: "output_text",
              text: JSON.stringify({
                strongestCounterargument: "历史尾部风险超过当前预算。",
                hiddenAssumptions: ["假设一", "假设二", "假设三"],
                falsifiers: ["条件一", "条件二", "条件三"],
                humanPrompt: "先核对风险预算。"
              })
            }]
          }]
        };
      }
    };
  };
  try {
    const explanation = await explainWithQwen(result);
    assert.equal(request.url, "https://hackathon.bitgetops.com/v1/responses");
    assert.equal(request.body.model, "qwen3.8-max");
    assert.equal(request.options.headers.Authorization, "Bearer test-only-key");
    assert.equal(explanation.provider, "Bitget Qwen · qwen3.8-max");
    assert.equal(explanation.generated, true);
    assert.equal(result.verdict, "WAIT");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.BITGET_QWEN_API_KEY;
    else process.env.BITGET_QWEN_API_KEY = previousKey;
  }
});

test("responseText supports the Responses API output_text shortcut", () => {
  assert.equal(responseText({ output_text: "{\"ok\":true}" }), "{\"ok\":true}");
});
