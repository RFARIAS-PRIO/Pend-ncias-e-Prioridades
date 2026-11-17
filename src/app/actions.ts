"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/access";
import { checkPassword, endSession, hashPassword, requireAdmin, requireUser, startSession } from "@/server/auth";
import * as svc from "@/server/pendencies";
import { rateLimit } from "@/lib/rate-limit";
import { PRIORITIES, STATUSES } from "@/lib/constants";

export type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof svc.ServiceError) return { ok: false, error: e.message };
    console.error("[action]", e);
    return { ok: false, error: "Erro inesperado. Tente novamente." };
  }
}

// ---------- autenticação ----------
export async function loginAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse({ email: String(fd.get("email") ?? "").trim().toLowerCase(), password: fd.get("password") });
  if (!parsed.success) return { error: "Informe e-mail e senha válidos." };
  const rl = rateLimit(`login:${parsed.data.email}`, 8, 5 * 60_000);
  if (!rl.ok) return { error: `Muitas tentativas. Aguarde ${rl.retryAfter}s.` };
  const u = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!u || !u.active || !(await checkPassword(parsed.data.password, u.passwordHash))) {
    await audit(null, "login.failed", "User", undefined, { email: parsed.data.email });
    return { error: "Credenciais inválidas." };
  }
  await startSession(u.id);
  await audit({ id: u.id, name: u.name, email: u.email, role: u.role }, "login.ok", "User", u.id);
  redirect("/");
}
export async function logoutAction() { await endSession(); redirect("/login"); }

export async function changePasswordAction(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireUser();
  const cur = String(fd.get("current") ?? ""); const next = String(fd.get("next") ?? "");
  if (next.length < 10) return { error: "A nova senha deve ter ao menos 10 caracteres." };
  const u = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await checkPassword(cur, u.passwordHash))) return { error: "Senha atual incorreta." };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(actor, "password.change", "User", u.id);
  return { ok: true };
}

// ---------- pendências ----------
function formToObject(fd: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (k !== "involvedIds" && k !== "id") o[k] = v;
  for (const b of ["safety", "shutdownImpact", "materialRelated", "mobilizationRelated"]) o[b] = fd.get(b) === "on";
  o.involvedIds = fd.getAll("involvedIds").map(String);
  return o;
}
export async function savePendencyAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const actor = await requireUser();
  const id = String(fd.get("id") ?? "");
  let target: string;
  try {
    if (id) { await svc.updatePendency(actor, id, formToObject(fd)); target = id; }
    else target = (await svc.createPendency(actor, formToObject(fd))).id;
  } catch (e) {
    if (e instanceof svc.ServiceError) return { error: e.message };
    console.error(e); return { error: "Erro inesperado ao salvar." };
  }
  revalidatePath("/", "layout");
  redirect(`/pendencias/${target}`);
}

const quickSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), id: z.string(), value: z.enum(STATUSES).refine((s) => s !== "DONE", "Use \"Concluir\" para registrar evidência."), note: z.string().optional() }),
  z.object({ action: z.literal("priority"), id: z.string(), value: z.enum(PRIORITIES), note: z.string().optional() }),
  z.object({ action: z.literal("due"), id: z.string(), value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().optional() }),
  z.object({ action: z.literal("owner"), id: z.string(), value: z.string() }),
  z.object({ action: z.literal("update"), id: z.string(), text: z.string(), followUpDate: z.string().optional(), chase: z.boolean().optional() }),
  z.object({ action: z.literal("comment"), id: z.string(), text: z.string() }),
  z.object({ action: z.literal("block"), id: z.string(), reason: z.string(), blockerId: z.string().optional() }),
  z.object({ action: z.literal("unblock"), id: z.string(), note: z.string().optional() }),
  z.object({ action: z.literal("complete"), id: z.string(), evidence: z.string() }),
  z.object({ action: z.literal("reopen"), id: z.string(), note: z.string().optional() }),
  z.object({ action: z.literal("cancel"), id: z.string(), reason: z.string() }),
]);
export type QuickInput = z.infer<typeof quickSchema>;

