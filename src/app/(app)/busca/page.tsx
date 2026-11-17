import Link from "next/link";
import { requireUser } from "@/server/auth";
import { searchAll } from "@/server/search";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Busca global" };
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams; const user = await requireUser();
  const hits = await searchAll(user, q);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Busca global</h1>
      <form className="flex gap-2" role="search"><label className="sr-only" htmlFor="q">Termo</label><input id="q" name="q" defaultValue={q} className="input max-w-xl" placeholder="Palavra-chave, ID, TAG, RC, PO, fornecedor, pessoa…" autoFocus /><button className="btn btn-primary">Buscar</button></form>
      {q.length < 2 ? <EmptyState title="Digite ao menos 2 caracteres" hint="Busca em títulos, descrições, comentários, histórico, TAGs, RC, PO, documentos, fornecedores e pessoas." />
        : hits.length === 0 ? <EmptyState title={`Nada encontrado para “${q}”`} hint="Tente outro termo ou verifique a grafia." />
        : <>
          <p className="text-sm text-sub">{hits.length} resultado(s)</p>
          <ul className="space-y-2">{hits.map((h) => (
            <li key={h.id} className="card p-3"><div className="flex flex-wrap items-center gap-2"><PriorityBadge p={h.priority} /><StatusBadge s={h.status} /><Link href={`/pendencias/${h.id}`} className="font-medium hover:underline">PND-{h.number} · {h.title}</Link></div>
              <p className="mt-1 text-sm"><span className="tag bg-muted">{h.field}</span>{" "}{h.snippet ? <>{h.snippet.before}<mark className="rounded bg-yellow-200 px-0.5 text-slate-900">{h.snippet.match}</mark>{h.snippet.after}</> : null}</p></li>))}</ul></>}
    </div>
  );
}
