"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { quickAction } from "@/app/actions";
import { PriorityBadge, Flag } from "./badges";
import { ActionModal, type Person } from "./pendency-actions";
import { toast } from "./ui";
import { STATUS_ICON, STATUS_LABEL, type StatusKey } from "@/lib/constants";
import { fmtDateShort } from "@/lib/dates";
import type { RowDTO } from "@/lib/dto";

export function Kanban({ rows, columns, canWrite, people }: { rows: RowDTO[]; columns: StatusKey[]; canWrite: boolean; people: Person[] }) {
  const router = useRouter(); const [drag, setDrag] = useState<string | null>(null); const [completing, setCompleting] = useState<RowDTO | null>(null);
  const move = async (id: string, status: StatusKey) => {
    const row = rows.find((r) => r.id === id); if (!row || row.status === status) return;
    if (status === "DONE") { setCompleting(row); return; }
    const r = await quickAction({ action: "status", id, value: status });
    r.ok ? (toast(`PND-${row.number} → ${STATUS_LABEL[status]}`), router.refresh()) : toast(r.error, "error");
  };
  return (
    <>
      <div className="relative flex gap-3 overflow-x-auto pb-3">
        {columns.map((c) => {
          const items = rows.filter((r) => r.status === c);
          return (
            <section key={c} aria-label={STATUS_LABEL[c]} className="w-72 shrink-0 rounded-lg border border-line bg-muted/50"
              onDragOver={(e) => canWrite && e.preventDefault()} onDrop={() => { if (drag) move(drag, c); setDrag(null); }}>
              <h2 className="sticky top-0 flex items-center justify-between px-3 py-2 text-sm font-semibold"><span>{STATUS_ICON[c]} {STATUS_LABEL[c]}</span><span className="text-sub">{items.length}</span></h2>
              <ul className="space-y-2 p-2">
                {items.map((r) => (
                  <li key={r.id} draggable={canWrite} onDragStart={() => setDrag(r.id)} className="card cursor-grab p-2 text-sm">
                    <div className="mb-1 flex items-center gap-1.5"><PriorityBadge p={r.priority} /><span className="text-xs text-sub">PND-{r.number}</span>{r.isOverdue && <Flag kind="overdue">Vencida</Flag>}</div>
                    <Link href={`/pendencias/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <div className="mt-1 text-xs text-sub">{r.project ?? r.asset ?? ""}{r.dueDate ? ` · ${fmtDateShort(r.dueDate)}` : ""}</div>
                    {canWrite && <div className="mt-2"><label className="sr-only" htmlFor={`mv-${r.id}`}>Mover PND-{r.number}</label>
                      <select id={`mv-${r.id}`} className="input !py-0.5 text-xs" value={r.status} onChange={(e) => move(r.id, e.target.value as StatusKey)}>{[...columns, "DONE" as StatusKey].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>}
                  </li>))}
                {items.length === 0 && <li className="p-2 text-xs text-sub">Vazio</li>}
              </ul>
            </section>);
        })}
      </div>
      {completing && <ActionModal kind="complete" row={completing} people={people} onClose={() => setCompleting(null)} />}
    </>
  );
}
