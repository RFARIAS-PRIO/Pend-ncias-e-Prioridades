import Link from "next/link";
import { requireUser, canWrite } from "@/server/auth";
import { db } from "@/server/db";
import { CatalogForm } from "@/components/catalog-form";
import { CLOSED, WAITING_THIRD_PARTY } from "@/lib/constants";

export const metadata = { title: "Fornecedores e pessoas" };
export default async function SuppliersPage() {
  const user = await requireUser(); const w = canWrite(user);
  const [suppliers, people] = await Promise.all([
    db.supplier.findMany({ where: { deletedAt: null }, include: { pendencies: { where: { deletedAt: null }, select: { status: true, dueDate: true } }, people: true }, orderBy: { name: "asc" } }),
    db.person.findMany({ where: { deletedAt: null }, include: { supplier: true, nextActionOwn: { where: { deletedAt: null, status: { notIn: [...CLOSED] as never } }, select: { id: true } } }, orderBy: { name: "asc" } }),
  ]);
  const now = new Date();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Fornecedores e responsáveis</h1>
      {w && <div className="grid gap-3 md:grid-cols-2">
        <CatalogForm kind="supplier" title="Novo fornecedor" fields={[{ name: "name", label: "Nome", required: true }, { name: "contact", label: "Contato" }, { name: "email", label: "E-mail" }, { name: "phone", label: "Telefone" }]} />
        <CatalogForm kind="person" title="Nova pessoa" fields={[{ name: "name", label: "Nome", required: true }, { name: "area", label: "Área" }, { name: "email", label: "E-mail" }, { name: "supplierId", label: "Fornecedor (se externo)", options: suppliers }]} /></div>}
      <section><h2 className="mb-2 font-semibold">Fornecedores</h2><div className="card overflow-x-auto"><table><thead><tr><th>Fornecedor</th><th>Contato</th><th>Abertas</th><th>Aguardando</th><th>Vencidas</th></tr></thead><tbody>
        {suppliers.map((s) => { const open = s.pendencies.filter((p) => !CLOSED.includes(p.status)); return (
          <tr key={s.id}><td><Link href={`/pendencias?supplierId=${s.id}`} className="font-medium hover:underline">{s.name}</Link></td><td className="text-xs">{s.contact ?? "—"}{s.email ? ` · ${s.email}` : ""}</td>
            <td>{open.length}</td><td>{open.filter((p) => WAITING_THIRD_PARTY.includes(p.status)).length}</td><td>{open.filter((p) => p.dueDate && p.dueDate < now).length}</td></tr>); })}</tbody></table></div></section>
      <section><h2 className="mb-2 font-semibold">Pessoas e áreas</h2><div className="card overflow-x-auto"><table><thead><tr><th>Nome</th><th>Área</th><th>Organização</th><th>Ações abertas</th></tr></thead><tbody>
        {people.map((p) => <tr key={p.id}><td><Link href={`/pendencias?ownerId=${p.id}`} className="font-medium hover:underline">{p.name}</Link></td><td>{p.area ?? "—"}</td><td>{p.supplier?.name ?? "Interno"}</td><td>{p.nextActionOwn.length}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
