const $ = (selector) => document.querySelector(selector);

const elements = {
  form: $("#proposal-form"),
  symbol: $("#symbol"),
  side: $("#side"),
  notional: $("#notional"),
  riskBudget: $("#risk-budget"),
  horizon: $("#horizon"),
  thesis: $("#thesis"),
  portfolio: $("#portfolio"),
  error: $("#form-error"),
  submit: $("#analyze-button"),
  live: $("#use-live"),
  replay: $("#use-replay"),
  scenarioButtons: $("#scenario-buttons"),
  empty: $("#report-empty"),
  report: $("#report")
};

let replays = [];
let activeReplayId = null;

const verdictCopy = {
  PROCEED_WITH_LIMITS: {
    title: "受限通过",
    stamp: "LIMITED",
    summary: "当前证据允许在计算出的仓位上限内继续研究；这不是买入建议。",
    className: "safe"
  },
  WAIT: {
    title: "暂缓交易",
    stamp: "WAIT",
    summary: "至少一个压力闸门被击穿。先降低风险或等待新证据，再由人类决定。",
    className: ""
  },
  INSUFFICIENT_EVIDENCE: {
    title: "证据不足",
    stamp: "NO VERDICT",
    summary: "证据无法满足时效或完整性要求。系统拒绝把缺失数据包装成结论。",
    className: "insufficient"
  }
};

const checkNames = {
  data_quality: "证据质量",
  risk_budget: "亏损预算",
  concentration: "组合集中度",
  session_gap: "休市偏离",
  event_risk: "公司事件"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
}

function formatMoney(value) {
  return Number.isFinite(value) ? `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} U` : "—";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

function shortHash(value) {
  return value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "—";
}

function setSource(mode) {
  const live = mode === "LIVE";
  activeReplayId = live ? null : activeReplayId || replays[0]?.id || null;
  elements.live.classList.toggle("active", live);
  elements.replay.classList.toggle("active", !live);
  document.querySelectorAll(".scenario-chip").forEach((button) => {
    button.classList.toggle("active", !live && button.dataset.id === activeReplayId);
  });
}

function applyReplay(replay, run = false) {
  activeReplayId = replay.id;
  elements.symbol.value = replay.proposal.symbol;
  elements.side.value = replay.proposal.side;
  elements.notional.value = replay.proposal.notionalUsdt;
  elements.riskBudget.value = replay.proposal.riskBudgetUsdt;
  elements.horizon.value = replay.proposal.horizonHours;
  elements.thesis.value = replay.proposal.thesis;
  elements.portfolio.value = JSON.stringify(replay.proposal.portfolio, null, 2);
  setSource("REPLAY");
  if (run) elements.form.requestSubmit();
}

function renderReplayButtons() {
  const labelByCategory = { concentration: "组合过载", gap: "休市偏离", baseline: "受限通过", stale: "过期拒答", event: "事件窗口" };
  elements.scenarioButtons.innerHTML = replays.map((replay) =>
    `<button type="button" class="scenario-chip" data-id="${escapeHtml(replay.id)}">${escapeHtml(labelByCategory[replay.category] || replay.title)}</button>`
  ).join("");
  elements.scenarioButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    const replay = replays.find((item) => item.id === button.dataset.id);
    if (replay) applyReplay(replay, true);
  });
}

function readProposal() {
  let portfolio;
  try {
    portfolio = JSON.parse(elements.portfolio.value);
  } catch {
    throw new Error("现有组合必须是有效 JSON。");
  }
  if (!Array.isArray(portfolio)) throw new Error("现有组合必须是数组。");
  return {
    symbol: elements.symbol.value,
    side: elements.side.value,
    notionalUsdt: Number(elements.notional.value),
    riskBudgetUsdt: Number(elements.riskBudget.value),
    horizonHours: Number(elements.horizon.value),
    thesis: elements.thesis.value.trim(),
    portfolio
  };
}

function drawChart(prices, referenceClose) {
  const svg = $("#price-chart");
  if (!prices.length) {
    svg.innerHTML = '<text x="20" y="90" class="chart-label">没有可用价格序列</text>';
    return;
  }
  const width = 720;
  const height = 180;
  const padding = 18;
  const min = Math.min(...prices, referenceClose);
  const max = Math.max(...prices, referenceClose);
  const spread = max - min || 1;
  const x = (index) => padding + index / Math.max(1, prices.length - 1) * (width - padding * 2);
  const y = (value) => height - padding - (value - min) / spread * (height - padding * 2);
  const points = prices.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const area = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
  const grids = [0.25, 0.5, 0.75].map((ratio) => `<line class="chart-grid" x1="${padding}" y1="${height * ratio}" x2="${width - padding}" y2="${height * ratio}"/>`).join("");
  svg.innerHTML = `
    <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b84c38" stop-opacity=".20"/><stop offset="1" stop-color="#b84c38" stop-opacity="0"/></linearGradient></defs>
    ${grids}
    <line class="chart-ref" x1="${padding}" y1="${y(referenceClose)}" x2="${width - padding}" y2="${y(referenceClose)}"/>
    <polygon class="chart-fill" points="${area}"/>
    <polyline class="chart-line" points="${points}"/>
    <text class="chart-label" x="${padding}" y="14">${max.toFixed(2)}</text>
    <text class="chart-label" x="${padding}" y="${height - 4}">${min.toFixed(2)}</text>
    <text class="chart-label" x="${width - 136}" y="${Math.max(13, y(referenceClose) - 6)}">参考收盘 ${referenceClose.toFixed(2)}</text>`;
}

