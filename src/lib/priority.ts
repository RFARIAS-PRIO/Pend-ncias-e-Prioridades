import { diffDays } from "./dates";
import type { PriorityKey } from "./constants";

export interface PriorityInput {
  status: string;
  dueDate?: Date | null;
  updatedAt: Date;
  criticality: number;
  operationalImpact: string;
  financialImpact: string;
  safety: boolean;
  shutdownImpact: boolean;
  materialRelated: boolean;
  mobilizationRelated: boolean;
  chaseCount: number;
  blockReason?: string | null;
  /** Quantidade de pendências abertas que dependem desta */
  dependentsCount: number;
}
export interface Factor { key: string; points: number; reason: string }
export interface PriorityResult {
  score: number; suggested: PriorityKey; factors: Factor[]; explanation: string;
}

export const THRESHOLDS = { P1: 70, P2: 45, P3: 25 } as const;

export function scorePendency(p: PriorityInput, now = new Date()): PriorityResult {
  const f: Factor[] = [];
  const add = (key: string, points: number, reason: string) => { if (points > 0) f.push({ key, points, reason }); };

  if (p.dueDate) {
    const d = diffDays(p.dueDate, now);
    if (d < 0) { add("overdue", 30 + Math.min(20, -d * 2), `está vencida há ${-d} dia${-d > 1 ? "s" : ""}`); }
    else if (d <= 2) add("due", 15, d === 0 ? "vence hoje" : `vence em ${d} dia${d > 1 ? "s" : ""}`);
    else if (d <= 7) add("due", 8, `vence em ${d} dias`);
  }
  add("criticality", (Math.max(1, Math.min(5, p.criticality)) - 1) * 4, `criticidade ${p.criticality}/5`);
  add("operational", { HIGH: 12, MEDIUM: 6, LOW: 2, NONE: 0 }[p.operationalImpact] ?? 0, "tem impacto operacional");
  add("safety", p.safety ? 15 : 0, "envolve segurança");
  add("shutdown", p.shutdownImpact ? 12 : 0, "impacta parada/Grande Intervenção");
  add("dependents", Math.min(15, p.dependentsCount * 5),
    `bloqueia ${p.dependentsCount} atividade${p.dependentsCount > 1 ? "s" : ""}`);
  add("blocked", p.status === "BLOCKED" || p.blockReason ? 4 : 0, "está bloqueada");
  add("material", p.materialRelated ? 4 : 0, "depende de material");
  add("mobilization", p.mobilizationRelated ? 6 : 0, "afeta embarque/mobilização");
  add("financial", { HIGH: 8, MEDIUM: 4, LOW: 1, NONE: 0 }[p.financialImpact] ?? 0, "tem impacto financeiro");
  const stale = diffDays(now, p.updatedAt);
  if (stale > 14) add("stale", 8, `está há ${stale} dias sem atualização`);
  else if (stale > 7) add("stale", 5, `está há ${stale} dias sem atualização`);
  add("chase", Math.min(8, p.chaseCount * 2), `já foi cobrada ${p.chaseCount}x`);

  const score = f.reduce((s, x) => s + x.points, 0);
  const suggested: PriorityKey = score >= THRESHOLDS.P1 ? "P1" : score >= THRESHOLDS.P2 ? "P2" : score >= THRESHOLDS.P3 ? "P3" : "P4";
  const top = [...f].sort((a, b) => b.points - a.points).slice(0, 3).map((x) => x.reason);
  const explanation = top.length
    ? `${suggested} porque ${top.length > 1 ? top.slice(0, -1).join(", ") + " e " + top[top.length - 1] : top[0]}.`
    : `${suggested} porque não há fatores de urgência relevantes.`;
  return { score, suggested, factors: f.sort((a, b) => b.points - a.points), explanation };
}
