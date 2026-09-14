# Evaluation — updated 2026-09-14

## Public deployment QA — 2026-09-11

- Demo: https://trade-premortem.onrender.com
- Render health check: `ok=true`, `executionEnabled=false`.
- Public replay catalog: 5 demo stories across `RNVDAUSDT`, `RAAPLUSDT`, `RGOOGLUSDT`, and `RCOINUSDT`.
- Browser-verified verdict paths: `WAIT`, `INSUFFICIENT_EVIDENCE`, and `PROCEED_WITH_LIMITS`.
- Browser-verified live Bitget path: six evidence items labeled `LIVE · FACT`, including ticker, candles, market state, market calendar, instrument state, and company overview.
- Qwen is not yet configured on Render; the UI truthfully labels deterministic fallback as `规则回退 · 未调用模型`.

## 结论

TradePremortem 的确定性主链路已达到提交前最低标准。以下数字来自本地脚本实际输出，不包含人工补写结果。

| 指标 | 结果 | 目标 |
| --- | ---: | ---: |
| 固定案例数 | 16 | 16 |
| 判决与核心原因一致率 | 100% | 100% |
| 有效案例证据字段完整率 | 100% | 100% |
| 全体案例证据字段完整率 | 97.5% | ≥95% |
| 情景注入正确标注率 | 100% | 100% |
| 过期/缺失数据阻断率 | 100% | 100% |
| 错误宣称完成 | 0 | 0 |
| 历史相似场景覆盖率 | 100% | 100% |
| 唯一真实来源快照 | 4 | 4 |
| 唯一审计哈希 | 16/16 | 16/16 |

运行命令：

```bash
npm test
npm run evaluate
```

## 验证矩阵

四个 rToken：`rAAPLUSDT`、`rNVDAUSDT`、`rGOOGLUSDT`、`rCOINUSDT`。

每个资产包含四类案例：

1. 休市偏离：应返回 `WAIT`，并包含 `OFF_SESSION_GAP`。
2. 公司事件：应返回 `WAIT`，并包含 `EVENT_RISK`。
3. 组合集中：应返回 `WAIT`，并包含 `CONCENTRATION`。
4. 过期/缺失：应返回 `INSUFFICIENT_EVIDENCE`，并包含 `STALE_TICKER` 和 `MISSING_TIME`。

四个基础快照于 2026-09-13 从 Bitget 公开 UTA v3 / Reality API 采集，每个包含 400 根一小时 K 线、9 条来源证据与独立 SHA-256。休市偏离、事件窗口和过期证据等变换均额外标记为 `SCENARIO · INFERENCE`。

故意缺失 `effectiveAt` 的四个拒答案例使全体证据字段完整率为 97.5%。有效案例仍为 100%；缺失字段是拒答测试输入，不是未处理的遗漏。

每个案例还会返回 3 个历史相似窗口，匹配只使用锚点之前的状态变化和波动率；后续同持有期收益仅用于压力类比。

## 尚未完成的验证

- 千问与普通 LLM 使用相同证据包的对照实验：赛期额度已发放，等待 Render Secret 配置与公开部署验收。
- 至少 3 名真实测试者的无引导可用性测试：尚未执行。
- 新版公开部署后的桌面、手机和隐身窗口复核。

这些项目未完成前不会写成已验证，也不会填入提交表单的“验证结果”。
