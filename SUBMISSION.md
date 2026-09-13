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

### 1. 核心论点

交易 AI 不应只回答“买不买”，更应该证明自己知道什么时候不能回答。TradePremortem 在用户下单前假设交易已经失败，使用 Bitget rToken 行情和确定性风险公式寻找最可能推翻交易论点的证据。数据不足时拒绝结论，AI 不能覆盖规则判决。

### 2. 目标用户

面向交易 rToken、但缺少机构风控工具的个人交易者，尤其适用于美股常规盘外追逐新闻、财报或价格偏离的场景。用户提供拟议交易、持有周期、最大亏损预算和现有组合，不需要授权账户或钱包。

### 3. 完整工作流

系统从 Bitget UTA v3 读取 Reality 产品状态、ticker、1 小时 K 线、美国市场状态和休市日历，建立包含来源与时间戳的证据账本。确定性引擎计算持有期 P1/P5 不利波动、预算反推仓位、板块集中度和休市 MAD 偏离。千问最后生成最强反方论点、隐藏假设和改判条件。输出只有受限通过、暂缓、证据不足，最终决定始终由人类完成。

### 4. 验证结果

16 个固定案例覆盖 4 个 rToken 和休市偏离、公司事件、组合集中、过期/缺失四类情景。当前自动化结果为判决/原因一致率 100%、证据字段完整率 95%、过期数据阻断率 100%、错误完成 0；14/14 测试通过。千问对照和真人测试只有完成后才补充。

### 5. 完成度

已完成可运行 Web Demo、只读 Bitget 实时数据适配器、时间戳回放、确定性压力引擎、Bitget 赛期 Qwen Responses API 适配、证据账本、审计哈希、16 案例验证脚本和提交材料。公开部署尚未完成 Qwen 实际调用验收。项目不包含订单执行、钱包连接或真实资金操作。

### 6. AI Trading 观点

AI Trading 的价值不是把不确定性包装成确定答案，而是把事实、计算和推断分层，并在证据不足时停止。TradePremortem 让模型承担“反方审讯员”而不是“收益预言家”：模型可以挑战人的论点，但无权改写价格数据、风险公式或安全闸门。

## AI / LLM 作用

千问仅接收压缩后的证据摘要、规则 verdict 和风险指标，生成反方论点、隐藏假设、证伪条件与人类核对提示。所有风险数值和 verdict 由确定性代码计算。没有密钥或模型失败时，系统显示规则回退状态，不冒充模型生成。

## 材料链接

```text
[在线 Demo] https://trade-premortem.onrender.com
[GitHub 仓库] https://github.com/congge918/trade-premortem
[README] https://github.com/congge918/trade-premortem#readme
[Evaluation] https://github.com/congge918/trade-premortem/blob/main/EVALUATION.md
[不超过 3 分钟演示视频]
[最终 X 帖]
```

## 最终提交前私人字段

- Lead Bitget UID：由参赛者本人填写
- Lead email：由参赛者本人填写
- Telegram：由参赛者本人填写并确认允许陌生人私信
- 获取渠道、个人背景、Demo Day 联系信息：按真实情况填写
