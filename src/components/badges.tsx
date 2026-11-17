import { PRIORITY_CLASS, STATUS_ICON, STATUS_LABEL, type PriorityKey, type StatusKey } from "@/lib/constants";

export function PriorityBadge({ p }: { p: string }) {
  return <span className={`tag ${PRIORITY_CLASS[p as PriorityKey]}`} title={`Prioridade ${p}`}>{p}</span>;
}
export function StatusBadge({ s }: { s: string }) {
  return (
    <span className="tag border border-line bg-muted text-fg" title={STATUS_LABEL[s as StatusKey]}>
      <span aria-hidden>{STATUS_ICON[s as StatusKey]}</span>{STATUS_LABEL[s as StatusKey]}
    </span>
  );
}
export function Flag({ kind, children }: { kind: "overdue" | "blocked" | "stale"; children: React.ReactNode }) {
  const c = { overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", blocked: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200", stale: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100" }[kind];
  const icon = { overdue: "⏰", blocked: "⛔", stale: "💤" }[kind];
  return <span className={`tag ${c}`}><span aria-hidden>{icon}</span>{children}</span>;
}
