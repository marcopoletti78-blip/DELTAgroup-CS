/**
 * Proxy minimale Anthropic: la chiave API resta solo sul server.
 *
 * Carica variabili da `.env` nella root del progetto (ANTHROPIC_API_KEY, opzionali PROXY_PORT, ANTHROPIC_OUTBOUND_TIMEOUT_MS).
 * Avvio: npm run proxy   oppure   npm run dev
 */
import http from "http";
import https from "https";
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "..", ".env") });

const PORT = Number(process.env.PROXY_PORT || 8787);
/** Chiave letta da process.env dopo dotenv (file .env o variabili d'ambiente del sistema) */
const API_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
/** Timeout socket richiesta → Anthropic (ms), default 120s */
const OUTBOUND_TIMEOUT_MS = Number(process.env.ANTHROPIC_OUTBOUND_TIMEOUT_MS || 120000);
const MAX_ANTHROPIC_RETRIES = Number(process.env.ANTHROPIC_PROXY_RETRIES || 4);

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableConnectionError(err) {
  const code = err?.code;
  if (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }
  const msg = String(err?.message || "");
  if (/ECONNABORTED|aborted|timeout|ETIMEDOUT|socket hang up/i.test(msg)) return true;
  return false;
}

/**
 * Una singola richiesta HTTPS verso Anthropic con timeout sul socket.
 */
function forwardToAnthropicOnce(body) {
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
        res.on("error", reject);
      },
    );

    req.setTimeout(OUTBOUND_TIMEOUT_MS, () => {
      req.destroy(new Error(`Timeout outbound Anthropic dopo ${OUTBOUND_TIMEOUT_MS}ms`));
    });

    req.on("error", reject);

    req.write(payload);
    req.end();
  });
}

async function forwardToAnthropicWithRetry(body) {
  let delayMs = 1500;
  let lastErr;
  for (let attempt = 0; attempt < MAX_ANTHROPIC_RETRIES; attempt++) {
    try {
      return await forwardToAnthropicOnce(body);
    } catch (e) {
      lastErr = e;
      const retry = isRetryableConnectionError(e) && attempt < MAX_ANTHROPIC_RETRIES - 1;
      console.warn(
        `[DELTAgroup proxy] Errore verso Anthropic (tentativo ${attempt + 1}/${MAX_ANTHROPIC_RETRIES}): ${e.code || ""} ${e.message || e}`,
      );
      if (!retry) break;
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }
  throw lastErr;
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
      res.end(
        JSON.stringify({
          error: {
            message:
              "ANTHROPIC_API_KEY non configurata. Aggiungi ANTHROPIC_API_KEY nel file .env nella root del progetto (stessa cartella di package.json) e riavvia il proxy.",
          },
        }),
      );
      return;
    }
    try {
      const body = await readBody(req);
      const { status, body: anthropicJson } = await forwardToAnthropicWithRetry(body);
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(anthropicJson));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: {
            message:
              e.message ||
              "Errore interno del proxy verso Anthropic. Controlla rete, firewall e che la chiave in .env sia valida.",
          },
        }),
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: { message: "Non trovato." } }));
});

/** Consenti richieste lunghe dal browser al proxy (generazioni lunghe) */
server.requestTimeout = 300_000;
server.headersTimeout = 310_000;

server.listen(PORT, () => {
  const keyHint = API_KEY ? `${API_KEY.slice(0, 10)}… (${API_KEY.length} caratteri)` : "NON CONFIGURATA";
  console.log(`[DELTAgroup proxy] http://127.0.0.1:${PORT}  →  Anthropic /v1/messages`);
  console.log(`[DELTAgroup proxy] .env caricato da: ${resolve(__dirname, "..", ".env")}`);
  console.log(`[DELTAgroup proxy] ANTHROPIC_API_KEY: ${keyHint}`);
  console.log(`[DELTAgroup proxy] Timeout outbound: ${OUTBOUND_TIMEOUT_MS}ms · Retry max: ${MAX_ANTHROPIC_RETRIES}`);
});
