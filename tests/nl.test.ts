import { describe, expect, it } from "vitest";
import { classify, extractPendencyRef, parseDatePt, similarity, statusFromText } from "@/lib/nl";
import { pendencyPatchSchema } from "@/server/pendencies";

const now = new Date(2026, 10, 17, 9); // terça-feira, 17/11/2026
const ymd = (d: Date | null) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe("datas em português", () => {
  it.each([["27/11", "2026-11-27"], ["27/11/2026", "2026-11-27"], ["amanhã", "2026-11-18"], ["sexta-feira", "2026-11-20"], ["terça", "2026-11-24"], ["em 3 dias", "2026-11-20"], ["depois de amanhã", "2026-11-19"], ["dia 25", "2026-11-25"]])("%s → %s", (t, e) => expect(ymd(parseDatePt(t, now))).toBe(e));
  it("rejeita data inválida", () => expect(parseDatePt("31/02", now)).toBeNull());
  it("dd/mm bem no passado vai para o ano seguinte", () => expect(ymd(parseDatePt("05/01", now))).toBe("2027-1-5"));
});
describe("referências e status", () => {
  it.each([["pendência 25", 25], ["item 18", 18], ["PND-7", 7], ["#42", 42]])("%s", (t, n) => expect(extractPendencyRef(t)).toBe(n));
  it("status por frase", () => { expect(statusFromText("aguardando fornecedor")).toBe("WAITING_SUPPLIER"); expect(statusFromText("Aguardando documentação")).toBe("WAITING_DOCUMENTATION"); });
  it("similaridade detecta duplicidade", () => expect(similarity("Cobrar cronograma da Metaliza", "Cobrar cronograma detalhado da Metaliza")).toBeGreaterThan(0.5));
});
describe("intenções do chat (exemplos do escopo)", () => {
  it.each([
    ["O que devo fazer hoje?", "today"], ["Quais itens estão vencidos?", "overdue"], ["O que depende de mim?", "mine"], ["O que está aguardando fornecedor?", "waiting_supplier"],
    ["Quais tarefas estão sem atualização há mais de sete dias?", "stale"], ["O que pode atrasar a TG-B?", "risk"], ["Quais fornecedores preciso cobrar?", "chase"],
    ["Quais pendências bloqueiam outras atividades?", "blockers"], ["Resuma o histórico desta pendência 25", "summarize"], ["O que mudou esta semana?", "changes"],
    ["Crie uma pendência para cobrar o cronograma da Metaliza.", "create"], ["A Metaliza informou que os liners serão entregues sexta-feira.", "update_info"],
    ["Marque a pendência 25 como aguardando fornecedor.", "set_status"], ["Adie o item 18 para 27/11.", "postpone"], ["Mostre as pendências relacionadas ao mesmo equipamento TG-B", "related"],
  ])("%s → %s", (t, k) => expect(classify(t, now).kind).toBe(k));
  it("adie extrai ref e data", () => { const i = classify("Adie o item 18 para 27/11", now); expect(i).toMatchObject({ kind: "postpone", ref: 18 }); });
  it("concluir sem evidência pede evidência", () => expect(classify("Conclua a pendência 3", now)).toMatchObject({ kind: "complete", evidence: null }));
});
describe("validação", () => {
  it("patch parcial não zera booleanos ausentes", () => { const p = pendencyPatchSchema.parse({ title: "Algum título" }); expect("safety" in p && p.safety !== undefined).toBe(false); });
  it("checkbox 'on' vira true", () => expect(pendencyPatchSchema.parse({ safety: "on" }).safety).toBe(true));
});
