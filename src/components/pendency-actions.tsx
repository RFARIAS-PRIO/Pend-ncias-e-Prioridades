"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickAction, bulkAction, type QuickInput } from "@/app/actions";
import { Modal, toast } from "./ui";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/constants";
import { toInputDate } from "@/lib/dates";
import type { RowDTO } from "@/lib/dto";

export type ActionKind = "status" | "priority" | "due" | "owner" | "update" | "block" | "unblock" | "complete" | "reopen" | "cancel" | "comment";
export interface Person { id: string; name: string }

const TITLES: Record<ActionKind, string> = {
  status: "Alterar status", priority: "Alterar prioridade", due: "Alterar prazo", owner: "Definir responsável (próxima ação)",
  update: "Registrar atualização", block: "Adicionar bloqueio", unblock: "Remover bloqueio", complete: "Concluir pendência",
  reopen: "Reabrir pendência", cancel: "Cancelar pendência", comment: "Comentar",
};

export function ActionModal({ kind, row, people, onClose }: { kind: ActionKind; row: Pick<RowDTO, "id" | "number" | "title" | "status" | "priority" | "dueDate" | "nextOwnerId" | "suggested" | "explanation">; people: Person[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const submit = (fd: FormData) => {
    const v = (k: string) => String(fd.get(k) ?? "").trim();
    let input: QuickInput;
    switch (kind) {
      case "status": input = { action: "status", id: row.id, value: v("value") as never, note: v("note") }; break;
      case "priority": input = { action: "priority", id: row.id, value: v("value") as never, note: v("note") }; break;
      case "due": input = { action: "due", id: row.id, value: v("value"), note: v("note") }; break;
      case "owner": input = { action: "owner", id: row.id, value: v("value") }; break;
      case "update": input = { action: "update", id: row.id, text: v("text"), followUpDate: v("followUpDate") || undefined, chase: fd.get("chase") === "on" }; break;
      case "comment": input = { action: "comment", id: row.id, text: v("text") }; break;
      case "block": input = { action: "block", id: row.id, reason: v("text") }; break;
      case "unblock": input = { action: "unblock", id: row.id, note: v("text") }; break;
      case "complete": input = { action: "complete", id: row.id, evidence: v("text") }; break;
      case "reopen": input = { action: "reopen", id: row.id, note: v("text") }; break;
      case "cancel": input = { action: "cancel", id: row.id, reason: v("text") }; break;
    }
    start(async () => {
      const r = await quickAction(input);
      if (r.ok) { toast(`PND-${row.number}: ${TITLES[kind].toLowerCase()} salvo`); onClose(); router.refresh(); }
      else setError(r.error);
    });
  };
  const textLabel = { complete: "Evidência ou observação da conclusão *", cancel: "Motivo do cancelamento *", block: "Descreva o bloqueio ou dependência *", unblock: "Observação (opcional)", reopen: "Motivo da reabertura (opcional)", update: "Atualização *", comment: "Comentário *" } as Record<string, string>;
  return (
    <Modal title={`${TITLES[kind]} · PND-${row.number}`} onClose={onClose}>
      <form action={submit} className="space-y-3">
        <p className="line-clamp-2 text-sm text-sub">{row.title}</p>
        {kind === "status" && <div><label className="label" htmlFor="value">Novo status</label>
          <select id="value" name="value" defaultValue={row.status} className="input">{STATUSES.filter((s) => s !== "DONE").map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>}
        {kind === "priority" && <>
          <div><label className="label" htmlFor="value">Nova prioridade</label>
            <select id="value" name="value" defaultValue={row.priority} className="input">{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></div>
          <p className="rounded bg-muted p-2 text-xs">Sugestão do motor de priorização: <b>{row.explanation}</b></p></>}
        {kind === "due" && <div><label className="label" htmlFor="value">Novo prazo</label><input id="value" name="value" type="date" required defaultValue={toInputDate(row.dueDate)} className="input" /></div>}
        {kind === "owner" && <div><label className="label" htmlFor="value">Responsável pela próxima ação</label>
          <select id="value" name="value" defaultValue={row.nextOwnerId ?? ""} className="input"><option value="">— ninguém —</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
        {["complete", "cancel", "block", "unblock", "reopen", "update", "comment"].includes(kind) && (
          <div><label className="label" htmlFor="text">{textLabel[kind]}</label><textarea id="text" name="text" rows={3} className="input" required={!["unblock", "reopen"].includes(kind)} autoFocus /></div>)}
        {kind === "update" && <>
          <div><label className="label" htmlFor="fu">Nova data de acompanhamento (opcional)</label><input id="fu" name="followUpDate" type="date" className="input" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="chase" /> Esta atualização é uma cobrança</label></>}
        {kind === "status" && <div><label className="label" htmlFor="note">Observação (opcional)</label><input id="note" name="note" className="input" /></div>}
        {(kind === "priority" || kind === "due") && <div><label className="label" htmlFor="note">Justificativa (opcional)</label><input id="note" name="note" className="input" /></div>}
        {kind === "cancel" && <p className="rounded border border-amber-400 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">A pendência não será excluída: ficará como Cancelada e poderá ser reaberta.</p>}
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Voltar</button>
          <button className={`btn ${kind === "cancel" ? "btn-danger" : "btn-primary"}`} disabled={pending}>{pending ? "Salvando…" : kind === "cancel" ? "Confirmar cancelamento" : "Salvar"}</button></div>
      </form>
    </Modal>
  );
}

export function RowMenu({ row, people, onOpen }: { row: RowDTO; people: Person[]; onOpen?: () => void }) {
  const [kind, setKind] = useState<ActionKind | null>(null);
  const closed = row.status === "DONE" || row.status === "CANCELED";
  const items: [ActionKind, string, boolean][] = [
    ["complete", "Concluir", !closed], ["status", "Alterar status", !closed], ["priority", "Alterar prioridade", !closed],
    ["due", "Alterar prazo", !closed], ["owner", "Definir responsável", !closed], ["update", "Registrar atualização", !closed],
    ["block", "Adicionar bloqueio", !closed && !row.isBlocked], ["unblock", "Remover bloqueio", !closed && row.isBlocked],
    ["reopen", "Reabrir", closed], ["cancel", "Cancelar", !closed],
  ];
  return (
    <>
      <details className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }}>
        <summary className="btn btn-sm cursor-pointer list-none" aria-label={`Ações da pendência ${row.number}`}>Ações ▾</summary>
        <ul className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-line bg-surface p-1 shadow-lg">
          {items.filter((i) => i[2]).map(([k, label]) => (
            <li key={k}><button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; onOpen?.(); setKind(k); }}>{label}</button></li>
          ))}
        </ul>
      </details>
      {kind && <ActionModal kind={kind} row={row} people={people} onClose={() => setKind(null)} />}
    </>
  );
}

export function BulkModal({ ids, people, onClose, onDone }: { ids: string[]; people: Person[]; onClose: () => void; onDone: () => void }) {
  const [field, setField] = useState<"status" | "priority" | "dueDate" | "nextActionOwnerId">("status");
  const [value, setValue] = useState("");
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await bulkAction({ ids, [field]: value, confirmed: ok });
    if (r.ok) { toast(`${r.data} pendências atualizadas`); onDone(); } else setError(r.error);
  });
  return (
    <Modal title={`Atualização em lote (${ids.length})`} onClose={onClose}>
      <div className="space-y-3">
        <div><label className="label" htmlFor="bf">Campo</label>
          <select id="bf" className="input" value={field} onChange={(e) => { setField(e.target.value as never); setValue(""); }}>
            <option value="status">Status</option><option value="priority">Prioridade</option><option value="dueDate">Prazo</option><option value="nextActionOwnerId">Responsável (próxima ação)</option></select></div>
        <div><label className="label" htmlFor="bv">Novo valor</label>
          {field === "status" && <select id="bv" className="input" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Selecione…</option>{STATUSES.filter((s) => s !== "DONE").map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>}
          {field === "priority" && <select id="bv" className="input" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Selecione…</option>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select>}
          {field === "dueDate" && <input id="bv" type="date" className="input" value={value} onChange={(e) => setValue(e.target.value)} />}
          {field === "nextActionOwnerId" && <select id="bv" className="input" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Selecione…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div>
        <label className="flex items-start gap-2 rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />Confirmo que esta alteração será aplicada a {ids.length} pendência(s) e registrada no histórico de cada uma.</label>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Voltar</button>
          <button className="btn btn-primary" disabled={!ok || !value || pending} onClick={save}>{pending ? "Aplicando…" : "Aplicar"}</button></div>
      </div>
    </Modal>
  );
}
