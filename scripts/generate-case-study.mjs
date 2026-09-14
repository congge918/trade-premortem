import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fallbackNarrative } from "../src/ai.mjs";
import { evaluateStressTest } from "../src/engine.mjs";
import { buildReplay } from "../src/replays.mjs";

const replay = buildReplay("RNVDAUSDT", "concentration");
const result = evaluateStressTest({
  proposal: replay.proposal,
  market: replay.market,
  evidence: replay.evidence,
  clockAt: replay.clockAt
});
const record = {
  schemaVersion: 1,
  recordType: "AI_TRADING_DESK_RESEARCH_TASK",
  generatedAt: new Date().toISOString(),
  replayId: replay.id,
  baseSnapshotHash: replay.baseSnapshotHash,
  scenarioSnapshotHash: replay.snapshotHash,
  ...result,
  ai: fallbackNarrative(result)
};
const outputDirectory = fileURLToPath(new URL("../artifacts/", import.meta.url));
const jsonPath = fileURLToPath(new URL("../artifacts/case-study-rnvda.json", import.meta.url));
const markdownPath = fileURLToPath(new URL("../CASE_STUDY.md", import.meta.url));
const percent = (value) => value == null ? "—" : `${(value * 100).toFixed(2)}%`;
const money = (value) => value == null ? "—" : `${value.toFixed(2)} USDT`;
const reasonLines = result.reasons.map((item) => `- ${item.code}: ${item.label} — ${item.detail}`).join("\n");
const analogLines = result.historicalAnalogs.map((item, index) =>
  `${index + 1}. ${item.anchorAt} · similarity ${percent(item.similarity)} · forward ${percent(item.forwardReturn)}`
).join("\n");
const evidenceLines = result.evidence.map((item, index) =>
  `${index + 1}. [${item.title}](${item.sourceUrl}) · ${item.freshness}/${item.kind} · observed ${item.observedAt}`
).join("\n");
const markdown = `# TradePremortem 完整投研任务记录

> 生成时间：${record.generatedAt}
> 数据模式：真实 Bitget 快照回放
> 基础快照 SHA-256：\`${replay.baseSnapshotHash}\`
> 场景快照 SHA-256：\`${replay.snapshotHash}\`

## 1. 提问

用户拟买入 ${replay.proposal.notionalUsdt} USDT 的 ${replay.proposal.symbol}，持有 ${replay.proposal.horizonHours} 小时，最大可承受亏损 ${replay.proposal.riskBudgetUsdt} USDT。当前组合已包含多只科技股，要求系统在交易前寻找最强反方证据。

## 2. 确定性结果

- Verdict：\`${result.verdict}\`
- P1 压力亏损：${money(result.metrics.stressLossUsdt)}
- 建议最大名义金额：${money(result.metrics.recommendedMaxNotional)}
- 科技板块集中度：${percent(result.metrics.sectorConcentration)}
- 有效历史窗口：${result.metrics.validWindows}

### 触发原因

${reasonLines || "- 没有阻断原因"}

## 3. 历史相似场景

${analogLines}

匹配仅使用锚点时刻之前的状态变化和波动率，后续收益只用于展示同持有期压力结果，不构成预测。

## 4. 反方审讯

- 最强反方论点：${record.ai.strongestCounterargument}
- 隐藏假设：${record.ai.hiddenAssumptions.join("；")}
- 改判条件：${record.ai.falsifiers.join("；")}
- Provider：\`${record.ai.provider}\`（本记录未调用模型；公开 Qwen 实测将单独记录）

## 5. 证据清单

${evidenceLines}

## 6. 审计

- 报告审计 SHA-256：\`${result.auditHash}\`
- 完整 JSON：[artifacts/case-study-rnvda.json](./artifacts/case-study-rnvda.json)
- 原始规范化快照：[data/replay-snapshots.json](./data/replay-snapshots.json)
- 无钱包连接、无订单接口、无真实资金操作。
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
await writeFile(markdownPath, markdown, "utf8");
console.log(`Generated ${markdownPath}`);
console.log(`Generated ${jsonPath}`);
