import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";
import { UserForm } from "@/components/user-forms";
import { ROLE_LABEL } from "@/lib/constants";
import { fmtDateTime } from "@/lib/dates";

export const metadata = { title: "Usuários e permissões" };
export default async function UsersPage() {
  await requireAdmin();
  const [users, projects, logs] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, include: { memberships: true } }),
    db.project.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { name: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Usuários e permissões</h1>
      <details className="card"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">+ Novo usuário</summary><div className="border-t border-line"><UserForm projects={projects} memberOf={[]} /></div></details>
      {users.map((u) => (
        <details key={u.id} className="card"><summary className="cursor-pointer px-3 py-2 text-sm"><b>{u.name}</b> · {u.email} · {ROLE_LABEL[u.role]}{u.active ? "" : " · inativo"}</summary>
          <div className="border-t border-line"><UserForm user={{ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }} projects={projects} memberOf={u.memberships.map((m) => m.projectId)} /></div></details>))}
      <section><h2 className="mb-2 font-semibold">Auditoria recente</h2><div className="card overflow-x-auto"><table><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Entidade</th></tr></thead><tbody>
        {logs.map((l) => <tr key={l.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(l.createdAt)}</td><td className="text-xs">{l.user?.name ?? "—"}</td><td className="text-xs">{l.action}</td><td className="text-xs text-sub">{l.entity}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
