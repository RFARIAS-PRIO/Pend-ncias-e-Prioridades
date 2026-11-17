import { execSync } from "node:child_process";
/** Se TEST_DATABASE_URL estiver definida, aplica as migrações no banco de teste. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
}
