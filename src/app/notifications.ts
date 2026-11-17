"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
export async function markNotificationsRead() {
  const u = await requireUser();
  await db.notification.updateMany({ where: { userId: u.id, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
}
