# TradePremortem 完整投研任务记录

> 生成时间：2026-09-14T06:22:17.192Z
> 数据模式：真实 Bitget 快照回放
> 基础快照 SHA-256：`6ea88b56c416c6447ff47cb4079559c7b29cec6e1a011e5190f220585e78b7f8`
> 场景快照 SHA-256：`25ca8a54c9ac3029544a31c2fdacaae2156424da63619eafb0cb88b1db666016`

## 1. 提问

用户拟买入 1000 USDT 的 RNVDAUSDT，持有 24 小时，最大可承受亏损 25 USDT。当前组合已包含多只科技股，要求系统在交易前寻找最强反方证据。

## 2. 确定性结果

- Verdict：`WAIT`
- P1 压力亏损：36.93 USDT
- 建议最大名义金额：676.88 USDT
- 科技板块集中度：70.00%
- 有效历史窗口：376

### 触发原因

- RISK_BUDGET: 压力亏损超过预算 — P1 压力亏损 36.93 USDT，高于预算 25.00 USDT
- CONCENTRATION: 组合集中度过高 — TECH 板块占交易后组合的 70.0%

## 3. 历史相似场景

1. 2026-09-10T09:00:00.000Z · similarity 95.30% · forward -1.32%
2. 2026-08-31T00:00:00.000Z · similarity 86.90% · forward 1.14%
3. 2026-08-31T04:00:00.000Z · similarity 78.18% · forward 0.96%

匹配仅使用锚点时刻之前的状态变化和波动率，后续收益只用于展示同持有期压力结果，不构成预测。

## 4. 反方审讯

- 最强反方论点：压力亏损超过预算：P1 压力亏损 36.93 USDT，高于预算 25.00 USDT
- 隐藏假设：rToken 的历史波动分布能代表拟议持有期；现有组合名义金额能近似表达集中度；当前证据在人工决策前没有发生实质变化
- 改判条件：Bitget 最新行情或公司事件数据发生显著变化；压力亏损重新计算后超过用户预算；市场恢复常规交易后偏离没有收敛
- Provider：`DETERMINISTIC_FALLBACK`（本记录未调用模型；公开 Qwen 实测将单独记录）

## 5. 证据清单

1. [Reality 交易产品状态](https://api.bitget.com/api/v3/market/instruments?category=SPOT&symbol=RNVDAUSDT) · REPLAY/FACT · observed 2026-09-13T13:46:12.590Z
2. [rToken 实时行情](https://api.bitget.com/api/v3/market/tickers?category=SPOT&symbol=RNVDAUSDT) · REPLAY/FACT · observed 2026-09-13T13:46:14.172Z
3. [rToken 1 小时 K 线](https://api.bitget.com/api/v3/market/candles?category=SPOT&symbol=RNVDAUSDT&interval=1H&type=market&limit=1000) · REPLAY/FACT · observed 2026-09-13T13:46:12.817Z
4. [美股交易时段](https://api.bitget.com/api/v3/reality/market/states) · REPLAY/FACT · observed 2026-09-13T13:46:19.500Z
5. [美股休市日历](https://api.bitget.com/api/v3/reality/market/calendar) · REPLAY/FACT · observed 2026-09-13T13:46:13.278Z
6. [NVDA 公司概览](https://api.bitget.com/api/v3/reality/market/company-overview?code=NVDA) · REPLAY/FACT · observed 2026-09-13T13:46:13.411Z
7. [NVDA 估值指标](https://api.bitget.com/api/v3/reality/market/valuation-indicators?code=NVDA) · REPLAY/FACT · observed 2026-09-13T13:46:13.186Z
8. [NVDA 盈利预测](https://api.bitget.com/api/v3/reality/market/earnings-forecast?code=NVDA) · REPLAY/FACT · observed 2026-09-13T13:46:12.897Z
9. [NVDA 停复牌状态](https://api.bitget.com/api/v3/reality/market/suspension-resumption-info?code=NVDA) · REPLAY/FACT · observed 2026-09-13T13:46:13.604Z

## 6. 审计

- 报告审计 SHA-256：`516455e4fc7c8d4bafcadcaa862bc71f5f20d8ee5a734383f2b4a374e473c23e`
- 完整 JSON：[artifacts/case-study-rnvda.json](./artifacts/case-study-rnvda.json)
- 原始规范化快照：[data/replay-snapshots.json](./data/replay-snapshots.json)
- 无钱包连接、无订单接口、无真实资金操作。
