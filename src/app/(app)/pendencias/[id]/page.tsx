import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canWrite } from "@/server/auth";
import { getPendency, listPendencies } from "@/server/pendencies";
import { getLookups } from "@/server/lookups";
import { toDTO } from "@/lib/dto";
import { Flag, PriorityBadge, StatusBadge } from "@/components/badges";
import { ApplyPriority, CommentBox, DependencyPanel, DetailActions, ReferencePanel } from "@/components/detail-panels";
import { HISTORY_LABEL, IMPACT_LABEL, type StatusKey } from "@/lib/constants";
import { fmtDate, fmtDateTime, relativeDue } from "@/lib/dates";
import { db } from "@/server/db";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return { title: `Pendência ${(await params).id.slice(0, 6)}` }; }

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const user = await requireUser(); const w = canWrite(user);
  const p = await getPendency(user, id); if (!p) notFound();
  const [lookups, others] = await Promise.all([getLookups(user), listPendencies(user, { closed: true, limit: 300, sort: "number" })]);
  const dto = toDTO(p);
  const related = await db.dependency.findMany({ where: { kind: "RELATED", OR: [{ fromId: p.id }, { toId: p.id }] }, include: { from: true, to: true } });
  const sameTag = p.tag ? await listPendencies(user, { tag: p.tag, closed: true }) : [];
  const dep = (d: { id: string; to?: { id: string; number: number; title: string; status: string }; from?: { id: string; number: number; title: string; status: string } }, x: { id: string; number: number; title: string; status: string }) => ({ depId: d.id, ...x });
  const fld = (l: string, v: React.ReactNode) => <div><dt className="text-xs font-semibold text-sub">{l}</dt><dd className="text-sm">{v || "—"}</dd></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-sub"><Link href="/pendencias" className="hover:underline">Pendências</Link> / PND-{p.number}</p>
          <h1 className="text-xl font-bold">{p.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2"><PriorityBadge p={p.priority} /><StatusBadge s={p.status} />
            {p.isOverdue && <Flag kind="overdue">Vencida {relativeDue(p.dueDate)}</Flag>}{p.isBlocked && <Flag kind="blocked">Bloqueada</Flag>}</div>
        </div>
        <DetailActions row={dto} people={lookups.people} id={p.id} canWrite={w} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4" aria-label="Detalhes">
            {p.description && <p className="mb-3 whitespace-pre-wrap text-sm">{p.description}</p>}
            <dl className="grid gap-3 sm:grid-cols-3">
              {fld("Prazo", p.dueDate ? `${fmtDate(p.dueDate)} (${relativeDue(p.dueDate)})` : null)}{fld("Acompanhamento", p.followUpDate ? fmtDate(p.followUpDate) : null)}{fld("Conclusão", p.completedAt ? fmtDate(p.completedAt) : null)}
              {fld("Projeto", p.project?.name)}{fld("Ativo", p.asset?.name)}{fld("Sistema", p.system?.name)}
              {fld("Equipamento", p.equipment ? `${p.equipment.tag} · ${p.equipment.name}` : null)}
              {fld("TAG", p.tag ? <Link className="text-brand hover:underline" href={`/pendencias?tag=${encodeURIComponent(p.tag)}&closed=1`}>{p.tag}</Link> : null)}{fld("Fornecedor", p.supplier?.name)}
              {fld("Área", p.area)}{fld("Responsável atual", p.currentOwner?.name)}{fld("Resp. próxima ação", p.nextActionOwner?.name)}
              {fld("Origem", p.source)}{fld("Envolvidos", p.involved.map((i) => i.person.name).join(", "))}{fld("Cobranças", p.chaseCount ? `${p.chaseCount}x` : null)}
            </dl>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {fld("Próxima ação", p.nextAction)}{fld("Bloqueio / dependência", p.blockReason)}{fld("Observações", p.notes)}
            </div>
            <p className="mt-3 text-xs text-sub">Criada em {fmtDateTime(p.createdAt)} · Última atualização {fmtDateTime(p.updatedAt)}</p>
          </section>

          <section className="card p-4" aria-label="Linha do tempo">
            <h2 className="mb-3 font-semibold">Linha do tempo</h2>
            <div className="mb-4"><CommentBox id={p.id} /></div>
            <ol className="relative space-y-3 border-l border-line pl-4">
              {p.history.map((h) => (
                <li key={h.id} className="text-sm"><span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
                  <div className="flex flex-wrap items-center gap-2"><span className="tag bg-muted">{HISTORY_LABEL[h.type] ?? h.type}</span>
                    {h.field && (h.oldValue || h.newValue) && <span>{h.field}: <s className="text-sub">{h.oldValue ?? "—"}</s> → <b>{h.newValue ?? "—"}</b></span>}
                    {h.viaAi && <span className="tag bg-brand/10 text-brand">via assistente</span>}</div>
                  {h.note && <p className="mt-0.5 whitespace-pre-wrap text-sub">{h.note}</p>}
                  <p className="text-xs text-sub">{h.user?.name ?? "Sistema"} · {fmtDateTime(h.createdAt)}</p></li>))}
            </ol>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-4" aria-label="Priorização">
            <h2 className="mb-1 font-semibold">Priorização</h2>
            <p className="text-sm">{p.score.explanation}</p>
            <p className="mt-1 text-xs text-sub">Score {p.score.score} · sugerida {p.score.suggested} · atual {p.priority}</p>
            {w && p.score.suggested !== p.priority && !["DONE", "CANCELED"].includes(p.status) && <div className="mt-2"><ApplyPriority id={p.id} suggested={p.score.suggested} /></div>}
            <details className="mt-3 text-xs"><summary className="cursor-pointer text-brand">Ver fatores</summary>
              <table className="mt-2"><tbody>{p.score.factors.map((f) => <tr key={f.key}><td>{f.reason}</td><td className="text-right font-semibold">+{f.points}</td></tr>)}</tbody></table>
              <p className="mt-2 text-sub">Impacto operacional: {IMPACT_LABEL[p.operationalImpact]} · financeiro: {IMPACT_LABEL[p.financialImpact]} · criticidade {p.criticality}/5</p></details>
          </section>
          <section className="card p-4" aria-label="Dependências"><h2 className="mb-2 font-semibold">Dependências</h2>
            <DependencyPanel id={p.id} canWrite={w} options={others.map((o) => ({ id: o.id, label: `PND-${o.number} · ${o.title.slice(0, 60)}` }))}
              blockedBy={p.blockedBy.filter((d) => d.kind === "BLOCKS").map((d) => dep(d, d.from))} blocks={p.blocks.filter((d) => d.kind === "BLOCKS").map((d) => dep(d, d.to))}
              related={related.map((d) => dep(d, d.fromId === p.id ? d.to : d.from))} /></section>
          <section className="card p-4" aria-label="Referências"><h2 className="mb-2 font-semibold">Referências, RC, PO e documentos</h2>
            <ReferencePanel id={p.id} canWrite={w} refs={p.references} /></section>
          {sameTag.length > 1 && <section className="card p-4" aria-label="Mesma TAG"><h2 className="mb-2 font-semibold">Mesma TAG ({p.tag})</h2>
            <ul className="space-y-1 text-sm">{sameTag.filter((s) => s.id !== p.id).map((s) => <li key={s.id}><Link href={`/pendencias/${s.id}`} className="hover:underline">PND-{s.number} · {s.title}</Link> <span className="text-xs text-sub">({s.status as StatusKey})</span></li>)}</ul></section>}
        </div>
      </div>
    </div>
  );
}
