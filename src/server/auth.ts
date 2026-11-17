import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, signSession, verifySession } from "@/lib/session-token";
import type { Role } from "@prisma/client";

export interface Actor { id: string; name: string; email: string; role: Role }

export const getUser = cache(async (): Promise<Actor | null> => {
  const uid = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const u = await db.user.findUnique({ where: { id: uid } });
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
});
export async function requireUser(): Promise<Actor> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
export async function requireAdmin(): Promise<Actor> {
  const u = await requireUser();
  if (u.role !== "ADMIN") redirect("/");
  return u;
}
export async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 7 * 86400,
  });
}
export async function endSession() { (await cookies()).delete(SESSION_COOKIE); }
export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);
export const canWrite = (a: Actor) => a.role !== "VIEWER";
