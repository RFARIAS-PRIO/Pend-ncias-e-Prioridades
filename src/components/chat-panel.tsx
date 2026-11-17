"use client";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";
import { toast } from "./ui";

interface Sug { id: string; kind: string; summary: string; rationale: string | null; status: string }
interface Msg { id: string; role: "user" | "assistant"; content: string; evidence: { number: number; title: string }[]; suggestions: Sug[] }

const EXAMPLES = ["O que devo fazer hoje?", "Quais itens estão vencidos?", "O que pode atrasar a TG-B?", "Quais fornecedores preciso cobrar?", "Quais pendências bloqueiam outras atividades?"];

function Linkify({ text }: { text: string }) {
  return <>{text.split(/(PND-\d+)/g).map((p, i) => /^PND-\d+$/.test(p) ? <Link key={i} href={`/pendencias/${p.slice(4)}`} className="font-semibold text-brand underline">{p}</Link> : <Fragment key={i}>{p}</Fragment>)}</>;
}

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]); const [conv, setConv] = useState<string | null>(null);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && !loaded) fetch("/api/chat").then((r) => r.json()).then((d) => { setMsgs(d.messages ?? []); setConv(d.conversationId); setLoaded(true); }).catch(() => toast("Não foi possível carregar o histórico do chat", "error")); }, [open, loaded]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (m: string) => {
    const t = m.trim(); if (!t || busy) return; setBusy(true); setText("");
    setMsgs((x) => [...x, { id: `tmp-${Date.now()}`, role: "user", content: t, evidence: [], suggestions: [] }]);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: t, conversationId: conv }) });
      const d = await r.json();
      if (!r.ok) { toast(d.error ?? "Erro no chat", "error"); setMsgs((x) => x.slice(0, -1)); setText(t); }
      else { setConv(d.conversationId); setMsgs((x) => [...x.slice(0, -1), ...d.messages]); }
    } catch { toast("Falha de rede", "error"); setMsgs((x) => x.slice(0, -1)); setText(t); }
    setBusy(false);
  };
  const decide = async (s: Sug, decision: "confirm" | "reject") => {
    const r = await fetch(`/api/chat/suggestions/${s.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
    const d = await r.json();
    if (r.ok) { toast(d.text); setMsgs((all) => all.map((m) => ({ ...m, suggestions: m.suggestions.map((x) => x.id === s.id ? { ...x, status: decision === "confirm" ? "CONFIRMED" : "REJECTED" } : (decision === "confirm" && x.status === "PENDING" && m.suggestions.some((y) => y.id === s.id) && ["ADD_UPDATE", "CREATE"].includes(s.kind) ? { ...x, status: "EXPIRED" } : x)) }))); router.refresh(); }
    else toast(d.text ?? d.error ?? "Erro", "error");
  };

  return (
    <aside id="chat" aria-label="Assistente de IA" className={`${open ? "flex" : "hidden"} fixed inset-y-0 right-0 z-50 w-full flex-col border-l border-line bg-surface shadow-xl sm:w-96`}>
      <header className="flex items-center justify-between border-b border-line px-3 py-2"><div><h2 className="text-sm font-semibold">Assistente</h2><p className="text-[11px] text-sub">Consulta os dados do site. Só grava após sua confirmação.</p></div>
        <button className="btn btn-sm" onClick={onClose} aria-label="Recolher assistente"><X className="h-4 w-4" aria-hidden /></button></header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3" role="log" aria-live="polite">
        {msgs.length === 0 && loaded && <div className="space-y-2 text-sm"><p className="text-sub">Pergunte sobre suas pendências ou registre uma atualização em linguagem natural:</p>
          {EXAMPLES.map((e) => <button key={e} className="chip block w-full text-left" onClick={() => send(e)}>{e}</button>)}</div>}
        {msgs.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-6 rounded-lg bg-brand/10 p-2 text-sm" : "mr-2 rounded-lg border border-line p-2 text-sm"}>
            <p className="whitespace-pre-wrap break-words"><Linkify text={m.content} /></p>
            {m.suggestions.length > 0 && <ul className="mt-2 space-y-2">{m.suggestions.map((s) => (
              <li key={s.id} className="rounded border border-line bg-muted p-2 text-xs">
                <p className="font-semibold">{s.summary}</p>{s.rationale && <p className="mt-0.5 text-sub">{s.rationale}</p>}
                {s.status === "PENDING" ? <div className="mt-2 flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => decide(s, "confirm")}>Confirmar</button><button className="btn btn-sm" onClick={() => decide(s, "reject")}>Descartar</button></div>
                  : <p className="mt-1 text-sub">{s.status === "CONFIRMED" ? "✔ Confirmada e aplicada" : s.status === "REJECTED" ? "✕ Descartada" : "— Substituída por outra opção"}</p>}
              </li>))}</ul>}
            {m.evidence.length > 0 && <details className="mt-2 text-[11px] text-sub"><summary className="cursor-pointer">Evidências usadas ({m.evidence.length})</summary>
              <ul className="mt-1 list-disc pl-4">{m.evidence.map((e) => <li key={e.number}><Link href={`/pendencias/${e.number}`} className="hover:underline">PND-{e.number} · {e.title}</Link></li>)}</ul></details>}
          </div>))}
        {busy && <p className="text-sm text-sub" role="status">Consultando os registros…</p>}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-line p-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <label className="sr-only" htmlFor="chat-in">Mensagem</label>
        <input id="chat-in" className="input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Pergunte ou registre uma atualização…" autoComplete="off" />
        <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Enviar"><Send className="h-4 w-4" aria-hidden /></button>
      </form>
    </aside>
  );
}
