import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/server/auth";
import { chat, loadConversation } from "@/server/ai/engine";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const body = z.object({ message: z.string().trim().min(1, "Mensagem vazia").max(1000, "Mensagem longa demais (máx. 1000)"), conversationId: z.string().max(40).nullish() });

export async function GET() {
  const u = await getUser(); if (!u) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json(await loadConversation(u));
}
export async function POST(req: Request) {
  const u = await getUser(); if (!u) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const limit = Number(process.env.CHAT_RATE_LIMIT_PER_MIN ?? 20);
  const rl = rateLimit(`chat:${u.id}`, Number.isFinite(limit) && limit > 0 ? limit : 20);
  if (!rl.ok) return NextResponse.json({ error: `Limite de mensagens atingido. Tente em ${rl.retryAfter}s.` }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try { return NextResponse.json(await chat(u, parsed.data.message, parsed.data.conversationId)); }
  catch (e) { console.error("[api/chat]", e); return NextResponse.json({ error: "Erro ao processar a mensagem." }, { status: 500 }); }
}
