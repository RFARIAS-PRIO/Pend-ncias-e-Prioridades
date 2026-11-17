import { notFound, redirect } from "next/navigation";
import { requireUser, canWrite } from "@/server/auth";
import { getLookups } from "@/server/lookups";
import { getPendency } from "@/server/pendencies";
import { PendencyForm } from "@/components/pendency-form";

export const metadata = { title: "Editar pendência" };
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const user = await requireUser();
  if (!canWrite(user)) redirect(`/pendencias/${id}`);
  const p = await getPendency(user, id); if (!p) notFound();
  return <div className="mx-auto max-w-4xl space-y-4"><h1 className="text-xl font-bold">Editar PND-{p.number}</h1>
    <PendencyForm initial={{ ...p, dueDate: p.dueDate, followUpDate: p.followUpDate }} involvedIds={p.involved.map((i) => i.person.id)} lookups={await getLookups(user)} /></div>;
}
