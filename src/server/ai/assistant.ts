import "server-only";
import type { Prisma, Store } from "@prisma/client";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { aiConfig, chatCompletion, AiError, type AiErrorCode, type ChatMessage, type ToolCall } from "./provider";
import { runTool, toolSpecs, type ToolAction } from "./tools";

const MAX_TOOL_ROUNDS = 8;
const HISTORY = 30;

export type AssistantMessage = { id: string; role: "user" | "assistant"; content: string; actions: ToolAction[]; createdAt: string };

function systemPrompt(store: Store, memory: { profile: string; facts: string[] }) {
  const language = store.locale === "it" ? "Italian" : "English";
  return [
    `You are the e-commerce assistant inside ${env.platformName}, working for the merchant of the store "${store.name}" (currency ${store.currency}, country ${store.countryCode ?? "n/a"}).`,
    `Always answer in ${language}, warmly and concisely, like an expert e-commerce consultant. Use short paragraphs and lists.`,
    "You can act on the store with tools. Prefer doing over explaining: when the merchant asks for something a tool can do, do it, then summarise what you did and what they should check.",
    "Rules: everything you create is a draft for the merchant to review (products are drafts, the homepage goes to the site-editor draft, campaigns are drafts, discounts start inactive). Never claim you published, sent or activated anything. You cannot delete, issue refunds, send emails or see customers' personal data: say so if asked.",
    "Write real, specific, persuasive copy for this business. Never use placeholders like Lorem ipsum or [Product name]. Never invent facts the merchant did not give (materials, certifications, shipping times): ask or keep it generic.",
    "To build a store from scratch: ask at most 3 short questions (what they sell, to whom, style), then: create products, a collection, the homepage (design_homepage), the look (set_store_style), an About page, the store SEO, and remember the business profile.",
    "When the merchant tells you something lasting about the business (audience, tone, values, preferences), save it with remember.",
    memory.profile ? `Business profile:\n${memory.profile}` : "No business profile yet: learn it from the conversation and save it with remember(profile).",
    memory.facts.length ? `Things to remember:\n- ${memory.facts.join("\n- ")}` : "",
  ].filter(Boolean).join("\n\n");
}

async function loadMemory(storeId: string) {
  const m = await db.aiMemory.findUnique({ where: { storeId } });
  return { profile: m?.profile ?? "", facts: Array.isArray(m?.facts) ? (m!.facts as string[]).filter((f) => typeof f === "string") : [] };
}

/** Messages as the model sees them (tool calls and results included). */
async function history(conversationId: string): Promise<ChatMessage[]> {
  const rows = await db.aiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: HISTORY });
  const msgs = rows.reverse();
  // Never start with a tool result whose call was cut off.
  while (msgs.length && msgs[0].role === "tool") msgs.shift();
  return msgs.map((m): ChatMessage => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId ?? "", content: m.content };
    if (m.role === "assistant") return { role: "assistant", content: m.content || null, ...(m.toolCalls ? { tool_calls: m.toolCalls as unknown as ToolCall[] } : {}) };
    return { role: "user", content: m.content };
  });
}

export function toDisplay(m: { id: string; role: string; content: string; actions: Prisma.JsonValue | null; createdAt: Date }): AssistantMessage {
  return { id: m.id, role: m.role === "user" ? "user" : "assistant", content: m.content, actions: Array.isArray(m.actions) ? (m.actions as ToolAction[]) : [], createdAt: m.createdAt.toISOString() };
}

export class AssistantError extends Error {
  constructor(public code: AiErrorCode | "quota", public detail?: string) {
    super(code);
  }
}

/** One merchant message → tool calls as needed → final reply. Everything is persisted. */
export async function ask(store: Store, userId: string, conversationId: string | null, text: string, adminBase: string) {
  const cfg = aiConfig();
  if (!cfg.enabled) throw new AssistantError("not_configured");
  if (!(await rateLimit(`ai:${store.id}`, cfg.dailyLimit, 86400))) throw new AssistantError("quota");

  const conversation = conversationId
    ? await db.aiConversation.findFirst({ where: { id: conversationId, storeId: store.id, userId } })
    : null;
  const conv = conversation ?? (await db.aiConversation.create({ data: { storeId: store.id, userId, title: text.slice(0, 80) } }));
  await db.aiMessage.create({ data: { conversationId: conv.id, role: "user", content: text } });

  const memory = await loadMemory(store.id);
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(store, memory) }, ...(await history(conv.id))];
  const actions: ToolAction[] = [];
  const tools = toolSpecs();
  let reply = "";
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const out = await chatCompletion(messages, round < MAX_TOOL_ROUNDS ? tools : []);
      if (!out.toolCalls.length) {
        reply = out.content;
        break;
      }
      // Some providers return tool calls without ids: give each one, or the follow-up is rejected.
      out.toolCalls.forEach((c, i) => { if (!c.id) c.id = `call_${round}_${i}`; c.type = "function"; });
      messages.push({ role: "assistant", content: out.content || null, tool_calls: out.toolCalls });
      await db.aiMessage.create({ data: { conversationId: conv.id, role: "assistant", content: out.content ?? "", toolCalls: out.toolCalls as unknown as Prisma.InputJsonValue } });
      for (const call of out.toolCalls) {
        const res = await runTool(call.function.name, call.function.arguments, { store, userId, adminBase });
        if (res.action) actions.push(res.action);
        const content = JSON.stringify(res.result).slice(0, 12000);
        messages.push({ role: "tool", tool_call_id: call.id, content });
        await db.aiMessage.create({ data: { conversationId: conv.id, role: "tool", toolCallId: call.id, content } });
      }
    }
  } catch (e) {
    if (e instanceof AiError) throw new AssistantError(e.code, e.detail);
    throw e;
  }
  const saved = await db.aiMessage.create({ data: { conversationId: conv.id, role: "assistant", content: reply, actions: actions as unknown as Prisma.InputJsonValue } });
  await db.aiConversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });
  return { conversationId: conv.id, message: toDisplay(saved) };
}

/** Conversation for the chat panel: only what people should see (no tool plumbing). */
export async function loadConversation(storeId: string, userId: string, conversationId: string) {
  const conv = await db.aiConversation.findFirst({ where: { id: conversationId, storeId, userId } });
  if (!conv) return null;
  const rows = await db.aiMessage.findMany({ where: { conversationId, role: { in: ["user", "assistant"] } }, orderBy: { createdAt: "asc" }, take: 200 });
  return { id: conv.id, title: conv.title, messages: rows.filter((m) => m.role === "user" || m.content || (Array.isArray(m.actions) && m.actions.length)).map(toDisplay) };
}

/** Minimal request with the real tool list: tells a platform admin whether the configuration works. */
export async function testConnection(): Promise<{ ok: true; model: string; provider: string } | { ok: false; code: string; detail?: string }> {
  const cfg = aiConfig();
  try {
    await chatCompletion([{ role: "user", content: "Reply with the single word: ok" }], toolSpecs());
    return { ok: true, model: cfg.model, provider: cfg.provider };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, code: e.code, detail: e.detail };
    return { ok: false, code: "provider", detail: (e as Error).message };
  }
}

export async function usageToday(storeId: string) {
  const row = await db.rateLimit.findUnique({ where: { key: `ai:${storeId}` } }).catch(() => null);
  return { used: row && row.expiresAt > new Date() ? row.count : 0, limit: aiConfig().dailyLimit };
}
