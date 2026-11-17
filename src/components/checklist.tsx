"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { quickAction } from "@/app/actions";
import { Flag, PriorityBadge, StatusBadge } from "./badges";
import { ActionModal, BulkModal, RowMenu, type Person } from "./pendency-actions";
import { EmptyState, toast } from "./ui";
import { fmtDateShort, relativeDue } from "@/lib/dates";
import type { RowDTO } from "@/lib/dto";

export function Checklist({ rows, people, canWrite, sort, dir, baseQuery }: { rows: RowDTO[]; people: Person[]; canWrite: boolean; sort: string; dir: string; baseQuery: string }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<RowDTO | null>(null);
  const [bulk, setBulk] = useState(false);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = rows.length > 0 && sel.size === rows.length;

  const sortLink = (key: string, label: string) => {
    const next = sort === key && dir === "asc" ? "desc" : "asc";
    const q = new URLSearchParams(baseQuery); q.set("sort", key); q.set("dir", next);
    return <Link href={`?${q}`} aria-label={`Ordenar por ${label}`} className="hover:underline">{label}{sort === key ? (dir === "asc" ? " ▲" : " ▼") : ""}</Link>;
  };
  if (!rows.length) return <EmptyState title="Nenhuma pendência encontrada" hint="Ajuste os filtros ou crie uma nova pendência." />;

  const onCheck = async (r: RowDTO) => {
    if (!canWrite) return;
    if (r.status === "DONE" || r.status === "CANCELED") {
      const res = await quickAction({ action: "reopen", id: r.id }); res.ok ? (toast(`PND-${r.number} reaberta`), router.refresh()) : toast(res.error, "error");
    } else setCompleting(r);
  };

  return (
    <div>
      {sel.size > 0 && canWrite && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-brand bg-brand/10 px-3 py-2 text-sm" role="region" aria-label="Ações em lote">
          <b>{sel.size} selecionada(s)</b>
          <button className="btn btn-sm" onClick={() => setBulk(true)}>Atualizar em lote…</button>
          <button className="btn btn-sm" onClick={() => setSel(new Set())}>Limpar seleção</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table>
          <thead><tr>
            <th className="w-8"><input type="checkbox" aria-label="Selecionar todas" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
            <th className="w-8"><span className="sr-only">Concluída</span>✔</th>
            <th>{sortLink("number", "ID")}</th><th>{sortLink("title", "Título")}</th><th>{sortLink("priority", "Prio.")}</th>
            <th>{sortLink("status", "Status")}</th><th>{sortLink("due", "Prazo")}</th><th>Projeto / ativo</th><th>Fornecedor / resp.</th><th>Próxima ação</th><th>{sortLink("score", "Score")}</th><th><span className="sr-only">Ações</span></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const done = r.status === "DONE" || r.status === "CANCELED";
              return (
                <tr key={r.id} className={done ? "opacity-60" : ""} aria-selected={sel.has(r.id)}>
                  <td><input type="checkbox" aria-label={`Selecionar PND-${r.number}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td><input type="checkbox" disabled={!canWrite} aria-label={r.status === "DONE" ? `Reabrir PND-${r.number}` : `Concluir PND-${r.number}`} checked={r.status === "DONE"} onChange={() => onCheck(r)} className="h-4 w-4" /></td>
                  <td className="whitespace-nowrap text-sub">PND-{r.number}</td>
                  <td className="min-w-64 max-w-md">
                    <Link href={`/pendencias/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.isOverdue && <Flag kind="overdue">Vencida</Flag>}
                      {r.isBlocked && <Flag kind="blocked">Bloqueada</Flag>}
                      {!done && r.staleDays > 7 && <Flag kind="stale">{r.staleDays}d sem atualização</Flag>}
                    </div>
                    {r.blockReason && <p className="mt-1 text-xs text-sub">⛔ {r.blockReason}</p>}
                  </td>
                  <td><PriorityBadge p={r.priority} />{!done && r.suggested !== r.priority && <div className="mt-1 text-[11px] text-sub" title={r.explanation}>sug. {r.suggested}</div>}</td>
                  <td><StatusBadge s={r.status} /></td>
                  <td className="whitespace-nowrap"><span className={r.isOverdue ? "font-semibold text-red-700 dark:text-red-300" : ""}>{fmtDateShort(r.dueDate)}</span><div className="text-xs text-sub">{r.dueDate ? relativeDue(r.dueDate) : ""}</div></td>
                  <td className="text-xs">{r.project ?? "—"}<div className="text-sub">{r.asset}{r.tag ? ` · ${r.tag}` : ""}</div></td>
                  <td className="text-xs">{r.supplier ?? "—"}<div className="text-sub">{r.nextOwner ?? r.owner ?? ""}</div></td>
                  <td className="max-w-56 text-xs">{r.nextAction ?? "—"}</td>
                  <td className="text-xs text-sub" title={r.explanation}>{r.score}</td>
                  <td className="whitespace-nowrap">{canWrite && <RowMenu row={r} people={people} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {completing && <ActionModal kind="complete" row={completing} people={people} onClose={() => setCompleting(null)} />}
      {bulk && <BulkModal ids={[...sel]} people={people} onClose={() => setBulk(false)} onDone={() => { setBulk(false); setSel(new Set()); router.refresh(); }} />}
    </div>
  );
}
