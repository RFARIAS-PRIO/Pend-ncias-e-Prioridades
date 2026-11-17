const DAY = 86_400_000;
export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY);
}
/** Fim da semana corrente (domingo). */
export function endOfWeek(d: Date = new Date()): Date {
  const x = startOfDay(d); const dow = x.getDay(); // 0 = dom
  return addDays(x, dow === 0 ? 0 : 7 - dow);
}
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtShort = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtDate = (d?: Date | string | null) => (d ? fmt.format(new Date(d)) : "—");
export const fmtDateShort = (d?: Date | string | null) => (d ? fmtShort.format(new Date(d)) : "—");
export const fmtDateTime = (d?: Date | string | null) => (d ? fmtTime.format(new Date(d)) : "—");
export function toInputDate(d?: Date | string | null): string {
  if (!d) return "";
  const x = new Date(d); const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}
/** Converte "YYYY-MM-DD" em Date local ao meio-dia (evita deslocamento de fuso). */
export function parseInputDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}
export function relativeDue(due?: Date | string | null, now = new Date()): string {
  if (!due) return "sem prazo";
  const n = diffDays(new Date(due), now);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  return n > 0 ? `em ${n} dias` : `${-n} dias atrás`;
}
