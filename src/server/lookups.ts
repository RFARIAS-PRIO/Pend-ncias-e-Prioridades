import { db } from "./db";
import { visibleProjectIds } from "./access";
import type { Actor } from "./auth";

export async function getLookups(actor: Actor) {
  const ids = await visibleProjectIds(actor);
  const [projects, assets, systems, equipments, suppliers, people] = await Promise.all([
    db.project.findMany({ where: { deletedAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.asset.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.system.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, asset: { select: { name: true } } } }),
    db.equipment.findMany({ orderBy: { tag: "asc" }, select: { id: true, tag: true, name: true } }),
    db.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.person.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    projects: projects.map((p) => ({ id: p.id, name: `${p.code} · ${p.name}` })), assets,
    systems: systems.map((s) => ({ id: s.id, name: `${s.name}${s.asset ? ` (${s.asset.name})` : ""}` })),
    equipments: equipments.map((e) => ({ id: e.id, name: e.name, tag: e.tag })), suppliers, people,
  };
}
