# Bitget Hackathon S2 提交草稿

> 所有方括号内容必须在发布与提交后替换；不得填写虚假链接、身份或测试人数。

## 固定字段

- Team name：`TradePremortem`
- Track：`AI Trading Desk`
- Sub-theme：`决策压力测试`
- S1 participant：`No`
- Demo Day：`Yes`
- University：留空

## 一句话介绍（87 字）

面向 rToken 交易者的 AI 交易失败预演台：在下单前主动寻找反方证据，计算历史极端亏损与组合集中度，并在数据不足时拒绝给出结论。

## 项目描述

### 第一段 · 思路

rToken 将美股交易延伸到 7×24，但美股休市期间，价格仍可能响应宏观、公司和 Crypto 市场信息。现有交易助手通常直接回答“买还是卖”，却很少检查证据是否过期、组合是否已经过度集中，或主动寻找推翻交易论点的证据。TradePremortem 的核心假设是：交易前最有价值的 AI，不是预测收益，而是先假设交易已经失败，再识别最可能的失败路径。系统读取 Bitget rToken 行情、K 线、市场状态和 Reality 基础数据，检索历史相似窗口，并确定性计算 P1/P5 不利波动、亏损预算反推仓位、组合集中度和休市偏离；Qwen 只负责生成最强反方论点、隐藏假设和证伪条件。数据不足时系统拒绝结论，模型不能修改规则判决，也不能触发交易。

### 第二段 · 目标用户与产品价值

目标用户是持有约 5,000–50,000 USDT 可投资资金、每周交易 1–10 次的 Bitget Retail rToken 交易者。其风险偏好通常为中等至中高，但缺少机构级组合风控工具，常见场景是在美股休市、盘前盘后或财报窗口交易 rNVDA、rAAPL、rGOOGL、rCOIN。这类用户能够看到行情和新闻，却难以快速判断单笔风险预算、组合板块集中度、休市偏离和证据时效。TradePremortem 将这些检查压缩成一次可复核的交易前任务，不要求连接钱包或授权账户，最终决定始终由用户完成。

### 第三段 · 验证数据与关键指标

当前工程实测：19/19 自动化测试通过；16 个固定压力案例的预期判决和核心原因一致率为 100%；有效案例证据完整率 100%；故障注入正确标注率、历史相似场景覆盖率和过期数据阻断率均为 100%；错误宣称“分析完成”次数为 0。四个 rToken 均使用 2026-09-13 从 Bitget 公开接口采集的规范化快照，每个保留 400 根一小时 K 线、9 条证据和来源 SHA-256。公开 Render 的一次公网冒烟实测中，确定性结果约 0.88 秒返回，Qwen 完整分析约 14.8 秒完成，`aiGenerated=true` 且无警告；这是单次实测，不代表延迟分布或长期成功率。以上均为工程实测，不是收益回测或真人使用数据。当前真实测试用户为 0，Qwen 与普通 LLM 的正式对照尚未完成。提交前目标为至少 5 名目标用户测试、无指导任务完成率 ≥80%、至少 4/5 用户能说明下一步行动及原因、Qwen 结构化输出成功率 ≥95%、拒答案例判决保持率 100%；首月分发目标为 50 名 Activation 和 7 日留存 ≥20%，均标记为目标值。

### 第四段 · 完成度

已完成公开 Web Demo、四个 rToken 输入流程、Bitget UTA v3 instruments、ticker、candles、美国市场状态、休市日历、公司概览、估值指标、盈利预测和停复牌状态适配，完成历史相似场景、P1/P5 压力计算、仓位上限、组合集中度、休市 MAD 偏离、证据时效闸门、真实快照回放、显式故障注入、审计哈希及 Bitget 赛期 Qwen Responses API 适配。技术栈为 Node.js 20+、原生 Web 前端、Bitget UTA v3 和 `qwen3.8-max`。公开部署已完成 Qwen 实际调用、桌面与手机尺寸验收；尚未完成真人可用性测试、正式模型对照和最终视频。项目不包含钱包连接、订单执行或真实资金操作。

### 第五段 · 材料清单

提交材料包含在线 Demo、公开 GitHub 仓库、完整 README、评估报告、可复现测试和数据采集代码、rNVDA 完整投研任务记录、可机读 JSON、真实 Bitget 规范化快照、演示视频及合规 X 项目介绍帖。所有链接均在“提交材料链接”字段逐行提供。

### 第六段 · 对 AI Trading 的看法

AI Trading 不应该把不确定性包装成确定答案。更可靠的架构应把事实、确定性计算和模型推断分开：市场数据负责描述发生了什么，代码负责执行风险预算和安全闸门，模型负责挑战人的交易论点。模型可以提出反方证据和改判条件，但没有权力修改价格、风险公式或证据不足状态。对 Bitget AI 工具的建议是进一步提供带统一时间戳、来源和置信度的结构化 Skill 输出，使投研结果能够直接进入审计链。

## AI / LLM 作用

公开 Render 已启用 Bitget 赛期 Qwen `qwen3.8-max` Responses API。模型接收交易提案、市场状态、风险指标、历史相似场景、规则 verdict 和带来源/时间戳的证据摘要，输出最强反方论点、隐藏假设、证伪条件与人工核对提示。所有风险数值和 verdict 由确定性代码计算，模型不能修改。若模型超时或不可用，页面会明确显示规则回退，不会把模板结果冒充模型输出。

## 材料链接

```text
[在线 Demo] https://trade-premortem.onrender.com
[GitHub 仓库] https://github.com/congge918/trade-premortem
[README] https://github.com/congge918/trade-premortem#readme
[Evaluation] https://github.com/congge918/trade-premortem/blob/main/EVALUATION.md
[完整投研任务记录] https://github.com/congge918/trade-premortem/blob/main/CASE_STUDY.md
[可机读运行记录] https://github.com/congge918/trade-premortem/blob/main/artifacts/case-study-rnvda.json
[真实快照数据] https://github.com/congge918/trade-premortem/blob/main/data/replay-snapshots.json
[真人测试方法与记录] https://github.com/congge918/trade-premortem/blob/main/USER_TEST.md
[不超过 3 分钟演示视频]
[最终 X 帖]
```

## 最终提交前私人字段

- Lead Bitget UID：由参赛者本人填写
- Lead email：由参赛者本人填写
- Telegram：由参赛者本人填写并确认允许陌生人私信
- 获取渠道、个人背景、Demo Day 联系信息：按真实情况填写
