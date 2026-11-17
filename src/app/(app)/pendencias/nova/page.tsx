import { redirect } from "next/navigation";
import { requireUser, canWrite } from "@/server/auth";
import { getLookups } from "@/server/lookups";
import { PendencyForm } from "@/components/pendency-form";

export const metadata = { title: "Nova pendência" };
export default async function NewPage() {
  const user = await requireUser(); if (!canWrite(user)) redirect("/pendencias");
  return <div className="mx-auto max-w-4xl space-y-4"><h1 className="text-xl font-bold">Nova pendência</h1><PendencyForm initial={{}} lookups={await getLookups(user)} /></div>;
}
