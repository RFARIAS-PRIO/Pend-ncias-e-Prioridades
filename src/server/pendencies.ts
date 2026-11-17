import { Prisma, type Priority, type Status, type HistoryType } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { visibleWhere, canAccessProject, myPersonId, audit } from "./access";
import { canWrite, type Actor } from "./auth";
import { CLOSED, IMPACT, PRIORITIES, STATUSES, STATUS_LABEL, WAITING_THIRD_PARTY, type StatusKey } from "@/lib/constants";
import { addDays, endOfWeek, fmtDate, parseInputDate, startOfDay } from "@/lib/dates";
import { scorePendency, type PriorityResult } from "@/lib/priority";

export class ServiceError extends Error {
  constructor(message: string, public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "CONFLICT" = "INVALID") { super(message); }
}

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const optStr = z.preprocess(emptyToNull, z.string().trim().max(5000).nullable());
const optId = z.preprocess(emptyToNull, z.string().max(40).nullable());
const bool = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
const optDate = z.preprocess(emptyToNull, z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).nullable());

export const pendencySchema = z.object({
  title: z.string().trim().min(3, "Informe um título (mín. 3 caracteres)").max(200),
  description: optStr,
  status: z.enum(STATUSES),
  priority: z.enum(PRIORITIES),
  dueDate: optDate,
  projectId: optId, assetId: optId, systemId: optId, equipmentId: optId,
  tag: z.preprocess(emptyToNull, z.string().trim().max(60).nullable()),
  supplierId: optId,
  area: z.preprocess(emptyToNull, z.string().trim().max(80).nullable()),
  currentOwnerId: optId, nextActionOwnerId: optId,
  nextAction: optStr, blockReason: optStr,
  followUpDate: optDate,
  source: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()),
  notes: optStr,
  criticality: z.coerce.number().int().min(1).max(5),
  operationalImpact: z.enum(IMPACT), financialImpact: z.enum(IMPACT),
  safety: bool, shutdownImpact: bool,
  materialRelated: bool, mobilizationRelated: bool,
  involvedIds: z.array(z.string()).optional(),
});
export type PendencyInput = z.infer<typeof pendencySchema>;
export const pendencyPatchSchema = pendencySchema.partial();
export type PendencyPatch = z.infer<typeof pendencyPatchSchema>;

export const listInclude = {
  project: true, asset: true, supplier: true, currentOwner: true, nextActionOwner: true,
  blocks: { include: { to: { select: { id: true, number: true, title: true, status: true } } } },
  blockedBy: { include: { from: { select: { id: true, number: true, title: true, status: true } } } },
} satisfies Prisma.PendencyInclude;
export type PendencyRow = Prisma.PendencyGetPayload<{ include: typeof listInclude }> & {
  score: PriorityResult; dependentsCount: number; isBlocked: boolean; isOverdue: boolean; staleDays: number;
};

export function enrich<T extends Prisma.PendencyGetPayload<{ include: typeof listInclude }>>(p: T, now = new Date()): T & {
  score: PriorityResult; dependentsCount: number; isBlocked: boolean; isOverdue: boolean; staleDays: number;
} {
  const open = (s: string) => !CLOSED.includes(s as StatusKey);
  const dependentsCount = p.blocks.filter((d) => d.kind === "BLOCKS" && open(d.to.status)).length;
  const openBlockers = p.blockedBy.filter((d) => d.kind === "BLOCKS" && open(d.from.status)).length;
  const closed = !open(p.status);
  const isBlocked = !closed && (p.status === "BLOCKED" || openBlockers > 0 || !!p.blockReason);
  const isOverdue = !closed && !!p.dueDate && startOfDay(p.dueDate) < startOfDay(now);
  const staleDays = Math.floor((now.getTime() - p.updatedAt.getTime()) / 86_400_000);
  return { ...p, score: scorePendency({ ...p, dependentsCount }, now), dependentsCount, isBlocked, isOverdue, staleDays };
}

// ---------- consultas ----------
export interface ListFilters {
  q?: string; view?: string; priority?: string; status?: string; projectId?: string; assetId?: string;
  supplierId?: string; ownerId?: string; tag?: string; closed?: boolean; sort?: string; dir?: "asc" | "desc"; limit?: number;
}

