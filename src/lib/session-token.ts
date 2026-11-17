// Seguro para Edge (middleware): usa apenas jose.
import { SignJWT, jwtVerify } from "jose";
export const SESSION_COOKIE = "cc_session";
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET ausente ou curto demais (mín. 16 caracteres).");
  return new TextEncoder().encode(s);
};
export async function signSession(uid: string, days = 7) {
  return new SignJWT({ uid }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime(`${days}d`).sign(secret());
}
export async function verifySession(token?: string | null): Promise<string | null> {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret()); return (payload.uid as string) ?? null; }
  catch { return null; }
}
