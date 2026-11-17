import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listPendencies } from "@/server/pendencies";
import { PriorityBadge } from "@/components/badges";
import { startOfDay } from "@/lib/dates";

export const metadata = { title: "Calendário de prazos" };
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams; const user = await requireUser();
  const now = new Date(); const [y, mo] = m && /^\d{4}-\d{2}$/.test(m) ? m.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(y, mo - 1, 1); const days = new Date(y, mo, 0).getDate(); const offset = first.getDay();
  const rows = await listPendencies(user, {});
  const byDay = new Map<number, { r: (typeof rows)[number]; kind: "prazo" | "acomp." }[]>();
  for (const r of rows) {
    for (const [d, kind] of [[r.dueDate, "prazo"], [r.followUpDate, "acomp."]] as const) {
      if (d && d.getFullYear() === y && d.getMonth() === mo - 1) byDay.set(d.getDate(), [...(byDay.get(d.getDate()) ?? []), { r, kind }]);
    }
  }
  const prev = new Date(y, mo - 2, 1); const next = new Date(y, mo, 1);
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const today = startOfDay(now);
  const noDue = rows.filter((r) => !r.dueDate).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-bold">Calendário · {MONTHS[mo - 1]} {y}</h1>
        <div className="flex gap-2"><Link className="btn btn-sm" href={`?m=${ym(prev)}`}>← Anterior</Link><Link className="btn btn-sm" href="/calendario">Hoje</Link><Link className="btn btn-sm" href={`?m=${ym(next)}`}>Próximo →</Link></div></div>
      <div className="card overflow-x-auto"><div className="grid min-w-[56rem] grid-cols-7 text-xs">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="border-b border-line bg-muted px-2 py-1 font-semibold">{d}</div>)}
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} className="min-h-24 border-b border-r border-line bg-muted/40" />)}
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const isToday = new Date(y, mo - 1, d).getTime() === today.getTime(); const items = byDay.get(d) ?? [];
          return (<div key={d} className={`min-h-24 border-b border-r border-line p-1 ${isToday ? "bg-brand/10" : ""}`}>
            <div className={`mb-1 font-semibold ${isToday ? "text-brand" : "text-sub"}`}>{d}{isToday ? " · hoje" : ""}</div>
            <ul className="space-y-1">{items.slice(0, 4).map(({ r, kind }) => (
              <li key={r.id + kind}><Link href={`/pendencias/${r.id}`} className="flex items-center gap-1 rounded bg-muted px-1 py-0.5 hover:underline" title={`${r.title} (${kind})`}><PriorityBadge p={r.priority} /><span className="truncate">{kind === "acomp." ? "↻ " : ""}{r.title}</span></Link></li>))}
              {items.length > 4 && <li className="text-sub">+{items.length - 4} mais</li>}</ul></div>);
        })}
      </div></div>
      <p className="text-xs text-sub">↻ = data de acompanhamento. {noDue} pendência(s) abertas sem prazo não aparecem no calendário.</p>
    </div>
  );
}
