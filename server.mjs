import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createStressTest, findStressTest, getReplayList } from "./src/service.mjs";

const publicRoot = fileURLToPath(new URL("./public/", import.meta.url));
const port = Number(process.env.PORT || 4318);
const host = process.env.HOST || "0.0.0.0";
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

function json(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) throw new TypeError("request body exceeds 256 KB");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new TypeError("request body must be valid JSON");
  }
}

function publicPath(pathname) {
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const safe = normalize(requested).replace(/^(\.\.(\\|\/|$))+/, "");
  const resolved = join(publicRoot, safe);
  return resolved.startsWith(publicRoot) ? resolved : null;
}

async function serveStatic(pathname, response) {
  const file = publicPath(pathname);
  if (!file) return false;
  try {
    await access(file);
    if (!(await stat(file)).isFile()) return false;
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(file)] || "application/octet-stream",
      "Cache-Control": extname(file) === ".html" ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    });
    createReadStream(file).pipe(response);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json(response, 200, {
        ok: true,
        service: "TradePremortem",
        qwenConfigured: Boolean(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY),
        executionEnabled: false
      });
    }
    if (request.method === "GET" && url.pathname === "/api/replays") {
      return json(response, 200, { data: getReplayList() });
    }
    if (request.method === "POST" && url.pathname === "/api/stress-tests") {
      return json(response, 201, { data: await createStressTest(await readJson(request)) });
    }
    const match = url.pathname.match(/^\/api\/stress-tests\/([0-9a-f-]+)$/i);
    if (request.method === "GET" && match) {
      const report = findStressTest(match[1]);
      return report ? json(response, 200, { data: report }) : json(response, 404, { error: "report not found" });
    }
    if (request.method === "GET" && await serveStatic(url.pathname, response)) return;
    json(response, 404, { error: "not found" });
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 502;
    json(response, status, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`TradePremortem listening on http://127.0.0.1:${port}`);
});
