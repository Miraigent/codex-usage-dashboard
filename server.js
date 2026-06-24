const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = __dirname;
const CWD_CONFIG_PATH = path.join(process.cwd(), "config.json");
const CONFIG_PATH =
  process.env.CODEX_USAGE_DASHBOARD_CONFIG ||
  (fs.existsSync(CWD_CONFIG_PATH) ? CWD_CONFIG_PATH : path.join(ROOT, "config.json"));
const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 8787,
  refreshSeconds: 60,
  accounts: [],
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      ...DEFAULT_CONFIG,
      configMissing: true,
      configPath: CONFIG_PATH,
    };
  }

  const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    configPath: CONFIG_PATH,
  };
}

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body, null, 2));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": data.length,
  });
  res.end(data);
}

function staticFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store",
      "content-length": data.length,
    });
    res.end(data);
  });
}

function redactError(message) {
  return String(message || "")
    .replace(/[A-Za-z0-9_-]{32,}/g, "<redacted>")
    .slice(0, 1200);
}

function basicAuthConfig() {
  const username = process.env.CODEX_USAGE_DASHBOARD_BASIC_USER || "";
  const password = process.env.CODEX_USAGE_DASHBOARD_BASIC_PASSWORD || "";
  if (!username || !password) return null;
  return { username, password };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function unauthorized(res) {
  res.writeHead(401, {
    "www-authenticate": 'Basic realm="Codex Usage Dashboard", charset="UTF-8"',
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end("Authentication required");
}

function isAuthorized(req) {
  const auth = basicAuthConfig();
  if (!auth) return true;
  const header = req.headers.authorization || "";
  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return safeEqual(username, auth.username) && safeEqual(password, auth.password);
}

function normalizeWindow(window) {
  if (!window) return null;
  const usedPercent = typeof window.usedPercent === "number" ? window.usedPercent : null;
  return {
    usedPercent,
    remainingPercent: typeof usedPercent === "number" ? Math.max(0, Math.round((100 - usedPercent) * 100) / 100) : null,
    resetsAt: window.resetsAt || null,
    windowDurationMins: window.windowDurationMins || null,
  };
}

function normalizeLimit(limit) {
  if (!limit) return null;
  return {
    limitId: limit.limitId || null,
    limitName: limit.limitName || null,
    planType: limit.planType || null,
    primary: normalizeWindow(limit.primary),
    secondary: normalizeWindow(limit.secondary),
    credits: limit.credits
      ? {
          hasCredits: Boolean(limit.credits.hasCredits),
          unlimited: Boolean(limit.credits.unlimited),
          balance: limit.credits.balance ?? null,
        }
      : null,
    individualLimit: limit.individualLimit || null,
    rateLimitReachedType: limit.rateLimitReachedType || null,
  };
}

function normalizeAccount(accountResponse) {
  const account = accountResponse?.account || null;
  return {
    type: account?.type || null,
    planType: account?.planType || null,
    hasEmail: Boolean(account?.email),
    requiresOpenaiAuth: Boolean(accountResponse?.requiresOpenaiAuth),
  };
}

function findAccount(id) {
  const config = loadConfig();
  if (config.configMissing) {
    return null;
  }
  return config.accounts.find((account, index) => (account.id || "account-" + (index + 1)) === id) || null;
}

function configuredAccounts() {
  const config = loadConfig();
  if (config.configMissing) return [];
  return config.accounts.map((account, index) => ({
    id: account.id || "account-" + (index + 1),
    label: account.label || account.id || "Account " + (index + 1),
  }));
}

function createCodexEnv(account) {
  const env = { ...process.env };
  if (account.codexHome) {
    env.CODEX_HOME = account.codexHome;
  }
  return env;
}

function requestCodex(account) {
  const codexCommand = account.codexCommand || "codex";
  const env = createCodexEnv(account);

  const child = spawn(codexCommand, ["app-server", "--stdio"], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let buffer = "";
  let stderr = "";
  let nextId = 1;
  const pending = new Map();

  const cleanup = () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
    }
    pending.clear();
    if (!child.killed) child.kill();
  };

  function send(method, params = {}, timeoutMs = 15000) {
    const id = nextId++;
    child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(method + " timed out"));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
    });
  }

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof message.id !== "number") continue;
      const item = pending.get(message.id);
      if (!item) continue;
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) {
        item.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        item.resolve(message.result);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  return new Promise((resolve) => {
    child.once("error", (error) => {
      cleanup();
      resolve({ ok: false, error: redactError(error.message) });
    });

    (async () => {
      try {
        await send("initialize", {
          clientInfo: {
            name: "violet-codex-usage-dashboard",
            title: "Violet Codex Usage Dashboard",
            version: "0.1.0",
          },
          capabilities: {
            experimentalApi: true,
          },
        });
        const [accountInfo, limits] = await Promise.all([
          send("account/read", { refreshToken: false }),
          send("account/rateLimits/read", {}),
        ]);
        cleanup();
        resolve({
          ok: true,
          id: account.id,
          label: account.label || account.id,
          account: normalizeAccount(accountInfo),
          rateLimits: normalizeLimit(limits?.rateLimits),
          rateLimitsByLimitId: Object.fromEntries(
            Object.entries(limits?.rateLimitsByLimitId || {}).map(([key, value]) => [key, normalizeLimit(value)]),
          ),
          fetchedAt: new Date().toISOString(),
        });
      } catch (error) {
        cleanup();
        resolve({
          ok: false,
          id: account.id,
          label: account.label || account.id,
          error: redactError(error.message),
          stderr: redactError(stderr),
          fetchedAt: new Date().toISOString(),
        });
      }
    })();
  });
}

