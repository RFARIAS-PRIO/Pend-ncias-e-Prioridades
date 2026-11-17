import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { visibleWhere } from "./access";
import type { Actor } from "./auth";

export interface Hit { id: string; number: number; title: string; status: string; priority: string; field: string; snippet: { before: string; match: string; after: string } | null }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function makeSnippet(text: string, q: string, radius = 70) {
  const i = norm(text).indexOf(norm(q));
  if (i < 0) return null;
  const s = Math.max(0, i - radius); const e = Math.min(text.length, i + q.length + radius);
  return { before: (s > 0 ? "…" : "") + text.slice(s, i), match: text.slice(i, i + q.length), after: text.slice(i + q.length, e) + (e < text.length ? "…" : "") };
}

export async function searchAll(actor: Actor, qRaw: string, limit = 60): Promise<Hit[]> {
  const q = qRaw.trim().slice(0, 100);
  if (q.length < 2) return [];
  const c = { contains: q, mode: "insensitive" as const };
  const n = Number(q.replace(/^(pnd-?|#)/i, ""));
  const or: Prisma.PendencyWhereInput[] = [
    { title: c }, { description: c }, { notes: c }, { nextAction: c }, { blockReason: c }, { tag: c }, { area: c }, { source: c },
    { supplier: { name: c } }, { project: { OR: [{ name: c }, { code: c }] } }, { asset: { name: c } }, { system: { name: c } },
    { equipment: { OR: [{ tag: c }, { name: c }] } }, { currentOwner: { name: c } }, { nextActionOwner: { name: c } },
    { involved: { some: { person: { name: c } } } }, { comments: { some: { body: c } } }, { history: { some: { OR: [{ note: c }, { oldValue: c }, { newValue: c }] } } },
    { references: { some: { OR: [{ label: c }, { code: c }, { url: c }] } } },
  ];
  if (Number.isInteger(n) && n > 0) or.push({ number: n });
  const rows = await db.pendency.findMany({
    where: { AND: [await visibleWhere(actor), { OR: or }] }, take: limit, orderBy: { updatedAt: "desc" },
    include: { supplier: true, project: true, asset: true, system: true, equipment: true, currentOwner: true, nextActionOwner: true, involved: { include: { person: true } }, comments: true, history: true, references: true },
  });
  return rows.map((p) => {
    const cands: [string, string | null | undefined][] = [
      ["Título", p.title], ["Descrição", p.description], ["TAG", p.tag], ["Próxima ação", p.nextAction], ["Bloqueio", p.blockReason], ["Observações", p.notes],
      ["Fornecedor", p.supplier?.name], ["Projeto", p.project ? `${p.project.code} ${p.project.name}` : null], ["Ativo", p.asset?.name], ["Sistema", p.system?.name],
      ["Equipamento", p.equipment ? `${p.equipment.tag} ${p.equipment.name}` : null], ["Pessoa", [p.currentOwner?.name, p.nextActionOwner?.name, ...p.involved.map((i) => i.person.name)].filter(Boolean).join(", ")],
      ["Área", p.area], ["Origem", p.source],
      ...p.references.map((r) => [r.kind === "RC" ? "RC" : r.kind === "PO" ? "PO" : r.kind === "DOCUMENT" ? "Documento" : "Link", `${r.label} ${r.code ?? ""} ${r.url ?? ""}`] as [string, string]),
      ...p.comments.map((x) => ["Comentário", x.body] as [string, string]), ...p.history.map((h) => ["Histórico", [h.note, h.oldValue, h.newValue].filter(Boolean).join(" · ")] as [string, string]),
    ];
    for (const [field, text] of cands) { if (text) { const s = makeSnippet(text, q); if (s) return { id: p.id, number: p.number, title: p.title, status: p.status, priority: p.priority, field, snippet: s }; } }
    return { id: p.id, number: p.number, title: p.title, status: p.status, priority: p.priority, field: p.number === n ? "ID" : "Correspondência", snippet: null };
  });
}
