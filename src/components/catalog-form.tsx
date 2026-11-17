"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCatalogAction } from "@/app/actions";
import { toast } from "./ui";

export interface Field { name: string; label: string; options?: { id: string; name: string }[]; required?: boolean }
export function CatalogForm({ kind, fields, title }: { kind: "supplier" | "person" | "asset" | "project"; fields: Field[]; title: string }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [err, setErr] = useState("");
  return (
    <details className="card"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">+ {title}</summary>
      <form className="grid gap-3 border-t border-line p-3 sm:grid-cols-2" action={(fd) => start(async () => {
        const data = Object.fromEntries(fields.map((f) => [f.name, String(fd.get(f.name) ?? "")]));
        const r = await createCatalogAction(kind, data); if (r.ok) { toast("Cadastro salvo"); setErr(""); router.refresh(); } else setErr(r.error);
      })}>
        {fields.map((f) => (<div key={f.name}><label className="label" htmlFor={`${kind}-${f.name}`}>{f.label}{f.required ? " *" : ""}</label>
          {f.options ? <select id={`${kind}-${f.name}`} name={f.name} className="input"><option value="">—</option>{f.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            : <input id={`${kind}-${f.name}`} name={f.name} required={f.required} className="input" />}</div>))}
        {err && <p role="alert" className="text-sm text-red-700 dark:text-red-300 sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2"><button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button></div>
      </form></details>
  );
}