function createLoginCode(account) {
  const codexCommand = account.codexCommand || "codex";
  const codexHome = account.codexHome || path.join(process.env.HOME || process.cwd(), ".codex");
  const child = spawn("python3", [path.join(ROOT, "scripts", "codex-device-code.py"), account.id, codexCommand, codexHome], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let output = "";
  let settled = false;

  function parseLoginOutput(text) {
    try {
      const parsed = JSON.parse(text.trim().split("\n").at(-1));
      return {
        ...parsed,
        label: account.label || account.id,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (!child.killed) child.kill();
      resolve({ ok: false, account: account.id, error: "login code generation timed out" });
    }, 10000);

    function onData(chunk) {
      output += chunk.toString("utf8");
      const parsed = parseLoginOutput(output);
      if (!parsed || settled) return;
      settled = true;
      clearTimeout(timer);
      if (!child.killed) child.kill();
      resolve(parsed);
    }

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, account: account.id, error: redactError(error.message) });
    });
    child.once("exit", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, account: account.id, error: "codex login exited before producing a code" });
    });
  });
}

async function usage() {
  const config = loadConfig();
  if (config.configMissing) {
    return {
      ok: false,
      error: "config.json が見つかりません。config.example.json を config.json にコピーして、アカウントを設定してください。 / config.json is missing. Copy config.example.json to config.json and configure accounts.",
      configPath: config.configPath,
      accounts: [],
    };
  }

  const accounts = await Promise.all(
    config.accounts.map((account, index) =>
      requestCodex({
        ...account,
        id: account.id || "account-" + (index + 1),
      }),
    ),
  );

  return {
    ok: accounts.every((account) => account.ok),
    refreshSeconds: config.refreshSeconds,
    fetchedAt: new Date().toISOString(),
    accounts,
  };
}

const server = http.createServer(async (req, res) => {
  if (!isAuthorized(req)) {
    unauthorized(res);
    return;
  }

  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/" || url.pathname === "/index.html") {
    staticFile(res, path.join(ROOT, "public", "index.html"), "text/html; charset=utf-8");
    return;
  }
  if (url.pathname === "/app.js") {
    staticFile(res, path.join(ROOT, "public", "app.js"), "application/javascript; charset=utf-8");
    return;
  }
  if (url.pathname === "/style.css") {
    staticFile(res, path.join(ROOT, "public", "style.css"), "text/css; charset=utf-8");
    return;
  }
  if (url.pathname === "/api/usage") {
    try {
      json(res, 200, await usage());
    } catch (error) {
      json(res, 500, { ok: false, error: redactError(error.message) });
    }
    return;
  }
  if (url.pathname === "/api/accounts") {
    json(res, 200, { ok: true, accounts: configuredAccounts() });
    return;
  }
  if (url.pathname === "/api/login-code") {
    const accountId = url.searchParams.get("account") || "";
    const account = findAccount(accountId);
    if (!account) {
      json(res, 404, { ok: false, error: "不明なアカウントです / Unknown account" });
      return;
    }
    try {
      json(res, 200, await createLoginCode({ ...account, id: accountId }));
    } catch (error) {
      json(res, 500, { ok: false, error: redactError(error.message) });
    }
    return;
  }
  json(res, 404, { ok: false, error: "Not found" });
});

const config = loadConfig();
server.listen(config.port, config.host, () => {
  console.log("Codex usage dashboard listening on http://" + config.host + ":" + config.port);
  if (config.configMissing) {
    console.log("Missing config: copy " + path.join(ROOT, "config.example.json") + " to " + CONFIG_PATH);
  }
});
