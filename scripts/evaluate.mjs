import { evaluateStressTest } from "../src/engine.mjs";
import { getBenchmarkReplays } from "../src/replays.mjs";

const cases = getBenchmarkReplays();
const expectedByCategory = {
  gap: ["WAIT", "OFF_SESSION_GAP"],
  event: ["WAIT", "EVENT_RISK"],
  concentration: ["WAIT", "CONCENTRATION"],
  stale: ["INSUFFICIENT_EVIDENCE", "STALE_TICKER"]
};

const results = cases.map((replay) => {
  const result = evaluateStressTest({
    proposal: replay.proposal,
    market: replay.market,
    evidence: replay.evidence,
    clockAt: replay.clockAt
  });
  const [expectedVerdict, expectedReason] = expectedByCategory[replay.category];
  const completeEvidence = result.evidence.filter((item) =>
    item.source && item.sourceUrl && item.observedAt && item.effectiveAt && item.freshness && item.kind
  ).length;
  return {
    id: replay.id,
    category: replay.category,
    verdict: result.verdict,
    expectedVerdict,
    verdictMatch: result.verdict === expectedVerdict,
    reasonMatch: result.reasons.some((item) => item.code === expectedReason),
    evidenceCompleteness: completeEvidence / result.evidence.length,
    auditHash: result.auditHash
  };
});

const stale = results.filter((item) => item.category === "stale");
const summary = {
  generatedAt: new Date().toISOString(),
  cases: results.length,
  verdictAgreement: results.filter((item) => item.verdictMatch && item.reasonMatch).length / results.length,
  evidenceCompleteness: results.reduce((sum, item) => sum + item.evidenceCompleteness, 0) / results.length,
  staleBlockRate: stale.filter((item) => item.verdict === "INSUFFICIENT_EVIDENCE").length / stale.length,
  falseCompletionCount: stale.filter((item) => item.verdict !== "INSUFFICIENT_EVIDENCE").length,
  uniqueAuditHashes: new Set(results.map((item) => item.auditHash)).size,
  qwenBaseline: process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY ? "credential available; run human-reviewed comparison" : "not run; no credential supplied"
};

console.log(JSON.stringify({ summary, results }, null, 2));
