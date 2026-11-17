import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { Actor } from "./auth";

/** Filtro de pendências visíveis: admin vê tudo; demais veem seus projetos + pendências sem projeto. */
export async function visibleWhere(actor: Actor): Promise<Prisma.PendencyWhereInput> {
  if (actor.role === "ADMIN") return { deletedAt: null };
  const ms = await db.projectMember.findMany({ where: { userId: actor.id }, select: { projectId: true } });
  return { deletedAt: null, OR: [{ projectId: null }, { projectId: { in: ms.map((m) => m.projectId) } }] };
}
export async function visibleProjectIds(actor: Actor): Promise<string[] | "all"> {
  if (actor.role === "ADMIN") return "all";
  return (await db.projectMember.findMany({ where: { userId: actor.id }, select: { projectId: true } })).map((m) => m.projectId);
}
export async function canAccessProject(actor: Actor, projectId?: string | null) {
  if (!projectId || actor.role === "ADMIN") return true;
  return !!(await db.projectMember.findUnique({ where: { userId_projectId: { userId: actor.id, projectId } } }));
}
export async function myPersonId(actor: Actor): Promise<string | null> {
  return (await db.person.findUnique({ where: { userId: actor.id }, select: { id: true } }))?.id ?? null;
}
export async function audit(actor: Actor | null, action: string, entity?: string, entityId?: string, meta?: Prisma.InputJsonValue) {
  await db.auditLog.create({ data: { userId: actor?.id, action, entity, entityId, meta } }).catch(() => {});
}
