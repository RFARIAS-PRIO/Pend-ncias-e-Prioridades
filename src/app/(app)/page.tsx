import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listPendencies, type PendencyRow } from "@/server/pendencies";
import { myPersonId } from "@/server/access";
import { getLookups } from "@/server/lookups";
import { PriorityBadge } from "@/components/badges";
import { STATUS_LABEL, WAITING_THIRD_PARTY, type StatusKey } from "@/lib/constants";
import { addDays, fmtDateShort, relativeDue, startOfDay } from "@/lib/dates";

export const metadata = { title: "Command Center" };

function MiniList({ title, href, rows, empty, extra }: { title: string; href: string; rows: PendencyRow[]; empty: string; extra?: (r: PendencyRow) => React.ReactNode }) {
  return (
    <section className="card flex flex-col" aria-label={title}>
      <header className="flex items-center justify-between border-b border-line px-3 py-2"><h2 className="text-sm font-semibold">{title} <span className="text-sub">({rows.length})</span></h2><Link href={href} className="text-xs text-brand hover:underline">ver todas</Link></header>
      {rows.length === 0 ? <p className="p-3 text-sm text-sub">{empty}</p> : (
        <ul className="divide-y divide-line">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id} className="flex items-start gap-2 px-3 py-2 text-sm">
              <PriorityBadge p={r.priority} />
              <div className="min-w-0 flex-1"><Link href={`/pendencias/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                <div className="text-xs text-sub">PND-{r.number} · {r.project?.name ?? r.asset?.name ?? "sem projeto"}{extra ? ` · ${extra(r)}` : ""}</div></div>
              <div className="whitespace-nowrap text-right text-xs">{r.dueDate ? <span className={r.isOverdue ? "font-semibold text-red-700 dark:text-red-300" : "text-sub"}>{fmtDateShort(r.dueDate)}</span> : null}</div>
            </li>))}
        </ul>)}
    </section>
  );
}

function Bars({ title, data, href }: { title: string; data: [string, number, string?][]; href?: (k: string) => string }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <section className="card p-3" aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {data.length === 0 ? <p className="text-sm text-sub">Sem dados.</p> : (
        <ul className="space-y-1.5">{data.map(([label, n, key]) => (
          <li key={label} className="text-xs"><div className="mb-0.5 flex justify-between gap-2"><span className="truncate">{key && href ? <Link href={href(key)} className="hover:underline">{label}</Link> : label}</span><b>{n}</b></div>
            <div className="h-2 rounded bg-muted" role="presentation"><div className="h-2 rounded bg-brand" style={{ width: `${(n / max) * 100}%` }} /></div></li>))}</ul>)}
    </section>
  );
}
const count = <T,>(rows: PendencyRow[], k: (r: PendencyRow) => T | null | undefined, label: (v: T) => string, key?: (v: T) => string) => {
  const m = new Map<string, [number, string | undefined]>();
  rows.forEach((r) => { const v = k(r); const l = v == null ? "—" : label(v); const e = m.get(l) ?? [0, v == null ? undefined : key?.(v)]; m.set(l, [e[0] + 1, e[1]]); });
  return [...m.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, 8).map(([l, [n, key]]) => [l, n, key] as [string, number, string?]);
};

export default async function CommandCenter() {
  const user = await requireUser();
  const [open, lookups, pid] = await Promise.all([listPendencies(user, {}), getLookups(user), myPersonId(user)]);
  const now = new Date(); const today = startOfDay(now);
  const mine = open.filter((r) => pid && (r.nextActionOwnerId === pid || (!r.nextActionOwnerId && r.currentOwnerId === pid)));
  const p1 = open.filter((r) => r.priority === "P1");
  const overdue = open.filter((r) => r.isOverdue).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const blocked = open.filter((r) => r.isBlocked);
  const waiting = open.filter((r) => WAITING_THIRD_PARTY.includes(r.status as StatusKey));
  const soon = open.filter((r) => r.dueDate && !r.isOverdue && r.dueDate < addDays(today, 8)).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const meetings = open.filter((r) => r.status === "SCHEDULED" || (r.followUpDate && r.followUpDate >= today && r.followUpDate < addDays(today, 8)));
  const stale = open.filter((r) => r.staleDays > 7).sort((a, b) => b.staleDays - a.staleDays);
  const recPool = (mine.length >= 3 ? mine : [...mine, ...open.filter((r) => !mine.includes(r))]).slice().sort((a, b) => b.score.score - a.score.score).slice(0, 3);

  const kpis: [string, number, string, string][] = [
    ["Dependem de mim", mine.length, "/pendencias?view=mine", ""], ["Críticas (P1)", p1.length, "/pendencias?priority=P1", ""],
    ["Vencidas", overdue.length, "/pendencias?view=overdue", ""], ["Bloqueadas", blocked.length, "/pendencias?view=blocked", ""],
    ["Aguardando terceiros", waiting.length, "/pendencias?view=waiting", ""], ["Prazo em 7 dias", soon.length, "/pendencias?view=week", ""], ["Sem atualização (>7d)", stale.length, "/pendencias?view=stale", ""],
  ];
  const chips: [string, string][] = [["Hoje", "view=today"], ["Esta semana", "view=week"], ["Vencidas", "view=overdue"], ["P1", "priority=P1"], ["P2", "priority=P2"], ["Bloqueadas", "view=blocked"], ["Aguardando terceiros", "view=waiting"]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h1 className="text-xl font-bold">Command Center</h1><p className="text-sm text-sub">Olá, {user.name}. {open.length} pendências abertas.</p></div></div>

      <nav aria-label="Filtros rápidos" className="flex flex-wrap items-center gap-2">
        {chips.map(([l, q]) => <Link key={l} href={`/pendencias?${q}`} className="chip">{l}</Link>)}
        <form action="/pendencias" className="flex flex-wrap items-center gap-2">
          {([["projectId", "Projeto", lookups.projects], ["assetId", "Ativo", lookups.assets], ["supplierId", "Fornecedor", lookups.suppliers], ["ownerId", "Responsável", lookups.people]] as const).map(([n, l, o]) => (
            <span key={n}><label className="sr-only" htmlFor={`f-${n}`}>{l}</label>
              <select id={`f-${n}`} name={n} className="input !w-auto !py-1 text-xs" defaultValue=""><option value="">{l}…</option>{o.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></span>))}
          <button className="btn btn-sm">Filtrar</button>
        </form>
      </nav>

      <section aria-label="Próximas ações recomendadas" className="card border-brand p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">✨ Minhas 3 próximas ações recomendadas</h2>
        {recPool.length === 0 ? <p className="text-sm text-sub">Nada pendente. Bom trabalho!</p> : (
          <ol className="grid gap-3 md:grid-cols-3">{recPool.map((r, i) => (
            <li key={r.id} className="rounded-md border border-line bg-muted/50 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2"><span className="font-bold text-brand">{i + 1}.</span><PriorityBadge p={r.priority} /><span className="text-xs text-sub">PND-{r.number}</span></div>
              <Link href={`/pendencias/${r.id}`} className="font-semibold hover:underline">{r.nextAction ?? r.title}</Link>
              <p className="mt-1 text-xs text-sub">{r.title}</p>
              <p className="mt-2 text-xs"><b>Por quê:</b> {r.score.explanation}</p>
            </li>))}</ol>)}
        <p className="mt-2 text-[11px] text-sub">Calculado pelo motor de priorização (score transparente: prazo, atraso, criticidade, dependências, bloqueios e tempo sem atualização).</p>
      </section>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {kpis.map(([l, n, h]) => (
          <Link key={l} href={h} className="card p-3 hover:bg-muted"><div className="text-2xl font-bold">{n}</div><div className="text-xs text-sub">{l}</div></Link>))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <MiniList title="Dependem de mim" href="/pendencias?view=mine" rows={mine.sort((a, b) => b.score.score - a.score.score)} empty="Nada depende de você agora." />
        <MiniList title="Vencidas" href="/pendencias?view=overdue" rows={overdue} empty="Nenhuma pendência vencida." extra={(r) => relativeDue(r.dueDate)} />
        <MiniList title="Bloqueadas" href="/pendencias?view=blocked" rows={blocked} empty="Nenhum bloqueio." extra={(r) => r.blockReason ?? "dependência aberta"} />
        <MiniList title="Aguardando terceiros" href="/pendencias?view=waiting" rows={waiting} empty="Nada aguardando terceiros." extra={(r) => `${STATUS_LABEL[r.status as StatusKey]}${r.supplier ? ` · ${r.supplier.name}` : ""}`} />
        <MiniList title="Próximas do prazo (7 dias)" href="/pendencias?view=week" rows={soon} empty="Nada vencendo nos próximos dias." extra={(r) => relativeDue(r.dueDate)} />
        <MiniList title="Reuniões e compromissos próximos" href="/calendario" rows={meetings} empty="Sem compromissos próximos." extra={(r) => (r.followUpDate ? `acomp. ${fmtDateShort(r.followUpDate)}` : STATUS_LABEL[r.status as StatusKey])} />
        <MiniList title="Itens sem atualização" href="/pendencias?view=stale" rows={stale} empty="Tudo atualizado na última semana." extra={(r) => `${r.staleDays}d sem atualização`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Bars title="Por prioridade" data={count(open, (r) => r.priority, (v) => v, (v) => v).sort((a, b) => a[0].localeCompare(b[0]))} href={(k) => `/pendencias?priority=${k}`} />
        <Bars title="Por status" data={count(open, (r) => r.status, (v) => STATUS_LABEL[v as StatusKey], (v) => v)} href={(k) => `/pendencias?status=${k}`} />
        <Bars title="Por projeto" data={count(open, (r) => r.project, (v) => v.name, (v) => v.id)} href={(k) => `/pendencias?projectId=${k}`} />
        <Bars title="Por ativo" data={count(open, (r) => r.asset, (v) => v.name, (v) => v.id)} href={(k) => `/pendencias?assetId=${k}`} />
        <Bars title="Por fornecedor" data={count(open.filter((r) => r.supplier), (r) => r.supplier, (v) => v.name, (v) => v.id)} href={(k) => `/pendencias?supplierId=${k}`} />
      </div>
    </div>
  );
}