export async function buildWhere(actor: Actor, f: ListFilters): Promise<Prisma.PendencyWhereInput> {
  const and: Prisma.PendencyWhereInput[] = [await visibleWhere(actor)];
  const now = new Date(); const today = startOfDay(now);
  if (!f.closed && f.view !== "done") and.push({ status: { notIn: CLOSED as Status[] } });
  if (f.q) {
    const n = Number(f.q.replace(/^(pnd-?|#)/i, ""));
    const or: Prisma.PendencyWhereInput[] = [
      { title: { contains: f.q, mode: "insensitive" } }, { tag: { contains: f.q, mode: "insensitive" } },
    ];
    if (Number.isInteger(n) && n > 0) or.push({ number: n });
    and.push({ OR: or });
  }
  switch (f.view) {
    case "today": and.push({ OR: [{ dueDate: { lt: addDays(today, 1) } }, { followUpDate: { lt: addDays(today, 1) } }] }); break;
    case "week": and.push({ OR: [{ dueDate: { lt: addDays(endOfWeek(now), 1) } }, { followUpDate: { lt: addDays(endOfWeek(now), 1) } }] }); break;
    case "overdue": and.push({ dueDate: { lt: today } }); break;
    case "blocked": and.push({ OR: [{ status: "BLOCKED" }, { blockReason: { not: null } }, { blockedBy: { some: { kind: "BLOCKS", from: { status: { notIn: CLOSED as Status[] } } } } }] }); break;
    case "waiting": and.push({ status: { in: WAITING_THIRD_PARTY as Status[] } }); break;
    case "stale": and.push({ updatedAt: { lt: addDays(now, -7) } }); break;
    case "done": and.push({ status: "DONE" }); break;
    case "mine": {
      const pid = await myPersonId(actor);
      and.push(pid ? { OR: [{ nextActionOwnerId: pid }, { nextActionOwnerId: null, currentOwnerId: pid }] } : { id: "__none__" });
      break;
    }
  }
  if (f.priority && PRIORITIES.includes(f.priority as never)) and.push({ priority: f.priority as Priority });
  if (f.status && STATUSES.includes(f.status as never)) and.push({ status: f.status as Status });
  if (f.projectId) and.push({ projectId: f.projectId });
  if (f.assetId) and.push({ assetId: f.assetId });
  if (f.supplierId) and.push({ supplierId: f.supplierId });
  if (f.tag) and.push({ tag: { equals: f.tag, mode: "insensitive" } });
  if (f.ownerId) and.push({ OR: [{ currentOwnerId: f.ownerId }, { nextActionOwnerId: f.ownerId }] });
  return { AND: and };
}

export async function listPendencies(actor: Actor, f: ListFilters = {}): Promise<PendencyRow[]> {
  const rows = await db.pendency.findMany({ where: await buildWhere(actor, f), include: listInclude, take: f.limit ?? 500 });
  const now = new Date();
  const out = rows.map((r) => enrich(r, now));
  const dir = f.dir === "desc" ? -1 : 1;
  const key = f.sort ?? "score";
  const cmp: Record<string, (a: PendencyRow, b: PendencyRow) => number> = {
    score: (a, b) => b.score.score - a.score.score,
    priority: (a, b) => a.priority.localeCompare(b.priority),
    due: (a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
    status: (a, b) => a.status.localeCompare(b.status),
    title: (a, b) => a.title.localeCompare(b.title),
    updated: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    number: (a, b) => a.number - b.number,
  };
  const fn = cmp[key] ?? cmp.score;
  // "score" e "updated" já são decrescentes por natureza; dir inverte a ordem padrão
  return out.sort((a, b) => fn(a, b) * (key === "score" || key === "updated" ? (f.dir === "asc" ? -1 : 1) : dir));
}

const detailInclude = {
  ...listInclude, system: true, equipment: true,
  involved: { include: { person: true } },
  comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
  history: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
  references: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.PendencyInclude;

export async function getPendency(actor: Actor, id: string) {
  const byNumber = /^\d+$/.test(id) ? [{ number: Number(id) }] : [];
  const p = await db.pendency.findFirst({
    where: { AND: [await visibleWhere(actor), { OR: [{ id }, ...byNumber] }] },
    include: detailInclude,
  });
  return p ? enrich(p) : null;
}

// ---------- escrita ----------
function assertWrite(actor: Actor) { if (!canWrite(actor)) throw new ServiceError("Seu perfil não permite alterações.", "FORBIDDEN"); }
const toDate = (v: string | Date | null | undefined) => (v instanceof Date ? v : parseInputDate(v ?? null));
const dateStr = (d?: Date | null) => (d ? fmtDate(d) : "—");

type Tx = Prisma.TransactionClient;
type HistExtra = Partial<{ field: string; oldValue: string | null; newValue: string | null; note: string | null; viaAi: boolean }>;
async function hist(tx: Tx, actor: Actor, pendencyId: string, type: HistoryType, extra: HistExtra = {}) {
  await tx.historyEntry.create({ data: { pendencyId, userId: actor.id, type, ...extra } });
}
async function nameMap(tx: Tx, p: PendencyPatch) {
  const m: Record<string, string> = {};
  const ids = (k: keyof PendencyPatch) => (typeof p[k] === "string" ? [p[k] as string] : []);
  const people = [...ids("currentOwnerId"), ...ids("nextActionOwnerId")];
  (await tx.person.findMany({ where: { id: { in: people } } })).forEach((x) => (m[x.id] = x.name));
  (await tx.project.findMany({ where: { id: { in: ids("projectId") } } })).forEach((x) => (m[x.id] = x.name));
  (await tx.asset.findMany({ where: { id: { in: ids("assetId") } } })).forEach((x) => (m[x.id] = x.name));
  (await tx.supplier.findMany({ where: { id: { in: ids("supplierId") } } })).forEach((x) => (m[x.id] = x.name));
  return m;
}
async function assertRefs(actor: Actor, p: PendencyPatch) {
  if (p.projectId && !(await canAccessProject(actor, p.projectId))) throw new ServiceError("Sem acesso ao projeto selecionado.", "FORBIDDEN");
}
async function notifyOwner(tx: Tx, actor: Actor, pendencyId: string, number: number, title: string, personId?: string | null) {
  if (!personId) return;
  const person = await tx.person.findUnique({ where: { id: personId } });
  if (person?.userId && person.userId !== actor.id) {
    await tx.notification.create({ data: { userId: person.userId, pendencyId, title: `PND-${number} atribuída a você`, body: title } });
  }
}

export async function createPendency(actor: Actor, raw: unknown, opts: { viaAi?: boolean } = {}) {
  assertWrite(actor);
  const parsed = pendencySchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError(parsed.error.issues.map((i) => i.message).join("; "));
  const { involvedIds, dueDate, followUpDate, ...d } = parsed.data;
  await assertRefs(actor, d);
  const p = await db.$transaction(async (tx) => {
    const created = await tx.pendency.create({
      data: {
        ...d, dueDate: toDate(dueDate), followUpDate: toDate(followUpDate),
        completedAt: d.status === "DONE" ? new Date() : null, createdById: actor.id, updatedById: actor.id,
        involved: involvedIds?.length ? { create: involvedIds.map((personId) => ({ personId })) } : undefined,
      },
    });
    await hist(tx, actor, created.id, "CREATED", { note: `Pendência criada com prioridade ${created.priority} e status ${STATUS_LABEL[created.status]}.`, viaAi: opts.viaAi });
    await notifyOwner(tx, actor, created.id, created.number, created.title, created.nextActionOwnerId);
    return created;
  });
  await audit(actor, "pendency.create", "Pendency", p.id);
  return p;
}

const FIELD_LABEL: Record<string, string> = {
  title: "Título", description: "Descrição", system: "Sistema", tag: "TAG", area: "Área", nextAction: "Próxima ação",
  source: "Origem", notes: "Observações", criticality: "Criticidade", operationalImpact: "Impacto operacional",
  financialImpact: "Impacto financeiro", safety: "Segurança", shutdownImpact: "Parada/GI", materialRelated: "Material",
  mobilizationRelated: "Embarque/mobilização", projectId: "Projeto", assetId: "Ativo", supplierId: "Fornecedor",
  followUpDate: "Data de acompanhamento", systemId: "Sistema", equipmentId: "Equipamento", blockReason: "Bloqueio",
};

/** Atualiza campos informados; cada mudança relevante gera uma entrada de histórico. */
export async function updatePendency(actor: Actor, id: string, raw: unknown, opts: { viaAi?: boolean; note?: string } = {}) {
  assertWrite(actor);
  const parsed = pendencyPatchSchema.safeParse(raw);
  if (!parsed.success) throw new ServiceError(parsed.error.issues.map((i) => i.message).join("; "));
  const patch = parsed.data;
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] }, include: { involved: true } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  await assertRefs(actor, patch);

  return db.$transaction(async (tx) => {
    const names = await nameMap(tx, patch);
    const nm = (id?: string | null) => (id ? names[id] ?? id : "—");
    const data: Prisma.PendencyUncheckedUpdateInput = { updatedById: actor.id };
    const entries: HistExtra[] = [];
    const types: HistoryType[] = [];
    const push = (t: HistoryType, e: HistExtra) => { types.push(t); entries.push(e); };
    const { involvedIds, dueDate, followUpDate, ...rest } = patch;

    for (const [k, v] of Object.entries(rest) as [keyof typeof rest, unknown][]) {
      if (v === undefined) continue;
      const old = (cur as Record<string, unknown>)[k];
      if (old === v) continue;
      (data as Record<string, unknown>)[k] = v;
      if (k === "status") {
        const ns = v as StatusKey;
        push("STATUS", { field: "Status", oldValue: STATUS_LABEL[cur.status], newValue: STATUS_LABEL[ns] });
        if (ns === "DONE") { data.completedAt = new Date(); }
        else if (cur.status === "DONE") { data.completedAt = null; }
      } else if (k === "priority") push("PRIORITY", { field: "Prioridade", oldValue: String(old), newValue: String(v) });
      else if (k === "currentOwnerId" || k === "nextActionOwnerId") {
        push("OWNER", { field: k === "currentOwnerId" ? "Responsável atual" : "Responsável pela próxima ação", oldValue: old ? (await tx.person.findUnique({ where: { id: String(old) } }))?.name ?? "—" : "—", newValue: nm(v as string | null) });
      } else if (k === "blockReason") push(v ? "BLOCK" : "UNBLOCK", { field: "Bloqueio", oldValue: (old as string) ?? null, newValue: (v as string) ?? null });
      else {
        const isRef = k === "projectId" || k === "assetId" || k === "supplierId";
        push("UPDATED", { field: FIELD_LABEL[k] ?? k, oldValue: isRef ? null : old == null ? null : String(old), newValue: isRef ? nm(v as string | null) : v == null ? null : String(v) });
      }
    }
    if (dueDate !== undefined) {
      const nd = toDate(dueDate);
      if ((cur.dueDate?.getTime() ?? null) !== (nd?.getTime() ?? null)) {
        data.dueDate = nd; push("DUE_DATE", { field: "Prazo", oldValue: dateStr(cur.dueDate), newValue: dateStr(nd), note: opts.note });
      }
    }
    if (followUpDate !== undefined) {
      const nf = toDate(followUpDate);
      if ((cur.followUpDate?.getTime() ?? null) !== (nf?.getTime() ?? null)) {
        data.followUpDate = nf; push("FOLLOW_UP", { field: "Acompanhamento", oldValue: dateStr(cur.followUpDate), newValue: dateStr(nf) });
      }
    }
    if (involvedIds) {
      await tx.pendencyInvolved.deleteMany({ where: { pendencyId: id } });
      if (involvedIds.length) await tx.pendencyInvolved.createMany({ data: involvedIds.map((personId) => ({ pendencyId: id, personId })) });
    }
    if (!entries.length && !involvedIds) return cur;
    const updated = await tx.pendency.update({ where: { id }, data });
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      await hist(tx, actor, id, types[i], { ...e, note: e.note ?? (i === 0 ? opts.note ?? null : null), viaAi: opts.viaAi });
    }
    if (patch.nextActionOwnerId && patch.nextActionOwnerId !== cur.nextActionOwnerId) await notifyOwner(tx, actor, id, cur.number, cur.title, patch.nextActionOwnerId);
    await audit(actor, "pendency.update", "Pendency", id, { fields: Object.keys(patch) });
    return updated;
  });
}

export async function completePendency(actor: Actor, id: string, evidence: string, opts: { viaAi?: boolean } = {}) {
  assertWrite(actor);
  const ev = evidence?.trim();
  if (!ev || ev.length < 3) throw new ServiceError("Informe uma breve evidência ou observação para concluir.");
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  if (cur.status === "DONE") throw new ServiceError("A pendência já está concluída.", "CONFLICT");
  return db.$transaction(async (tx) => {
    const u = await tx.pendency.update({ where: { id }, data: { status: "DONE", completedAt: new Date(), updatedById: actor.id, blockReason: null } });
    await hist(tx, actor, id, "COMPLETED", { field: "Status", oldValue: STATUS_LABEL[cur.status], newValue: STATUS_LABEL.DONE, note: ev, viaAi: opts.viaAi });
    return u;
  });
}

export async function reopenPendency(actor: Actor, id: string, note?: string) {
  assertWrite(actor);
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  if (!CLOSED.includes(cur.status as StatusKey)) throw new ServiceError("A pendência já está aberta.", "CONFLICT");
  return db.$transaction(async (tx) => {
    const u = await tx.pendency.update({ where: { id }, data: { status: "OPEN", completedAt: null, updatedById: actor.id } });
    await hist(tx, actor, id, "REOPENED", { field: "Status", oldValue: STATUS_LABEL[cur.status], newValue: STATUS_LABEL.OPEN, note: note?.trim() || null });
    return u;
  });
}

export async function cancelPendency(actor: Actor, id: string, reason: string) {
  assertWrite(actor);
  if (!reason?.trim() || reason.trim().length < 3) throw new ServiceError("Informe o motivo do cancelamento.");
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  if (cur.status === "CANCELED") throw new ServiceError("A pendência já está cancelada.", "CONFLICT");
  return db.$transaction(async (tx) => {
    const u = await tx.pendency.update({ where: { id }, data: { status: "CANCELED", updatedById: actor.id } });
    await hist(tx, actor, id, "CANCELED", { field: "Status", oldValue: STATUS_LABEL[cur.status], newValue: STATUS_LABEL.CANCELED, note: reason.trim() });
    return u;
  });
}

export async function addComment(actor: Actor, id: string, body: string, opts: { viaAi?: boolean } = {}) {
  assertWrite(actor);
  const text = body?.trim();
  if (!text) throw new ServiceError("O comentário não pode ser vazio.");
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] }, select: { id: true } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  return db.$transaction(async (tx) => {
    const c = await tx.comment.create({ data: { pendencyId: id, authorId: actor.id, body: text.slice(0, 5000), viaAi: !!opts.viaAi } });
    await tx.pendency.update({ where: { id }, data: { updatedById: actor.id } }); // atualiza updatedAt
    await hist(tx, actor, id, "COMMENT", { note: text.slice(0, 500), viaAi: opts.viaAi });
    return c;
  });
}

