# Build in Public 与最终 X 帖草稿

## 最终合规单帖（推荐）

> 发布时附上不超过 3 分钟的演示视频；这一条即可作为提交表中的 X 项目介绍链接。发布前确认 Demo 可访问。

一笔 rNVDA 交易，计划投 1000U，最多亏 25U。

TradePremortem 用 Bitget 数据算出压力亏损 36.93U、金额上限 676.88U，结论是先别下单。

Qwen 再找反方理由；数据过期，系统直接拒答。

来试试它会不会拦住你
https://trade-premortem.onrender.com

@Bitget_AI #BitgetHackathon

## 立项帖

我在做 TradePremortem，一个面向 Bitget rToken 交易者的失败预演台。

下单前先假设交易已经失败，再用实时 Bitget 数据、P1/P5 压力亏损和组合集中度寻找反证。证据过期时，系统直接拒答。只读研究，不连接钱包，不下单。

Demo: https://trade-premortem.onrender.com
Code: https://github.com/congge918/trade-premortem

Qwen 赛期额度已获批，正在完成公开部署验收。

@Bitget_AI #BitgetHackathon

## 验证帖

TradePremortem now has a 16-case rToken stress suite across off-session gaps, company events, portfolio concentration and stale evidence.

Current measured results:
• deterministic verdict/reason agreement: 100%
• stale-data block rate: 100%
• false completions: 0
• scenario injections correctly labeled: 100%

All 4 rTokens now use timestamped Bitget snapshots, and every result retrieves 3 historical analogs without future-data leakage.

The important feature is not another signal. It is refusing to invent certainty. @Bitget_AI #BitgetHackathon

## 最终帖模板

Introducing TradePremortem — an AI pre-trade failure lab for Bitget rTokens.

Before a human acts, it:
• builds a timestamped Bitget evidence ledger
• retrieves 3 historical analogs
• calculates P1/P5 stress loss, position limits and concentration
• asks AI for the strongest counter-case and falsifiers
• returns NO VERDICT when evidence is stale or incomplete

No wallet connection. No order execution. Human decides.

Demo: https://trade-premortem.onrender.com
Code: https://github.com/congge918/trade-premortem
Video: [URL]

Built for AI Trading Desk / Decision Stress Test.
@Bitget_AI #BitgetHackathon
