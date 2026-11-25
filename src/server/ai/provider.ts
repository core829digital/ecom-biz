import "server-only";

/**
 * Talks to any OpenAI-compatible chat API (Google Gemini, Groq, OpenRouter, OpenAI, …).
 * Configure with environment variables only:
 *   AI_API_KEY    the provider key (required to enable the assistant)
 *   AI_BASE_URL   default: Google Gemini's OpenAI-compatible endpoint
 *   AI_MODEL      default: gemini-2.5-flash (check the provider's current model names)
 *   AI_DAILY_LIMIT messages per store per day (default 30)
 */
export const AI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
export const AI_DEFAULT_MODEL = "gemini-2.5-flash";

export function aiConfig() {
  const key = process.env.AI_API_KEY?.trim() ?? "";
  const baseUrl = (process.env.AI_BASE_URL?.trim() || AI_DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.AI_MODEL?.trim() || AI_DEFAULT_MODEL;
  const dailyLimit = Math.max(1, parseInt(process.env.AI_DAILY_LIMIT ?? "30", 10) || 30);
  const provider = /googleapis/.test(baseUrl) ? "Google Gemini" : /groq/.test(baseUrl) ? "Groq" : /openrouter/.test(baseUrl) ? "OpenRouter" : /anthropic/.test(baseUrl) ? "Anthropic" : /openai\.com/.test(baseUrl) ? "OpenAI" : new URL(baseUrl).host;
  return { enabled: !!key, key, baseUrl, model, dailyLimit, provider };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export type AiErrorCode = "not_configured" | "rate_limited" | "provider" | "timeout" | "auth" | "model" | "rejected";

export class AiError extends Error {
  /** Provider's own message (safe to show to platform admins, never to shoppers). */
  constructor(public code: AiErrorCode, public detail?: string) {
    super(detail ?? code);
  }
}

/** Short, single-line excerpt of a provider error body. Keys are never part of it. */
function errorDetail(status: number, body: string) {
  let msg = body;
  try {
    const j = JSON.parse(body) as { error?: { message?: string } | Array<{ error?: { message?: string } }> };
    const e = Array.isArray(j.error) ? j.error[0]?.error : Array.isArray(j) ? (j as { error?: { message?: string } }[])[0]?.error : j.error;
    if (e?.message) msg = e.message;
  } catch { /* not JSON */ }
  return `HTTP ${status}: ${msg.replace(/\s+/g, " ").slice(0, 280)}`;
}

/** One chat completion. Retries once on 429/5xx. Never logs prompts (they may contain business data). */
export async function chatCompletion(messages: ChatMessage[], tools: ToolSpec[]): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const cfg = aiConfig();
  if (!cfg.enabled) throw new AiError("not_configured");
  const body = JSON.stringify({ model: cfg.model, messages, tools: tools.length ? tools : undefined, temperature: 0.4 });
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
        body,
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if ((e as Error).name === "AbortError") throw new AiError("timeout");
      throw new AiError("provider", (e as Error).message);
    }
    clearTimeout(timer);
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (!res.ok) {
      const detail = errorDetail(res.status, await res.text().catch(() => ""));
      console.error(`[ai] provider error (${cfg.provider}, model ${cfg.model})`, detail);
      if (res.status === 429) throw new AiError("rate_limited", detail);
      if (res.status === 401 || res.status === 403) throw new AiError("auth", detail);
      if (res.status === 404) throw new AiError("model", detail);
      if (res.status === 400 || res.status === 422) throw new AiError("rejected", detail);
      throw new AiError("provider", detail);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
    const msg = json.choices?.[0]?.message;
    return { content: msg?.content ?? "", toolCalls: (msg?.tool_calls ?? []).filter((c) => c?.function?.name) };
  }
  throw new AiError("provider");
}