/** Registra atualização/andamento; opcionalmente ajusta data de acompanhamento e conta como cobrança. */
export async function addUpdate(actor: Actor, id: string, input: { text: string; followUpDate?: string | null; chase?: boolean }, opts: { viaAi?: boolean } = {}) {
  assertWrite(actor);
  const text = input.text?.trim();
  if (!text) throw new ServiceError("Descreva a atualização.");
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  return db.$transaction(async (tx) => {
    const fu = input.followUpDate ? parseInputDate(input.followUpDate) : undefined;
    await tx.pendency.update({ where: { id }, data: { updatedById: actor.id, ...(fu ? { followUpDate: fu } : {}), ...(input.chase ? { chaseCount: { increment: 1 } } : {}) } });
    await tx.comment.create({ data: { pendencyId: id, authorId: actor.id, body: text, viaAi: !!opts.viaAi } });
    await hist(tx, actor, id, "UPDATE", { note: text.slice(0, 500), viaAi: opts.viaAi });
    if (fu) await hist(tx, actor, id, "FOLLOW_UP", { field: "Acompanhamento", oldValue: dateStr(cur.followUpDate), newValue: dateStr(fu), viaAi: opts.viaAi });
    if (input.chase) await hist(tx, actor, id, "UPDATED", { field: "Cobranças", oldValue: String(cur.chaseCount), newValue: String(cur.chaseCount + 1), viaAi: opts.viaAi });
  });
}

