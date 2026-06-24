const accountsEl = document.querySelector("#accounts");
const statusEl = document.querySelector("#status");
const refreshEl = document.querySelector("#refresh");
const loginResultEl = document.querySelector("#login-result");
const loginActionsEl = document.querySelector(".login-actions");

let refreshTimer = null;
let renderedLoginAccounts = "";

function fmtDate(value) {
  if (!value) return "未開始または不明";
  const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(ms)) return "不明";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function fmtUntil(value) {
  if (!value) return "不明";
  const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(ms)) return "不明";
  const remainingMs = ms - Date.now();
  if (remainingMs <= 0) return "まもなく更新";
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return "あと" + days + "日" + hours + "時間";
  if (hours > 0) return "あと" + hours + "時間" + minutes + "分";
  return "あと" + minutes + "分";
}

function pct(value) {
  return typeof value === "number" ? Math.round(value * 10) / 10 : null;
}

function windowName(window, fallback) {
  if (!window?.windowDurationMins) return fallback;
  if (window.windowDurationMins === 300) return "5時間の使用制限";
  if (window.windowDurationMins === 10080) return "週間利用上限";
  return window.windowDurationMins + "分の使用制限";
}

function limitView(title, window) {
  if (!window) return "";
  const used = pct(window.usedPercent) ?? 0;
  const remaining = pct(window.remainingPercent) ?? Math.max(0, 100 - used);
  const cls = remaining <= 5 ? "bad" : remaining <= 15 ? "warn" : "";
  return [
    '<div class="limit">',
    '<div class="limit-title"><span>' + escapeHtml(title) + '</span><span>' + remaining + '% 残り</span></div>',
    '<div class="bar"><span class="' + cls + '" style="width:' + Math.max(0, Math.min(100, remaining)) + '%"></span></div>',
    '<div class="details">',
    '<span>使用済み</span><span>' + used + '%</span>',
    '<span>リセット</span><span>' + escapeHtml(fmtDate(window.resetsAt)) + '</span>',
    '<span>解除まで</span><span>' + escapeHtml(fmtUntil(window.resetsAt)) + '</span>',
    '</div>',
    '</div>',
  ].join("");
}

function accountView(account) {
  if (!account.ok) {
    return [
      '<article class="card error-card">',
      '<h2>' + escapeHtml(account.label || account.id) + '</h2>',
      '<p class="meta">取得失敗 / 再ログインが必要です</p>',
      '<p class="error">' + escapeHtml(account.error || "Unknown error") + '</p>',
      '</article>',
    ].join("");
  }

  const limit = account.rateLimits || {};
  const plan = account.account?.planType || limit.planType || "plan unknown";
  const credits = limit.credits
    ? '<p class="credits">クレジット: ' + escapeHtml(String(limit.credits.balance ?? "0")) + (limit.credits.unlimited ? " / unlimited" : "") + "</p>"
    : "";

  return [
    '<article class="card">',
    '<h2>' + escapeHtml(account.label || account.id) + '</h2>',
    '<p class="meta">' + escapeHtml(plan) + ' / ' + (account.account?.hasEmail ? "account connected" : "email hidden") + '</p>',
    limitView(windowName(limit.primary, "5時間の使用制限"), limit.primary),
    limitView(windowName(limit.secondary, "週間利用上限"), limit.secondary),
    credits,
    '</article>',
  ].join("");
}

function renderLoginActions(accounts) {
  const key = accounts.map((account) => account.id + ":" + (account.label || "")).join("|");
  if (key === renderedLoginAccounts) return;
  renderedLoginAccounts = key;
  if (!accounts.length) {
    loginActionsEl.innerHTML = '<span class="meta">アカウントが未設定です。</span>';
    return;
  }
  loginActionsEl.innerHTML = accounts
    .map((account) => {
      const id = escapeHtml(account.id);
      const label = escapeHtml(account.label || account.id);
      return '<button class="login-code" type="button" data-account="' + id + '">' + label + "</button>";
    })
    .join("");
  for (const button of loginActionsEl.querySelectorAll(".login-code")) {
    button.addEventListener("click", () => createLoginCode(button.dataset.account, button));
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function load() {
  refreshEl.disabled = true;
  statusEl.textContent = "Refreshing...";
  try {
    const response = await fetch("api/usage", { cache: "no-store" });
    const data = await response.json();
    if (!data.ok && data.error) {
      statusEl.textContent = data.error;
    } else {
      statusEl.textContent = "最終更新: " + fmtDate(data.fetchedAt);
    }
    const accounts = data.accounts || [];
    renderLoginActions(accounts);
    accountsEl.innerHTML = accounts.map(accountView).join("") || '<p class="status">アカウントが未設定です。</p>';
    if (refreshTimer) clearTimeout(refreshTimer);
    const seconds = Math.max(30, data.refreshSeconds || 60);
    refreshTimer = setTimeout(load, seconds * 1000);
  } catch (error) {
    statusEl.textContent = "取得失敗: " + error.message;
  } finally {
    refreshEl.disabled = false;
  }
}

refreshEl.addEventListener("click", load);
loadConfiguredAccounts();
load();

async function loadConfiguredAccounts() {
  try {
    const response = await fetch("api/accounts", { cache: "no-store" });
    const data = await response.json();
    if (data.ok) renderLoginActions(data.accounts || []);
  } catch {
    loginActionsEl.innerHTML = '<span class="meta">アカウント一覧を取得できませんでした。</span>';
  }
}

async function createLoginCode(account, button) {
  button.disabled = true;
  loginResultEl.hidden = false;
  loginResultEl.innerHTML = '<p class="meta">ログインコードを発行中です...</p>';
  try {
    const response = await fetch("api/login-code?account=" + encodeURIComponent(account), { cache: "no-store" });
    const data = await response.json();
    if (!data.ok) {
      loginResultEl.innerHTML = '<p class="error">' + escapeHtml(data.error || "ログインコードを発行できませんでした") + "</p>";
      return;
    }
    loginResultEl.innerHTML = [
      '<p class="meta">' + escapeHtml(data.label) + ' / ' + escapeHtml(data.generatedAt) + '</p>',
      '<p><a href="' + escapeHtml(data.url) + '" target="_blank" rel="noreferrer">OpenAI Codex device loginを開く</a></p>',
      '<p class="login-code-value">' + escapeHtml(data.code) + '</p>',
      '<p class="meta">このコードを開いたページに入力してください。完了後、Refreshで残量を確認できます。</p>',
    ].join("");
  } catch (error) {
    loginResultEl.innerHTML = '<p class="error">取得失敗: ' + escapeHtml(error.message) + "</p>";
  } finally {
    button.disabled = false;
  }
}
