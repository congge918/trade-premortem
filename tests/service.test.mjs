import test from "node:test";
import assert from "node:assert/strict";
import { createStressTest, findStressTest, getReplayList } from "../src/service.mjs";

test("service creates and stores a replay-backed report without credentials", async () => {
  const names = ["BITGET_QWEN_API_KEY", "QWEN_API_KEY", "DASHSCOPE_API_KEY"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  names.forEach((name) => delete process.env[name]);
  try {
    const replay = getReplayList().find((item) => item.category === "concentration");
    const report = await createStressTest({ replayId: replay.id, proposal: replay.proposal });
    assert.equal(report.sourceMode, "REPLAY");
    assert.equal(report.verdict, "WAIT");
    assert.equal(report.baseSnapshotHash.length, 64);
    assert.equal(report.ai.generated, false);
    assert.equal(report.ai.pending, false);
    assert.equal(report.ai.provider, "DETERMINISTIC_FALLBACK");
    assert.equal(findStressTest(report.id)?.auditHash, report.auditHash);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("service returns the risk result before Qwen finishes", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.BITGET_QWEN_API_KEY;
  process.env.BITGET_QWEN_API_KEY = "test-only-key";
  let finishQwen;
  globalThis.fetch = () => new Promise((resolve) => {
    finishQwen = () => resolve({
      ok: true,
      async json() {
        return {
          output_text: JSON.stringify({
            strongestCounterargument: "交易金额超过当前风险预算。",
            hiddenAssumptions: ["假设一", "假设二", "假设三"],
            falsifiers: ["条件一", "条件二", "条件三"],
            humanPrompt: "先减少交易金额。"
          })
        };
      }
    });
  });
  try {
    const replay = getReplayList().find((item) => item.category === "concentration");
    const report = await createStressTest({ replayId: replay.id, proposal: replay.proposal });
    assert.equal(report.ai.pending, true);
    assert.equal(report.ai.generated, false);
    finishQwen();
    await new Promise((resolve) => setImmediate(resolve));
    const completed = findStressTest(report.id);
    assert.equal(completed.ai.pending, false);
    assert.equal(completed.ai.generated, true);
    assert.equal(completed.ai.strongestCounterargument, "交易金额超过当前风险预算。");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.BITGET_QWEN_API_KEY;
    else process.env.BITGET_QWEN_API_KEY = previousKey;
  }
});

test("service rejects unknown replay ids", async () => {
  const proposal = getReplayList()[0].proposal;
  await assert.rejects(() => createStressTest({ replayId: "missing", proposal }), /not found/);
});

test("service rejects a proposal that does not match replay market evidence", async () => {
  const replays = getReplayList();
  const first = replays[0];
  const other = replays.find((item) => item.symbol !== first.symbol);
  await assert.rejects(
    () => createStressTest({ replayId: first.id, proposal: other.proposal }),
    /does not match/
  );
});
