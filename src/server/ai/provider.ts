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

export class AiError extends Error {
  constructor(public code: "not_configured" | "rate_limited" | "provider" | "timeout", detail?: string) {
    super(detail ?? code);
  }
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
    if (res.status === 429) throw new AiError("rate_limited");
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`[ai] provider error ${res.status}`, detail);
      throw new AiError("provider", `HTTP ${res.status}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
    const msg = json.choices?.[0]?.message;
    return { content: msg?.content ?? "", toolCalls: (msg?.tool_calls ?? []).filter((c) => c?.function?.name) };
  }
  throw new AiError("provider");
}
