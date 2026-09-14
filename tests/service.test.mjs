import test from "node:test";
import assert from "node:assert/strict";
import { createStressTest, findStressTest, getReplayList } from "../src/service.mjs";

test("service creates and stores a replay-backed report without credentials", async () => {
  const replay = getReplayList().find((item) => item.category === "concentration");
  const report = await createStressTest({ replayId: replay.id, proposal: replay.proposal });
  assert.equal(report.sourceMode, "REPLAY");
  assert.equal(report.verdict, "WAIT");
  assert.equal(report.baseSnapshotHash.length, 64);
  assert.equal(report.ai.generated, false);
  assert.equal(report.ai.provider, "DETERMINISTIC_FALLBACK");
  assert.equal(findStressTest(report.id)?.auditHash, report.auditHash);
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
