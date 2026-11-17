import { requireUser, canWrite } from "@/server/auth";
import { listPendencies } from "@/server/pendencies";
import { getLookups } from "@/server/lookups";
import { Kanban } from "@/components/kanban";
import { toDTO } from "@/lib/dto";
import { OPEN_STATUSES } from "@/lib/constants";

export const metadata = { title: "Kanban" };
export default async function KanbanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const user = await requireUser();
  const [rows, lk] = await Promise.all([listPendencies(user, { projectId: sp.projectId, assetId: sp.assetId, supplierId: sp.supplierId }), getLookups(user)]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-xl font-bold">Quadro por status</h1>
        <form className="flex items-end gap-2"><div><label className="label" htmlFor="projectId">Projeto</label><select id="projectId" name="projectId" defaultValue={sp.projectId ?? ""} className="input"><option value="">Todos</option>{lk.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><button className="btn">Filtrar</button></form></div>
      <p className="text-xs text-sub">Arraste os cartões ou use o seletor de cada cartão. Concluir exige evidência.</p>
      <Kanban rows={rows.map(toDTO)} columns={OPEN_STATUSES} canWrite={canWrite(user)} people={lk.people} />
    </div>
  );
}
