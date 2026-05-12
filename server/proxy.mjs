/**
 * Proxy minimale Anthropic: la chiave API resta solo sul server (variabile ANTHROPIC_API_KEY).
 * Avvio: ANTHROPIC_API_KEY=... node server/proxy.mjs
 * Porta predefinita 8787 (configurabile con PROXY_PORT).
 */
import http from "http";
import https from "https";

const PORT = Number(process.env.PROXY_PORT || 8787);
const API_KEY = process.env.ANTHROPIC_API_KEY;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function forwardToAnthropic(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Length": Buffer.byteLength(payload, "utf8"),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            resolve({ status: res.statusCode || 500, body: { error: { message: text || "Risposta non valida dall'API." } } });
            return;
          }
          resolve({ status: res.statusCode || 500, body: json });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/anthropic/messages") {
    if (!API_KEY) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: { message: "ANTHROPIC_API_KEY non configurata sul server." } }));
      return;
    }
    try {
      const body = await readBody(req);
      const { status, body: anthropicJson } = await forwardToAnthropic(body);
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(anthropicJson));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: { message: e.message || "Errore interno del proxy." } }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: { message: "Non trovato." } }));
});

server.listen(PORT, () => {
  console.log(`[DELTAgroup proxy] http://127.0.0.1:${PORT}  →  Anthropic /v1/messages`);
});
