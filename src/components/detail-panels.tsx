"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDependencyAction, addReferenceAction, quickAction, removeDependencyAction } from "@/app/actions";
import { RowMenu, type Person } from "./pendency-actions";
import { toast } from "./ui";
import type { RowDTO } from "@/lib/dto";

function useRun() {
  const router = useRouter(); const [pending, start] = useTransition();
  return { pending, run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string, after?: () => void) => start(async () => {
    const r = await fn(); if (r.ok) { toast(okMsg); after?.(); router.refresh(); } else toast(r.error ?? "Erro", "error");
  }) };
}

export function DetailActions({ row, people, id, canWrite }: { row: RowDTO; people: Person[]; id: string; canWrite: boolean }) {
  if (!canWrite) return null;
  return <div className="flex items-center gap-2"><Link href={`/pendencias/${id}/editar`} className="btn btn-sm">Editar</Link><RowMenu row={row} people={people} /></div>;
}

export function ApplyPriority({ id, suggested }: { id: string; suggested: string }) {
  const { run, pending } = useRun();
  return <button className="btn btn-sm" disabled={pending} onClick={() => {
    if (confirm(`Alterar a prioridade para ${suggested}? A alteração ficará registrada no histórico.`)) run(() => quickAction({ action: "priority", id, value: suggested as never, note: "Sugestão do motor de priorização aceita" }), `Prioridade alterada para ${suggested}`);
  }}>Aplicar {suggested}</button>;
}

export function CommentBox({ id }: { id: string }) {
  const { run, pending } = useRun(); const [t, setT] = useState("");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => quickAction({ action: "comment", id, text: t }), "Comentário registrado", () => setT("")); }}>
      <label className="label" htmlFor="cm">Novo comentário</label>
      <textarea id="cm" className="input" rows={2} value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn btn-sm btn-primary" disabled={pending || !t.trim()}>Comentar</button>
    </form>
  );
}

export function DependencyPanel({ id, options, canWrite, blocks, blockedBy, related }: {
  id: string; options: { id: string; label: string }[]; canWrite: boolean;
  blocks: { depId: string; id: string; number: number; title: string; status: string }[];
  blockedBy: { depId: string; id: string; number: number; title: string; status: string }[];
  related: { depId: string; id: string; number: number; title: string; status: string }[];
}) {
  const { run, pending } = useRun(); const [other, setOther] = useState(""); const [kind, setKind] = useState("blockedBy");
  const list = (title: string, items: typeof blocks) => (
    <div><h3 className="text-xs font-semibold text-sub">{title}</h3>
      {items.length === 0 ? <p className="text-sm text-sub">Nenhuma.</p> : <ul className="space-y-1">{items.map((d) => (
        <li key={d.depId} className="flex items-center justify-between gap-2 text-sm"><Link href={`/pendencias/${d.id}`} className="hover:underline">PND-{d.number} · {d.title}</Link>
          <span className="flex items-center gap-2"><span className="text-xs text-sub">{d.status === "DONE" ? "✔ concluída" : d.status === "CANCELED" ? "✕ cancelada" : "aberta"}</span>
            {canWrite && <button className="btn btn-sm" aria-label={`Remover vínculo com PND-${d.number}`} onClick={() => confirm("Remover este vínculo?") && run(() => removeDependencyAction(d.depId), "Vínculo removido")}>✕</button>}</span></li>))}</ul>}
    </div>
  );
  return (
    <div className="space-y-3">
      {list("Depende de (bloqueada por)", blockedBy)}{list("Bloqueia", blocks)}{list("Relacionadas", related)}
      {canWrite && (
        <form className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); if (!other) return;
          run(() => kind === "blockedBy" ? addDependencyAction(other, id, "BLOCKS") : kind === "blocks" ? addDependencyAction(id, other, "BLOCKS") : addDependencyAction(id, other, "RELATED"), "Vínculo criado", () => setOther("")); }}>
          <div><label className="sr-only" htmlFor="dp">Pendência</label><select id="dp" className="input" value={other} onChange={(e) => setOther(e.target.value)}><option value="">Vincular pendência…</option>{options.filter((o) => o.id !== id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
          <div><label className="sr-only" htmlFor="dk">Tipo</label><select id="dk" className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="blockedBy">é bloqueada por</option><option value="blocks">bloqueia</option><option value="related">relaciona-se a</option></select></div>
          <button className="btn btn-primary btn-sm" disabled={!other || pending}>Vincular</button>
        </form>)}
    </div>
  );
}

export function ReferencePanel({ id, canWrite, refs }: { id: string; canWrite: boolean; refs: { id: string; kind: string; label: string; url: string | null; code: string | null }[] }) {
  const { run, pending } = useRun(); const [f, setF] = useState({ kind: "LINK", label: "", url: "", code: "" });
  return (
    <div className="space-y-3">
      {refs.length === 0 ? <p className="text-sm text-sub">Nenhuma referência.</p> : <ul className="space-y-1 text-sm">{refs.map((r) => (
        <li key={r.id}><span className="tag bg-muted">{r.kind}</span> {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{r.label}</a> : r.label}{r.code && <span className="text-sub"> · {r.code}</span>}</li>))}</ul>}
      {canWrite && (
        <form className="grid gap-2 border-t border-line pt-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => addReferenceAction(id, f as never), "Referência adicionada", () => setF({ kind: "LINK", label: "", url: "", code: "" })); }}>
          <div><label className="label" htmlFor="rk">Tipo</label><select id="rk" className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="LINK">Link</option><option value="RC">RC</option><option value="PO">PO</option><option value="DOCUMENT">Documento</option></select></div>
          <div><label className="label" htmlFor="rl">Nome *</label><input id="rl" className="input" required value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
          <div><label className="label" htmlFor="rc">Código (RC/PO/doc)</label><input id="rc" className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div><label className="label" htmlFor="ru">URL</label><input id="ru" className="input" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></div>
          <div className="sm:col-span-2"><button className="btn btn-sm btn-primary" disabled={pending}>Adicionar referência</button></div>
        </form>)}
    </div>
  );
}
