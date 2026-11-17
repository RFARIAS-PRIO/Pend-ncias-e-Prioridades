import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUser } from "@/server/auth";
import { resolveSuggestion } from "@/server/ai/engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser(); if (!u) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const p = z.object({ decision: z.enum(["confirm", "reject"]) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Decisão inválida" }, { status: 400 });
  const r = await resolveSuggestion(u, (await params).id, p.data.decision);
  if (r.ok) revalidatePath("/", "layout");
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
