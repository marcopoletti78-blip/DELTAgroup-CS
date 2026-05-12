/**
 * Chiamate al proxy locale (/api/anthropic/messages) con retry su 429, 503, 529 e errori di rete.
 */

const DEFAULT_MAX_TOKENS = 8000;
const GENERATION_MAX_TOKENS = 16000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Messaggio errore in italiano per l'utente */
export function formatAnthropicError(status, payload) {
  const raw = payload?.error?.message || payload?.message || "";
  if (status === 413) {
    return "Richiesta troppo grande per il proxy. Riduci allegati o la dimensione del messaggio.";
  }
  if (status === 401 || status === 403) {
    return "Autenticazione API non riuscita. Verifica la chiave sul server (ANTHROPIC_API_KEY).";
  }
  if (status === 429) {
    return "Troppe richieste: limite di utilizzo raggiunto. Riprova tra qualche secondo.";
  }
  if (status === 529 || status === 503) {
    return "Il servizio AI è temporaneamente sovraccarico. Riprova tra poco.";
  }
  if (status >= 500) {
    return "Errore del server AI. Riprova più tardi.";
  }
  if (raw) return raw;
  return `Richiesta non riuscita (codice ${status || "sconosciuto"}).`;
}

/**
 * @param {object} body - corpo JSON come richiesto da Anthropic Messages API
 * @param {{ maxRetries?: number }} [opts]
 */
function isRetryableHttpStatus(status) {
  return status === 429 || status === 503 || status === 529;
}

export async function anthropicMessages(body, opts = {}) {
  const maxRetries = opts.maxRetries ?? 6;
  let delayMs = 1500;
  let lastErr = new Error("Richiesta non riuscita.");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let r;
    try {
      r = await fetch("/api/anthropic/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (netErr) {
      lastErr = netErr instanceof Error ? netErr : new Error(String(netErr));
      if (attempt < maxRetries - 1) {
        await sleep(delayMs);
        delayMs = Math.min(delayMs * 2, 60_000);
        continue;
      }
      throw new Error(
        "Connessione al proxy non riuscita. Avvia il proxy (npm run proxy o npm run dev) e verifica rete/firewall.",
      );
    }

    const d = await r.json().catch(() => ({}));

    if (isRetryableHttpStatus(r.status) && attempt < maxRetries - 1) {
      const retryAfter = Number(r.headers.get("retry-after"));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delayMs;
      await sleep(wait);
      delayMs = Math.min(delayMs * 2, 60_000);
      lastErr = new Error(formatAnthropicError(r.status, d));
      continue;
    }

    if (!r.ok) {
      throw new Error(formatAnthropicError(r.status, d));
    }

    const text = d.content?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error("Risposta AI senza testo utilizzabile.");
    }
    return text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  throw lastErr;
}

/**
 * Documento per il prompt: niente blob/base64 (logo, file, preview).
 * @param {object} data
 */
export function sanitizeDocumentForApi(data) {
  const clone =
    typeof structuredClone === "function"
      ? structuredClone(data)
      : JSON.parse(JSON.stringify(data));
  if (clone.logoEvento) {
    clone.logoEvento = "[LOGO_PRESENTE_NON_INCLUSO_NEL_PROMPT]";
  }
  if (Array.isArray(clone.allegato2Files)) {
    clone.allegato2Files = clone.allegato2Files.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
    }));
  }
  if (clone.s3 && clone.s3.evacuazionePiano) {
    const p = clone.s3.evacuazionePiano;
    clone.s3.evacuazionePiano = {
      id: p.id,
      name: p.name,
      type: p.type,
    };
  }
  return clone;
}

export { DEFAULT_MAX_TOKENS, GENERATION_MAX_TOKENS };
