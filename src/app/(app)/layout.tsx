import { requireUser, canWrite } from "@/server/auth";
import { db } from "@/server/db";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await db.notification.count({ where: { userId: user.id, read: false } });
  return <Shell user={{ name: user.name, role: user.role }} unread={unread} canWrite={canWrite(user)}>{children}</Shell>;
}
