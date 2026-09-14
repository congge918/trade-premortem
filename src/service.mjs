import { randomUUID } from "node:crypto";
import { explainWithQwen, fallbackNarrative, qwenConfig } from "./ai.mjs";
import { loadLiveMarket } from "./bitget.mjs";
import { evaluateStressTest, validateProposal } from "./engine.mjs";
import { buildReplay, getReplay, listPublicReplays } from "./replays.mjs";

const reports = new Map();

function save(report) {
  reports.set(report.id, report);
  while (reports.size > 100) reports.delete(reports.keys().next().value);
  return report;
}

export async function createStressTest(body) {
  const proposal = validateProposal(body?.proposal);
  const requestedReplay = body?.replayId ? getReplay(String(body.replayId)) : null;
  if (body?.replayId && !requestedReplay) throw new TypeError("replayId was not found");
  if (requestedReplay && requestedReplay.symbol !== proposal.symbol) {
    throw new TypeError("replayId symbol does not match proposal symbol");
  }
  let context;
  const warnings = [];
  if (requestedReplay) {
    context = requestedReplay;
  } else {
    try {
      context = await loadLiveMarket(proposal.symbol);
    } catch (error) {
      context = buildReplay(proposal.symbol, "baseline");
      warnings.push(`实时 Bitget 数据不可用，已切换到带时间戳的回放：${error.message}`);
    }
  }
  const result = evaluateStressTest({
    proposal,
    market: context.market,
    evidence: context.evidence,
    clockAt: context.clockAt
  });
  const aiPending = Boolean(qwenConfig().apiKey);
  const ai = { ...fallbackNarrative(result), pending: aiPending };
  const report = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    sourceMode: context.market.mode,
    replayId: requestedReplay?.id || (context.market.mode === "REPLAY" ? context.id : null),
    snapshotHash: context.snapshotHash || null,
    baseSnapshotHash: context.baseSnapshotHash || null,
    scenarioInjections: context.scenarioInjections || [],
    warnings: [...(context.warnings || []), ...warnings],
    ...result,
    ai
  };
  save(report);
  if (aiPending) {
    void explainWithQwen(result).then((completedAi) => {
      const saved = reports.get(report.id);
      if (!saved) return;
      saved.ai = { ...completedAi, pending: false };
      if (completedAi.warning) saved.warnings.push(completedAi.warning);
    });
  }
  return report;
}

export function findStressTest(id) {
  return reports.get(id) || null;
}

export function getReplayList() {
  return listPublicReplays();
}
