/** Abstração de provedor: a interface do site nunca fala direto com um fornecedor de IA. */
export interface AiMessage { role: "user" | "assistant"; content: string }
export interface AiRequest { system: string; messages: AiMessage[]; maxTokens?: number }
export interface AiProvider { name: string; model?: string; complete(req: AiRequest): Promise<string> }

const timeout = async <T,>(fn: (signal: AbortSignal) => Promise<T>, ms = 25_000) => {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fn(c.signal); } finally { clearTimeout(t); }
};

class AnthropicProvider implements AiProvider {
  name = "anthropic"; constructor(public model: string, private key: string) {}
  async complete(req: AiRequest) {
    return timeout(async (signal) => {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal, headers: { "content-type": "application/json", "x-api-key": this.key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: this.model, max_tokens: req.maxTokens ?? 1024, system: req.system, messages: req.messages }),
      });
      if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);
      const j = await r.json() as { content?: { type: string; text?: string }[] };
      return (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    });
  }
}
class OpenAiProvider implements AiProvider {
  name = "openai"; constructor(public model: string, private key: string, private base: string) {}
  async complete(req: AiRequest) {
    return timeout(async (signal) => {
      const r = await fetch(`${this.base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST", signal, headers: { "content-type": "application/json", authorization: `Bearer ${this.key}` },
        body: JSON.stringify({ model: this.model, max_tokens: req.maxTokens ?? 1024, messages: [{ role: "system", content: req.system }, ...req.messages] }),
      });
      if (!r.ok) throw new Error(`OpenAI-compatible HTTP ${r.status}`);
      const j = await r.json() as { choices?: { message?: { content?: string } }[] };
      return (j.choices?.[0]?.message?.content ?? "").trim();
    });
  }
}

/** Retorna null no modo "local" (sem dados enviados a terceiros) ou quando a configuração está incompleta. */
export function getProvider(env = process.env): AiProvider | null {
  const p = (env.AI_PROVIDER ?? "local").toLowerCase();
  if (p === "anthropic" && env.ANTHROPIC_API_KEY) return new AnthropicProvider(env.AI_MODEL || "claude-sonnet-5-5", env.ANTHROPIC_API_KEY);
  if (p === "openai" && env.OPENAI_API_KEY && env.AI_MODEL) return new OpenAiProvider(env.AI_MODEL, env.OPENAI_API_KEY, env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  return null;
}
export function aiProviderInfo() {
  const p = getProvider();
  return { name: p ? p.name : "local (regras + banco de dados)", model: p?.model, external: !!p };
}