function renderReport(report) {
  const copy = verdictCopy[report.verdict];
  elements.empty.hidden = true;
  elements.report.hidden = false;
  $("#report-mode").textContent = report.sourceMode;
  $("#report-mode").className = `mode-badge ${report.sourceMode.toLowerCase()}`;
  $("#verdict-title").textContent = copy.title;
  $("#verdict-summary").textContent = copy.summary;
  const stamp = $("#verdict-stamp");
  stamp.textContent = copy.stamp;
  stamp.className = `verdict-stamp ${copy.className}`;
  $("#metric-loss").textContent = formatMoney(report.metrics.stressLossUsdt);
  $("#metric-p1").textContent = `P1 不利波动 ${formatPercent(report.metrics.p1LossRate)}`;
  $("#metric-limit").textContent = formatMoney(report.metrics.recommendedMaxNotional);
  $("#metric-concentration").textContent = formatPercent(report.metrics.sectorConcentration);
  $("#metric-mad").textContent = Number.isFinite(report.metrics.offSessionMadScore) ? `${report.metrics.offSessionMadScore.toFixed(2)} MAD` : "—";
  $("#chart-caption").textContent = `${report.market.symbol} · ${report.market.session} · 最近 64 个一小时收盘`;
  drawChart(report.market.sparkline, report.market.referenceClose);
  const historicalAnalogs = report.historicalAnalogs || [];
  $("#analog-list").innerHTML = historicalAnalogs.length
    ? historicalAnalogs.map((item, index) => `
      <div class="analog-row">
        <span class="index">${String(index + 1).padStart(2, "0")}</span>
        <div><strong>${escapeHtml(formatDateTime(item.anchorAt))}</strong><small>当时状态变化 ${formatPercent(item.stateMove)}</small></div>
        <div><span>相似度</span><b>${formatPercent(item.similarity)}</b></div>
        <div><span>后续 ${report.proposal.horizonHours}H</span><b class="${item.forwardReturn < 0 ? "negative" : ""}">${formatPercent(item.forwardReturn)}</b></div>
      </div>`).join("")
    : '<p class="empty-copy">历史窗口不足，无法生成相似场景。</p>';
  $("#check-list").innerHTML = report.checks.map((check) => `
    <li><span class="check-icon ${check.passed ? "" : "fail"}">${check.passed ? "✓" : "×"}</span><b>${escapeHtml(checkNames[check.id] || check.id)}</b><small>${escapeHtml(check.detail)}</small></li>`).join("");
  $("#ai-provider").textContent = report.ai.generated ? report.ai.provider : "规则回退 · 未调用模型";
  $("#counterargument").textContent = report.ai.strongestCounterargument;
  $("#assumption-list").innerHTML = report.ai.hiddenAssumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("#falsifier-list").innerHTML = report.ai.falsifiers.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("#evidence-list").innerHTML = report.evidence.map((item, index) => `
    <div class="evidence-row">
      <span class="index">${String(index + 1).padStart(2, "0")}</span>
      <div class="evidence-name"><strong>${escapeHtml(item.title)}</strong>${item.summary ? `<small>${escapeHtml(item.summary)}</small>` : ""}</div>
      <time datetime="${escapeHtml(item.observedAt || "")}">${item.observedAt ? escapeHtml(new Date(item.observedAt).toLocaleString("zh-CN", { hour12: false })) : "时间缺失"}</time>
      <span class="evidence-kind ${item.freshness === "SCENARIO" ? "scenario" : ""}">${escapeHtml(item.freshness)} · ${escapeHtml(item.kind)}</span>
      <span></span><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.source)} ↗</a>
    </div>`).join("");
  $("#report-id").textContent = report.id;
  $("#source-hash").textContent = shortHash(report.baseSnapshotHash);
  $("#audit-hash").textContent = shortHash(report.auditHash);
  $("#report-warning").textContent = report.warnings.length ? report.warnings.join(" · ") : "未调用任何交易接口";
  elements.report.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function runAnalysis(event) {
  event?.preventDefault();
  elements.error.textContent = "";
  elements.submit.disabled = true;
  elements.submit.firstElementChild.textContent = "正在审讯证据…";
  try {
    const response = await fetch("/api/stress-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposal: readProposal(), replayId: activeReplayId })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `请求失败：${response.status}`);
    renderReport(payload.data);
  } catch (error) {
    elements.error.textContent = error.message;
  } finally {
    elements.submit.disabled = false;
    elements.submit.firstElementChild.textContent = "运行压力测试";
  }
}

async function boot() {
  elements.form.addEventListener("submit", runAnalysis);
  elements.live.addEventListener("click", () => setSource("LIVE"));
  elements.replay.addEventListener("click", () => {
    const replay = replays.find((item) => item.id === activeReplayId) || replays[0];
    if (replay) applyReplay(replay);
  });
  elements.symbol.addEventListener("change", () => {
    if (activeReplayId) setSource("LIVE");
  });
  $("#load-stale").addEventListener("click", () => {
    const stale = replays.find((item) => item.category === "stale");
    if (stale) applyReplay(stale, true);
  });
  try {
    const response = await fetch("/api/replays");
    const payload = await response.json();
    replays = payload.data || [];
    renderReplayButtons();
    const opening = replays.find((item) => item.category === "concentration") || replays[0];
    if (opening) applyReplay(opening, true);
  } catch (error) {
    elements.error.textContent = `无法载入演示案例：${error.message}`;
  }
}

boot();
