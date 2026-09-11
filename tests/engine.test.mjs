import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, redact, sha256 } from "../src/crypto.mjs";
import {
  ALLOWED_SYMBOLS,
  calculateReturns,
  evaluateStressTest,
  normalizeSymbol,
  validateProposal
} from "../src/engine.mjs";
import { getCompanyCode } from "../src/bitget.mjs";
import { buildReplay, getBenchmarkReplays, getReplay, listPublicReplays } from "../src/replays.mjs";

function evaluateReplay(replay) {
  return evaluateStressTest({
    proposal: replay.proposal,
    market: replay.market,
    evidence: replay.evidence,
    clockAt: replay.clockAt
  });
}

test("normalizes and validates the four demo rTokens", () => {
  assert.equal(normalizeSymbol("rnvdausdt"), "RNVDAUSDT");
  for (const symbol of ALLOWED_SYMBOLS) {
    const replay = buildReplay(symbol, "baseline");
    assert.equal(validateProposal(replay.proposal).symbol, symbol);
  }
  assert.throws(() => validateProposal({ ...buildReplay("RAAPLUSDT").proposal, symbol: "BTCUSDT" }), /demo rToken/);
});

test("calculates rolling horizon returns without mutating candles", () => {
  const candles = [100, 101, 99, 102, 103].map((close, index) => ({ ts: index + 1, close }));
  const original = structuredClone(candles);
  const returns = calculateReturns(candles, 2);
  assert.equal(returns.length, 3);
  assert.ok(Math.abs(returns[0] - -0.01) < 1e-12);
  assert.deepEqual(candles, original);
});

test("baseline case proceeds only with explicit limits", () => {
  const result = evaluateReplay(buildReplay("RAAPLUSDT", "baseline"));
  assert.equal(result.verdict, "PROCEED_WITH_LIMITS");
  assert.ok(result.metrics.validWindows >= 30);
  assert.ok(result.metrics.recommendedMaxNotional > result.proposal.notionalUsdt);
  assert.equal(result.reasons.length, 0);
});

test("all 16 benchmark cases match their deterministic verdict and reason", () => {
  const cases = getBenchmarkReplays();
  assert.equal(cases.length, 16);
  for (const replay of cases) {
    const result = evaluateReplay(replay);
    if (replay.category === "stale") {
      assert.equal(result.verdict, "INSUFFICIENT_EVIDENCE", replay.id);
      assert.ok(result.reasons.some((item) => item.code === "STALE_TICKER"), replay.id);
      assert.ok(result.reasons.some((item) => item.code === "MISSING_TIME"), replay.id);
    } else {
      assert.equal(result.verdict, "WAIT", replay.id);
      const expectedCode = {
        gap: "OFF_SESSION_GAP",
        event: "EVENT_RISK",
        concentration: "CONCENTRATION"
      }[replay.category];
      assert.ok(result.reasons.some((item) => item.code === expectedCode), replay.id);
    }
  }
});

test("risk budget can independently stop an otherwise valid proposal", () => {
  const replay = buildReplay("RAAPLUSDT", "baseline");
  replay.proposal.notionalUsdt = 1000;
  replay.proposal.riskBudgetUsdt = 1;
  const result = evaluateReplay(replay);
  assert.equal(result.verdict, "WAIT");
  assert.ok(result.reasons.some((item) => item.code === "RISK_BUDGET"));
});

test("audit hash is reproducible and changes when evidence changes", () => {
  const replay = buildReplay("RAAPLUSDT", "baseline");
  const first = evaluateReplay(replay);
  const second = evaluateReplay(structuredClone(replay));
  assert.equal(first.auditHash, second.auditHash);
  const changed = structuredClone(replay);
  changed.evidence[0].title = "tampered";
  assert.notEqual(evaluateReplay(changed).auditHash, first.auditHash);
});

test("canonical hashing is stable and secret-shaped fields are redacted", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(sha256("same"), sha256("same"));
  assert.deepEqual(redact({ apiKey: "secret", nested: { password: "secret", safe: true } }), {
    apiKey: "[REDACTED]",
    nested: { password: "[REDACTED]", safe: true }
  });
});

test("replay catalog and company-code mapping stay within the public demo set", () => {
  const replays = listPublicReplays();
  assert.ok(replays.length >= 5);
  assert.ok(replays.every((item) => ALLOWED_SYMBOLS.includes(item.symbol)));
  assert.equal(getReplay(replays[0].id)?.snapshotHash, replays[0].snapshotHash);
  assert.equal(getCompanyCode("RNVDAUSDT"), "NVDA");
  assert.equal(getCompanyCode("BTCUSDT"), null);
});
