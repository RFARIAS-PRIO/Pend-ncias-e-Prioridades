import Link from "next/link";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { visibleWhere } from "@/server/access";
import { HISTORY_LABEL } from "@/lib/constants";
import { fmtDateTime } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { markNotificationsRead } from "@/app/notifications";

export const metadata = { title: "Histórico de atividades" };
const TYPES = Object.keys(HISTORY_LABEL);
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const sp = await searchParams; const user = await requireUser();
  const page = Math.max(1, Number(sp.page) || 1); const take = 50;
  const where = { pendency: await visibleWhere(user), ...(sp.type && TYPES.includes(sp.type) ? { type: sp.type as never } : {}) };
  const [rows, total, notes] = await Promise.all([
    db.historyEntry.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: (page - 1) * take, include: { user: { select: { name: true } }, pendency: { select: { id: true, number: true, title: true } } } }),
    db.historyEntry.count({ where }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10, include: { pendency: { select: { id: true } } } }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Histórico de atividades</h1>
      {notes.length > 0 && <section className="card p-3" aria-label="Notificações"><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Notificações</h2>
        <form action={markNotificationsRead}><button className="btn btn-sm">Marcar como lidas</button></form></div>
        <ul className="space-y-1 text-sm">{notes.map((n) => <li key={n.id} className={n.read ? "text-sub" : "font-medium"}>{n.read ? "" : "● "}{n.pendency ? <Link href={`/pendencias/${n.pendency.id}`} className="hover:underline">{n.title}</Link> : n.title} <span className="text-xs text-sub">— {fmtDateTime(n.createdAt)}</span></li>)}</ul></section>}
      <nav className="flex flex-wrap gap-2" aria-label="Tipo">{[["", "Todos"], ...TYPES.map((t) => [t, HISTORY_LABEL[t]])].map(([t, l]) => <Link key={t} href={t ? `?type=${t}` : "?"} className={`chip ${(sp.type ?? "") === t ? "chip-on" : ""}`}>{l}</Link>)}</nav>
      {rows.length === 0 ? <EmptyState title="Sem atividades" /> : (
        <div className="card overflow-x-auto"><table><thead><tr><th>Quando</th><th>Quem</th><th>Pendência</th><th>Tipo</th><th>Detalhe</th></tr></thead><tbody>
          {rows.map((h) => <tr key={h.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(h.createdAt)}</td><td className="text-xs">{h.user?.name ?? "Sistema"}{h.viaAi ? " (assistente)" : ""}</td>
            <td><Link href={`/pendencias/${h.pendency.id}`} className="hover:underline">PND-{h.pendency.number} · {h.pendency.title.slice(0, 50)}</Link></td><td><span className="tag bg-muted">{HISTORY_LABEL[h.type]}</span></td>
            <td className="text-xs">{h.field ? <>{h.field}: <s className="text-sub">{h.oldValue ?? "—"}</s> → <b>{h.newValue ?? "—"}</b> </> : null}{h.note}</td></tr>)}</tbody></table></div>)}
      <div className="flex justify-between text-sm"><span className="text-sub">{total} registros</span><span className="flex gap-2">{page > 1 && <Link className="btn btn-sm" href={`?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), page: String(page - 1) })}`}>← Anterior</Link>}{page * take < total && <Link className="btn btn-sm" href={`?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), page: String(page + 1) })}`}>Próxima →</Link>}</span></div>
    </div>
  );
}