export async function quickAction(input: QuickInput): Promise<Result> {
  const actor = await requireUser();
  const p = quickSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos." };
  const a = p.data;
  return run(async () => {
    switch (a.action) {
      case "status": await svc.updatePendency(actor, a.id, { status: a.value }, { note: a.note }); break;
      case "priority": await svc.updatePendency(actor, a.id, { priority: a.value }, { note: a.note }); break;
      case "due": await svc.updatePendency(actor, a.id, { dueDate: a.value }, { note: a.note }); break;
      case "owner": await svc.updatePendency(actor, a.id, { nextActionOwnerId: a.value || null }); break;
      case "update": await svc.addUpdate(actor, a.id, a); break;
      case "comment": await svc.addComment(actor, a.id, a.text); break;
      case "block": await svc.addBlock(actor, a.id, a.reason, a.blockerId || null); break;
      case "unblock": await svc.removeBlock(actor, a.id, a.note); break;
      case "complete": await svc.completePendency(actor, a.id, a.evidence); break;
      case "reopen": await svc.reopenPendency(actor, a.id, a.note); break;
      case "cancel": await svc.cancelPendency(actor, a.id, a.reason); break;
    }
  });
}
export async function bulkAction(input: unknown): Promise<Result<number>> {
  const actor = await requireUser();
  return run(() => svc.bulkUpdate(actor, input));
}
export async function addDependencyAction(fromId: string, toId: string, kind: "BLOCKS" | "RELATED"): Promise<Result> {
  const actor = await requireUser();
  return run(() => svc.addDependency(actor, fromId, toId, kind));
}
export async function removeDependencyAction(depId: string): Promise<Result> {
  const actor = await requireUser();
  return run(() => svc.removeDependency(actor, depId));
}
export async function addReferenceAction(id: string, input: { kind: "LINK" | "RC" | "PO" | "DOCUMENT"; label: string; url?: string; code?: string }): Promise<Result> {
  const actor = await requireUser();
  return run(() => svc.addReference(actor, id, input));
}

// ---------- cadastros ----------
const nameSchema = z.string().trim().min(2, "Informe um nome (mín. 2 caracteres).").max(120);
export async function createCatalogAction(kind: "supplier" | "person" | "asset" | "project", data: Record<string, string>): Promise<Result> {
  const actor = await requireUser();
  if (actor.role === "VIEWER") return { ok: false, error: "Seu perfil não permite alterações." };
  const n = nameSchema.safeParse(data.name);
  if (!n.success) return { ok: false, error: n.error.issues[0].message };
  return run(async () => {
    const nz = (v?: string) => (v?.trim() ? v.trim() : null);
    if (kind === "supplier") await db.supplier.create({ data: { name: n.data, contact: nz(data.contact), email: nz(data.email), phone: nz(data.phone) } });
    if (kind === "person") await db.person.create({ data: { name: n.data, email: nz(data.email), area: nz(data.area), supplierId: nz(data.supplierId) } });
    if (kind === "asset") await db.asset.create({ data: { name: n.data, description: nz(data.description) } });
    if (kind === "project") {
      if (!data.code?.trim()) throw new svc.ServiceError("Informe um código para o projeto.");
      const pr = await db.project.create({ data: { code: data.code.trim(), name: n.data, description: nz(data.description), assetId: nz(data.assetId) } });
      if (actor.role !== "ADMIN") await db.projectMember.create({ data: { userId: actor.id, projectId: pr.id } });
    }
    await audit(actor, `${kind}.create`, kind, undefined, { name: n.data });
  }).catch(() => ({ ok: false as const, error: "Não foi possível salvar (nome/código duplicado?)." }));
}

// ---------- administração ----------
export async function saveUserAction(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireAdmin();
  const s = z.object({
    id: z.string().optional(), name: nameSchema, email: z.string().email("E-mail inválido."),
    role: z.enum(["ADMIN", "EDITOR", "VIEWER"]), active: z.boolean(), password: z.string().optional(),
  }).safeParse({ id: String(fd.get("id") ?? "") || undefined, name: fd.get("name"), email: String(fd.get("email") ?? "").toLowerCase(), role: fd.get("role"), active: fd.get("active") === "on", password: String(fd.get("password") ?? "") || undefined });
  if (!s.success) return { error: s.error.issues[0].message };
  const d = s.data; const projectIds = fd.getAll("projectIds").map(String);
  if (!d.id && (!d.password || d.password.length < 10)) return { error: "Defina uma senha com ao menos 10 caracteres." };
  if (d.password && d.password.length < 10) return { error: "A senha deve ter ao menos 10 caracteres." };
  if (d.id === actor.id && (d.role !== "ADMIN" || !d.active)) return { error: "Você não pode remover seu próprio acesso de administrador." };
  try {
    const passwordHash = d.password ? await hashPassword(d.password) : undefined;
    const u = d.id
      ? await db.user.update({ where: { id: d.id }, data: { name: d.name, email: d.email, role: d.role, active: d.active, ...(passwordHash ? { passwordHash } : {}) } })
      : await db.user.create({ data: { name: d.name, email: d.email, role: d.role, active: d.active, passwordHash: passwordHash! } });
    await db.projectMember.deleteMany({ where: { userId: u.id } });
    if (projectIds.length) await db.projectMember.createMany({ data: projectIds.map((projectId) => ({ userId: u.id, projectId })) });
    await db.person.upsert({ where: { userId: u.id }, update: { name: u.name }, create: { name: u.name, userId: u.id, email: u.email } });
    await audit(actor, d.id ? "user.update" : "user.create", "User", u.id, { role: d.role, active: d.active });
  } catch { return { error: "Não foi possível salvar (e-mail já em uso?)." }; }
  revalidatePath("/admin/usuarios");
  return { ok: true };
}
