import { describe, expect, it } from "vitest";
import { scorePendency, type PriorityInput } from "@/lib/priority";

const now = new Date(2026, 10, 17, 10);
const base: PriorityInput = { status: "OPEN", dueDate: null, updatedAt: now, criticality: 3, operationalImpact: "LOW", financialImpact: "NONE", safety: false, shutdownImpact: false, materialRelated: false, mobilizationRelated: false, chaseCount: 0, dependentsCount: 0 };

describe("motor de priorização", () => {
  it("item neutro é P4 e tem explicação", () => {
    const r = scorePendency(base, now);
    expect(r.suggested).toBe("P4"); expect(r.explanation).toMatch(/^P4 porque/);
  });
  it("vencida + bloqueia + segurança → P1 com justificativa em linguagem simples", () => {
    const r = scorePendency({ ...base, dueDate: new Date(2026, 10, 12), dependentsCount: 2, safety: true, criticality: 5 }, now);
    expect(r.suggested).toBe("P1");
    expect(r.explanation).toContain("vencida há 5 dias");
    expect(r.factors.find((f) => f.key === "dependents")?.points).toBe(10);
  });
  it("atraso aumenta com os dias, com teto", () => {
    const a = scorePendency({ ...base, dueDate: new Date(2026, 10, 16) }, now).score;
    const b = scorePendency({ ...base, dueDate: new Date(2026, 9, 1) }, now).score;
    expect(b).toBeGreaterThan(a); expect(b).toBeLessThanOrEqual(50 + 8 + 2);
  });
  it("tempo sem atualização e cobranças contam", () => {
    const fresh = scorePendency(base, now).score;
    const stale = scorePendency({ ...base, updatedAt: new Date(2026, 10, 1), chaseCount: 3 }, now).score;
    expect(stale - fresh).toBe(8 + 6);
  });
  it("item vencendo hoje pontua menos que vencido", () => {
    const hoje = scorePendency({ ...base, dueDate: now }, now).score; const venc = scorePendency({ ...base, dueDate: new Date(2026, 10, 16) }, now).score;
    expect(venc).toBeGreaterThan(hoje);
  });
});
