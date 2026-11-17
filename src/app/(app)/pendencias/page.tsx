import Link from "next/link";
import { requireUser, canWrite } from "@/server/auth";
import { listPendencies } from "@/server/pendencies";
import { getLookups } from "@/server/lookups";
import { Checklist } from "@/components/checklist";
import { toDTO } from "@/lib/dto";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/constants";

export const metadata = { title: "Pendências" };
const VIEWS: [string, string][] = [["", "Todas abertas"], ["mine", "Dependem de mim"], ["today", "Hoje"], ["week", "Esta semana"], ["overdue", "Vencidas"], ["blocked", "Bloqueadas"], ["waiting", "Aguardando terceiros"], ["stale", "Sem atualização"], ["done", "Concluídas"]];

export default async function ListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const user = await requireUser();
  const sort = sp.sort ?? "score"; const dir = sp.dir === "asc" ? "asc" : "desc";
  const rows = await listPendencies(user, { ...sp, sort, dir: (sp.dir as "asc" | "desc") ?? (sort === "score" || sort === "updated" ? "desc" : "asc"), closed: sp.closed === "1" });
  const lookups = await getLookups(user);
  const base = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "sort" && k !== "dir") as [string, string][]).toString();
  const viewHref = (v: string) => { const q = new URLSearchParams(base); q.delete("view"); if (v) q.set("view", v); return `?${q}`; };
  const sel = (name: string, label: string, opts: { id: string; name: string }[]) => (
    <div><label className="label" htmlFor={name}>{label}</label><select id={name} name={name} defaultValue={sp[name] ?? ""} className="input"><option value="">Todos</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">Pendências <span className="text-base font-normal text-sub">({rows.length})</span></h1>
        {canWrite(user) && <Link href="/pendencias/nova" className="btn btn-primary">Nova pendência</Link>}</div>
      <nav className="flex flex-wrap gap-2" aria-label="Visões">{VIEWS.map(([v, l]) => <Link key={v} href={viewHref(v)} className={`chip ${(sp.view ?? "") === v ? "chip-on" : ""}`} aria-current={(sp.view ?? "") === v ? "true" : undefined}>{l}</Link>)}</nav>
      <form className="card grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8" aria-label="Filtros">
        {sp.view && <input type="hidden" name="view" value={sp.view} />}
        <div><label className="label" htmlFor="q">Texto / ID / TAG</label><input id="q" name="q" defaultValue={sp.q ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="priority">Prioridade</label><select id="priority" name="priority" defaultValue={sp.priority ?? ""} className="input"><option value="">Todas</option>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></div>
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">Todos</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
        {sel("projectId", "Projeto", lookups.projects)}{sel("assetId", "Ativo", lookups.assets)}{sel("supplierId", "Fornecedor", lookups.suppliers)}{sel("ownerId", "Responsável", lookups.people)}
        <div className="flex items-end gap-2"><button className="btn btn-primary">Filtrar</button><Link href="/pendencias" className="btn">Limpar</Link></div>
      </form>
      <Checklist rows={rows.map(toDTO)} people={lookups.people} canWrite={canWrite(user)} sort={sort} dir={dir} baseQuery={base} />
    </div>
  );
}