export async function addBlock(actor: Actor, id: string, reason: string, blockerId?: string | null) {
  assertWrite(actor);
  if (!reason?.trim()) throw new ServiceError("Descreva o bloqueio ou a dependência.");
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  await updatePendency(actor, id, { status: "BLOCKED", blockReason: reason.trim() });
  if (blockerId) await addDependency(actor, blockerId, id, "BLOCKS");
}

export async function removeBlock(actor: Actor, id: string, note?: string) {
  assertWrite(actor);
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  await updatePendency(actor, id, { status: cur.status === "BLOCKED" ? "IN_PROGRESS" : cur.status, blockReason: null }, { note });
}

async function wouldCycle(fromId: string, toId: string): Promise<boolean> {
  // fromId bloqueia toId; ciclo se toId já (transitivamente) bloqueia fromId
  const seen = new Set<string>(); const stack = [toId];
  while (stack.length) {
    const n = stack.pop()!; if (n === fromId) return true;
    if (seen.has(n)) continue; seen.add(n);
    (await db.dependency.findMany({ where: { fromId: n, kind: "BLOCKS" }, select: { toId: true } })).forEach((d) => stack.push(d.toId));
  }
  return false;
}

export async function addDependency(actor: Actor, fromId: string, toId: string, kind: "BLOCKS" | "RELATED" = "BLOCKS") {
  assertWrite(actor);
  if (fromId === toId) throw new ServiceError("Uma pendência não pode depender dela mesma.");
  const vis = await visibleWhere(actor);
  const both = await db.pendency.findMany({ where: { AND: [vis, { id: { in: [fromId, toId] } }] }, select: { id: true, number: true } });
  if (both.length !== 2) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  if (kind === "BLOCKS" && (await wouldCycle(fromId, toId))) throw new ServiceError("Essa dependência criaria um ciclo.", "CONFLICT");
  const num = Object.fromEntries(both.map((b) => [b.id, b.number]));
  await db.$transaction(async (tx) => {
    try { await tx.dependency.create({ data: { fromId, toId, kind } }); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ServiceError("Vínculo já existe.", "CONFLICT"); throw e; }
    const txt = kind === "BLOCKS" ? `PND-${num[fromId]} bloqueia PND-${num[toId]}` : `PND-${num[fromId]} relacionada a PND-${num[toId]}`;
    await hist(tx, actor, fromId, "DEPENDENCY", { note: txt });
    await hist(tx, actor, toId, "DEPENDENCY", { note: txt });
  });
}
export async function removeDependency(actor: Actor, depId: string) {
  assertWrite(actor);
  const d = await db.dependency.findUnique({ where: { id: depId }, include: { from: true, to: true } });
  if (!d) throw new ServiceError("Vínculo não encontrado.", "NOT_FOUND");
  await db.$transaction(async (tx) => {
    await tx.dependency.delete({ where: { id: depId } });
    const txt = `Vínculo removido: PND-${d.from.number} → PND-${d.to.number}`;
    await hist(tx, actor, d.fromId, "DEPENDENCY", { note: txt });
    await hist(tx, actor, d.toId, "DEPENDENCY", { note: txt });
  });
}

