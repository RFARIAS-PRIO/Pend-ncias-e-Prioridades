"use client";
import { useActionState } from "react";
import { savePendencyAction } from "@/app/actions";
import { IMPACT, IMPACT_LABEL, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/constants";
import { toInputDate } from "@/lib/dates";

type Opt = { id: string; name: string };
export interface FormInitial { id?: string; [k: string]: unknown }
export interface FormLookups { projects: Opt[]; assets: Opt[]; systems: Opt[]; equipments: (Opt & { tag: string })[]; suppliers: Opt[]; people: Opt[] }

export function PendencyForm({ initial, lookups, involvedIds = [] }: { initial: FormInitial; lookups: FormLookups; involvedIds?: string[] }) {
  const [state, action, pending] = useActionState(savePendencyAction, {} as { error?: string });
  const v = (k: string, d: unknown = "") => (initial[k] ?? d) as never;
  const sel = (name: string, label: string, opts: Opt[], blank = "— nenhum —") => (
    <div><label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={v(name)} className="input"><option value="">{blank}</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
  );
  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">Informações principais</h2>
        <div><label className="label" htmlFor="title">Título *</label><input id="title" name="title" required minLength={3} defaultValue={v("title")} className="input" /></div>
        <div><label className="label" htmlFor="description">Descrição</label><textarea id="description" name="description" rows={3} defaultValue={v("description")} className="input" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={v("status", "OPEN")} className="input">{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
          <div><label className="label" htmlFor="priority">Prioridade</label><select id="priority" name="priority" defaultValue={v("priority", "P3")} className="input">{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></div>
          <div><label className="label" htmlFor="dueDate">Prazo</label><input id="dueDate" name="dueDate" type="date" defaultValue={toInputDate(v("dueDate", null))} className="input" /></div>
        </div>
      </section>
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">Contexto</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {sel("projectId", "Projeto", lookups.projects)}{sel("assetId", "Ativo", lookups.assets)}{sel("systemId", "Sistema", lookups.systems)}
          <div><label className="label" htmlFor="equipmentId">Equipamento</label><select id="equipmentId" name="equipmentId" defaultValue={v("equipmentId")} className="input"><option value="">— nenhum —</option>{lookups.equipments.map((o) => <option key={o.id} value={o.id}>{o.tag} · {o.name}</option>)}</select></div>
          <div><label className="label" htmlFor="tag">TAG</label><input id="tag" name="tag" defaultValue={v("tag")} className="input" /></div>
          {sel("supplierId", "Fornecedor", lookups.suppliers)}
          <div><label className="label" htmlFor="area">Área</label><input id="area" name="area" defaultValue={v("area")} className="input" /></div>
          <div><label className="label" htmlFor="source">Origem da informação</label><input id="source" name="source" defaultValue={v("source")} className="input" placeholder="Reunião, e-mail, relatório…" /></div>
        </div>
      </section>
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">Responsáveis e próxima ação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sel("currentOwnerId", "Responsável atual", lookups.people)}{sel("nextActionOwnerId", "Responsável pela próxima ação", lookups.people)}
          <div className="sm:col-span-2"><label className="label" htmlFor="nextAction">Próxima ação</label><input id="nextAction" name="nextAction" defaultValue={v("nextAction")} className="input" /></div>
          <div><label className="label" htmlFor="followUpDate">Data de acompanhamento</label><input id="followUpDate" name="followUpDate" type="date" defaultValue={toInputDate(v("followUpDate", null))} className="input" /></div>
          <div><label className="label" htmlFor="blockReason">Bloqueio ou dependência</label><input id="blockReason" name="blockReason" defaultValue={v("blockReason")} className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="involvedIds">Envolvidos (Ctrl/Cmd para vários)</label>
            <select id="involvedIds" name="involvedIds" multiple defaultValue={involvedIds} className="input h-28">{lookups.people.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        </div>
      </section>
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">Fatores de priorização</h2>
        <p className="text-xs text-sub">Alimentam o motor transparente de priorização (prazo, atraso e dependências são calculados automaticamente).</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="criticality">Criticidade (1–5)</label><input id="criticality" name="criticality" type="number" min={1} max={5} defaultValue={v("criticality", 3)} className="input" /></div>
          <div><label className="label" htmlFor="operationalImpact">Impacto operacional</label><select id="operationalImpact" name="operationalImpact" defaultValue={v("operationalImpact", "LOW")} className="input">{IMPACT.map((i) => <option key={i} value={i}>{IMPACT_LABEL[i]}</option>)}</select></div>
          <div><label className="label" htmlFor="financialImpact">Impacto financeiro</label><select id="financialImpact" name="financialImpact" defaultValue={v("financialImpact", "NONE")} className="input">{IMPACT.map((i) => <option key={i} value={i}>{IMPACT_LABEL[i]}</option>)}</select></div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {([["safety", "Envolve segurança"], ["shutdownImpact", "Impacta parada / Grande Intervenção"], ["materialRelated", "Depende de material"], ["mobilizationRelated", "Afeta embarque / mobilização"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" name={k} defaultChecked={!!initial[k]} />{l}</label>))}
        </div>
        <div><label className="label" htmlFor="notes">Observações</label><textarea id="notes" name="notes" rows={2} defaultValue={v("notes")} className="input" /></div>
      </section>
      {state.error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{state.error}</p>}
      <div className="flex gap-2"><button className="btn btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar pendência"}</button></div>
    </form>
  );
}
