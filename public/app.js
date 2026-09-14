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
let activeReportId = null;
let pollGeneration = 0;

const verdictCopy = {
  PROCEED_WITH_LIMITS: {
    title: "可以继续研究",
    stamp: "LIMITED",
    summary: "风险仍在你设定的亏损范围内。若继续，交易金额不要超过系统给出的上限。",
    className: "safe"
  },
  WAIT: {
    title: "先别下单",
    stamp: "WAIT",
    summary: "当前计划超过了至少一项风险限制。先减少金额或等待新数据，再重新检查。",
    className: ""
  },
  INSUFFICIENT_EVIDENCE: {
    title: "先补数据",
    stamp: "NO VERDICT",
    summary: "行情过期或关键信息缺失，系统无法可靠判断。更新数据后再试。",
    className: "insufficient"
  }
};

const checkNames = {
  data_quality: "数据是否够用",
  risk_budget: "亏损是否超出预算",
  concentration: "持仓是否过于集中",
  session_gap: "休市价格是否异常",
  event_risk: "近期是否有公司事件"
};

const freshnessNames = { LIVE: "实时", FRESH: "最新", REPLAY: "回放", SCENARIO: "情景", STALE: "过期" };
const evidenceKindNames = { FACT: "事实", INFERENCE: "推断" };

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
  const labelByCategory = { concentration: "科技股仓位太重", gap: "休市追高", baseline: "风险在预算内", stale: "行情已过期", event: "财报临近" };
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

function renderWarnings(report) {
  $("#report-warning").textContent = report.warnings?.length
    ? report.warnings.join(" · ")
    : "只生成研究报告，不连接钱包，也不会下单";
}

function renderAi(report) {
  const pending = Boolean(report.ai.pending);
  $("#ai-provider").textContent = pending
    ? "Qwen 正在寻找反方理由…"
    : report.ai.generated
      ? report.ai.provider
      : "规则生成 · 模型未参与";
  $("#counterargument").textContent = pending
    ? "风险结果已经生成。Qwen 正在补充反方理由，不影响上方计算。"
    : report.ai.strongestCounterargument;
  $("#assumption-list").innerHTML = report.ai.hiddenAssumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("#falsifier-list").innerHTML = report.ai.falsifiers.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function checkDetail(check, report) {
  if (check.id === "data_quality" && check.passed) return "价格、历史样本和采集时间都可用";
  if (check.id === "risk_budget" && Number.isFinite(report.metrics.recommendedMaxNotional)) {
    return `按亏损预算，金额上限是 ${formatMoney(report.metrics.recommendedMaxNotional)}`;
  }
  if (check.id === "concentration") return `交易后，同类资产占 ${formatPercent(report.metrics.sectorConcentration)}`;
  if (check.id === "session_gap" && Number.isFinite(report.metrics.offSessionMadScore)) {
    return `当前偏离为正常波动的 ${report.metrics.offSessionMadScore.toFixed(2)} 倍`;
  }
  return check.detail;
}

async function pollAi(reportId, generation) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    if (generation !== pollGeneration || reportId !== activeReportId) return;
    try {
      const response = await fetch(`/api/stress-tests/${encodeURIComponent(reportId)}`);
      if (!response.ok) return;
      const payload = await response.json();
      const report = payload.data;
      if (!report?.ai?.pending) {
        renderAi(report);
        renderWarnings(report);
        return;
      }
    } catch {
      return;
    }
  }
}

function renderReport(report) {
  activeReportId = report.id;
  const generation = ++pollGeneration;
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
  $("#metric-p1").textContent = `历史最差 1% 波动 ${formatPercent(report.metrics.p1LossRate)}`;
  $("#metric-limit").textContent = formatMoney(report.metrics.recommendedMaxNotional);
  $("#metric-concentration").textContent = formatPercent(report.metrics.sectorConcentration);
  $("#metric-mad").textContent = Number.isFinite(report.metrics.offSessionMadScore) ? `${report.metrics.offSessionMadScore.toFixed(2)} 倍` : "—";
  $("#chart-caption").textContent = `${report.market.symbol} · ${report.market.session} · 最近 64 个小时收盘价`;
  drawChart(report.market.sparkline, report.market.referenceClose);
  const historicalAnalogs = report.historicalAnalogs || [];
  $("#analog-list").innerHTML = historicalAnalogs.length
    ? historicalAnalogs.map((item, index) => `
      <div class="analog-row">
        <span class="index">${String(index + 1).padStart(2, "0")}</span>
        <div><strong>${escapeHtml(formatDateTime(item.anchorAt))}</strong><small>当时价格变化 ${formatPercent(item.stateMove)}</small></div>
        <div><span>相似度</span><b>${formatPercent(item.similarity)}</b></div>
        <div><span>之后 ${report.proposal.horizonHours} 小时</span><b class="${item.forwardReturn < 0 ? "negative" : ""}">${formatPercent(item.forwardReturn)}</b></div>
      </div>`).join("")
    : '<p class="empty-copy">历史窗口不足，无法生成相似场景。</p>';
  $("#check-list").innerHTML = report.checks.map((check) => `
    <li><span class="check-icon ${check.passed ? "" : "fail"}">${check.passed ? "✓" : "×"}</span><b>${escapeHtml(checkNames[check.id] || check.id)}</b><small>${escapeHtml(checkDetail(check, report))}</small></li>`).join("");
  renderAi(report);
  $("#evidence-list").innerHTML = report.evidence.map((item, index) => `
    <div class="evidence-row">
      <span class="index">${String(index + 1).padStart(2, "0")}</span>
      <div class="evidence-name"><strong>${escapeHtml(item.title)}</strong>${item.summary ? `<small>${escapeHtml(item.summary)}</small>` : ""}</div>
      <time datetime="${escapeHtml(item.observedAt || "")}">${item.observedAt ? escapeHtml(new Date(item.observedAt).toLocaleString("zh-CN", { hour12: false })) : "时间缺失"}</time>
      <span class="evidence-kind ${item.freshness === "SCENARIO" ? "scenario" : ""}">${escapeHtml(freshnessNames[item.freshness] || item.freshness)} · ${escapeHtml(evidenceKindNames[item.kind] || item.kind)}</span>
      <span></span><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.source)} ↗</a>
    </div>`).join("");
  $("#report-id").textContent = report.id;
  $("#source-hash").textContent = shortHash(report.baseSnapshotHash);
  $("#audit-hash").textContent = shortHash(report.auditHash);
  renderWarnings(report);
  if (report.ai.pending) void pollAi(report.id, generation);
  elements.report.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function runAnalysis(event) {
  event?.preventDefault();
  elements.error.textContent = "";
  elements.submit.disabled = true;
  elements.submit.firstElementChild.textContent = "正在计算风险…";
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
    elements.submit.firstElementChild.textContent = "检查这笔交易";
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