export async function addReference(actor: Actor, id: string, input: { kind: "LINK" | "RC" | "PO" | "DOCUMENT"; label: string; url?: string; code?: string }) {
  assertWrite(actor);
  const label = input.label?.trim();
  if (!label) throw new ServiceError("Informe um nome para a referência.");
  if (input.url && !/^https?:\/\//i.test(input.url)) throw new ServiceError("O link deve começar com http:// ou https://");
  const cur = await db.pendency.findFirst({ where: { AND: [await visibleWhere(actor), { id }] }, select: { id: true } });
  if (!cur) throw new ServiceError("Pendência não encontrada.", "NOT_FOUND");
  await db.$transaction(async (tx) => {
    await tx.reference.create({ data: { pendencyId: id, kind: input.kind, label, url: input.url || null, code: input.code?.trim() || null } });
    await hist(tx, actor, id, "REFERENCE", { note: `${input.kind}: ${label}${input.code ? ` (${input.code})` : ""}` });
  });
}

export const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
  status: z.enum(STATUSES).optional(), priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), nextActionOwnerId: z.string().optional(),
  confirmed: z.literal(true, "Confirmação obrigatória para ações em lote."),
});
export async function bulkUpdate(actor: Actor, raw: unknown) {
  assertWrite(actor);
  const p = bulkSchema.safeParse(raw);
  if (!p.success) throw new ServiceError(p.error.issues.map((i) => i.message).join("; "));
  const { ids, confirmed: _c, ...patch } = p.data;
  if (patch.status === "DONE") throw new ServiceError("Para concluir é necessária evidência individual por item.");
  if (!Object.keys(patch).length) throw new ServiceError("Nenhuma alteração informada.");
  let n = 0;
  for (const id of ids) { await updatePendency(actor, id, patch, { note: "Atualização em lote" }); n++; }
  await audit(actor, "pendency.bulk", "Pendency", undefined, { ids, patch });
  return n;
}
