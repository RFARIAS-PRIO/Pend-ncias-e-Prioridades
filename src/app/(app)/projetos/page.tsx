import Link from "next/link";
import { requireUser, canWrite } from "@/server/auth";
import { db } from "@/server/db";
import { visibleProjectIds } from "@/server/access";
import { CatalogForm } from "@/components/catalog-form";
import { CLOSED } from "@/lib/constants";

export const metadata = { title: "Projetos e ativos" };
export default async function ProjectsPage() {
  const user = await requireUser(); const ids = await visibleProjectIds(user);
  const [projects, assets] = await Promise.all([
    db.project.findMany({ where: { deletedAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) }, include: { asset: true, pendencies: { where: { deletedAt: null }, select: { status: true, dueDate: true, priority: true } } }, orderBy: { name: "asc" } }),
    db.asset.findMany({ where: { deletedAt: null }, include: { systems: { include: { equipments: true } }, equipments: { where: { systemId: null } }, _count: { select: { pendencies: true } } }, orderBy: { name: "asc" } }),
  ]);
  const w = canWrite(user); const now = new Date();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Projetos e ativos</h1>
      {w && <div className="grid gap-3 md:grid-cols-2">
        <CatalogForm kind="project" title="Novo projeto" fields={[{ name: "code", label: "Código", required: true }, { name: "name", label: "Nome", required: true }, { name: "assetId", label: "Ativo", options: assets }, { name: "description", label: "Descrição" }]} />
        {user.role === "ADMIN" && <CatalogForm kind="asset" title="Novo ativo" fields={[{ name: "name", label: "Nome", required: true }, { name: "description", label: "Descrição" }]} />}</div>}
      <section><h2 className="mb-2 font-semibold">Projetos</h2>
        <div className="card overflow-x-auto"><table><thead><tr><th>Código</th><th>Projeto</th><th>Ativo</th><th>Abertas</th><th>Vencidas</th><th>P1</th></tr></thead><tbody>
          {projects.map((p) => { const open = p.pendencies.filter((x) => !CLOSED.includes(x.status)); return (
            <tr key={p.id}><td className="text-sub">{p.code}</td><td><Link href={`/pendencias?projectId=${p.id}`} className="font-medium hover:underline">{p.name}</Link></td><td>{p.asset?.name ?? "—"}</td>
              <td>{open.length}</td><td>{open.filter((x) => x.dueDate && x.dueDate < now).length}</td><td>{open.filter((x) => x.priority === "P1").length}</td></tr>); })}
          {projects.length === 0 && <tr><td colSpan={6} className="text-sub">Nenhum projeto acessível.</td></tr>}</tbody></table></div></section>
      <section><h2 className="mb-2 font-semibold">Ativos, sistemas e equipamentos</h2>
        <div className="grid gap-3 md:grid-cols-2">{assets.map((a) => (
          <div key={a.id} className="card p-3"><div className="flex items-center justify-between"><Link href={`/pendencias?assetId=${a.id}`} className="font-semibold hover:underline">{a.name}</Link><span className="text-xs text-sub">{a._count.pendencies} pendências</span></div>
            {a.description && <p className="text-xs text-sub">{a.description}</p>}
            <ul className="mt-2 space-y-1 text-sm">{a.systems.map((s) => (<li key={s.id}><b>{s.name}</b><ul className="ml-4 list-disc text-xs">{s.equipments.map((e) => <li key={e.id}><Link className="hover:underline" href={`/pendencias?tag=${encodeURIComponent(e.tag)}&closed=1`}>{e.tag}</Link> · {e.name}</li>)}</ul></li>))}</ul></div>))}</div></section>
    </div>
  );
}
