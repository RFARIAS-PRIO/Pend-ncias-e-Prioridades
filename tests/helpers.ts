import { db } from "@/server/db";
import type { Actor } from "@/server/auth";

export const hasDb = !!process.env.TEST_DATABASE_URL;
export async function resetDb() {
  await db.$executeRawUnsafe(`TRUNCATE "AiSuggestion","ChatMessage","Conversation","Notification","HistoryEntry","Comment","Reference","Dependency","PendencyInvolved","Pendency","ProjectMember","AuditLog","Person","User","Equipment","System","Project","Asset","Supplier" RESTART IDENTITY CASCADE`);
}
export async function mkUser(role: "ADMIN" | "EDITOR" | "VIEWER", name = role.toLowerCase()): Promise<Actor> {
  const u = await db.user.create({ data: { email: `${name}@t.local`, name, passwordHash: "x", role } });
  await db.person.create({ data: { name, userId: u.id } });
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}
export const base = { title: "Pendência de teste", status: "OPEN", priority: "P3", criticality: 3, operationalImpact: "LOW", financialImpact: "NONE", safety: false, shutdownImpact: false, materialRelated: false, mobilizationRelated: false } as const;
