import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import * as svc from "@/server/pendencies";
import { chat, resolveSuggestion } from "@/server/ai/engine";
import { searchAll } from "@/server/search";
import { base, hasDb, mkUser, resetDb } from "./helpers";

describe.skipIf(!hasDb)("assistente de IA (integração)", () => {
  beforeEach(resetDb);
  const setup = async () => {
    const a = await mkUser("EDITOR"); const s = await db.supplier.create({ data: { name: "Metaliza (demo)" } });
    const liners = await svc.createPendency(a, { ...base, title: "Confirmar entrega dos liners do TG-B", supplierId: s.id, status: "WAITING_SUPPLIER", tag: "TG-B", priority: "P1", dueDate: "2020-01-01" });
    const outra = await svc.createPendency(a, { ...base, title: "Revisar procedimento de içamento" });
    return { a, s, liners, outra };
  };
  const last = (r: Awaited<ReturnType<typeof chat>>) => r.messages[r.messages.length - 1];

  it("informação de fornecedor localiza a pendência e só grava após confirmação", async () => {
    const { a, liners } = await setup();
    const r = await chat(a, "A Metaliza informou que os liners serão entregues sexta-feira.", null, new Date(2026, 10, 17));
    const m = last(r);
    expect(m.content).toContain(`PND-${liners.number}`); expect(m.content).toMatch(/Deseja registrar/);
    expect(m.suggestions).toHaveLength(1);
    expect(await db.comment.count()).toBe(0); // nada gravado antes da confirmação
    const res = await resolveSuggestion(a, m.suggestions[0].id, "confirm");
    expect(res.ok).toBe(true);
    const p = await db.pendency.findUniqueOrThrow({ where: { id: liners.id } });
    expect(p.followUpDate?.getDate()).toBe(20); // sexta-feira 20/11
    expect(await db.comment.count({ where: { pendencyId: liners.id, viaAi: true } })).toBe(1);
    expect((await resolveSuggestion(a, m.suggestions[0].id, "confirm")).ok).toBe(false); // não reaplica
  });

  it("marcar status e adiar prazo viram propostas; rejeitar não altera", async () => {
    const { a, outra } = await setup();
    const s1 = last(await chat(a, `Marque a pendência ${outra.number} como aguardando fornecedor`)).suggestions[0];
    expect((await db.pendency.findUniqueOrThrow({ where: { id: outra.id } })).status).toBe("OPEN");
    await resolveSuggestion(a, s1.id, "confirm");
    expect((await db.pendency.findUniqueOrThrow({ where: { id: outra.id } })).status).toBe("WAITING_SUPPLIER");
    const s2 = last(await chat(a, `Adie o item ${outra.number} para 27/11`, null, new Date(2026, 10, 17))).suggestions[0];
    await resolveSuggestion(a, s2.id, "reject");
    expect((await db.pendency.findUniqueOrThrow({ where: { id: outra.id } })).dueDate).toBeNull();
    expect((await db.aiSuggestion.findUniqueOrThrow({ where: { id: s2.id } })).status).toBe("REJECTED");
  });

  it("criação detecta duplicidade e oferece alternativa", async () => {
    const { a } = await setup();
    const m = last(await chat(a, "Crie uma pendência para confirmar entrega dos liners do TG-B"));
    expect(m.content).toMatch(/duplicidade/i);
    expect(m.suggestions.map((s) => s.kind)).toEqual(["CREATE", "ADD_UPDATE"]);
    expect(await db.pendency.count()).toBe(2);
  });

  it("consultas: vencidas citam evidências e item inexistente não é inventado", async () => {
    const { a, liners } = await setup();
    const m = last(await chat(a, "Quais itens estão vencidos?"));
    expect(m.content).toContain(`PND-${liners.number}`); expect(m.evidence.map((e) => e.number)).toContain(liners.number);
    const n = last(await chat(a, "Marque a pendência 999 como aguardando fornecedor"));
    expect(n.content).toMatch(/Não encontrei/); expect(n.suggestions).toHaveLength(0);
    const u = last(await chat(a, "blablabla xyzzy"));
    expect(u.content).toMatch(/informações suficientes/i);
  });

  it("concluir pelo chat exige evidência", async () => {
    const { a, outra } = await setup();
    expect(last(await chat(a, `Conclua a pendência ${outra.number}`)).suggestions).toHaveLength(0);
    const m = last(await chat(a, `Conclua a pendência ${outra.number}: procedimento aprovado`)); expect(m.suggestions[0].kind).toBe("COMPLETE");
  });

  it("usuário não confirma sugestão de outro usuário", async () => {
    const { a, outra } = await setup(); const b = await mkUser("EDITOR", "outro");
    const s = last(await chat(a, `Adie o item ${outra.number} para 27/11`)).suggestions[0];
    expect((await resolveSuggestion(b, s.id, "confirm")).ok).toBe(false);
  });

  it("leitor: confirmação falha e reabre a proposta", async () => {
    const { a, outra } = await setup();
    const s = last(await chat(a, `Marque a pendência ${outra.number} como em andamento`)).suggestions[0];
    await db.user.update({ where: { id: a.id }, data: { role: "VIEWER" } });
    const res = await resolveSuggestion({ ...a, role: "VIEWER" }, s.id, "confirm");
    expect(res.ok).toBe(false); expect((await db.aiSuggestion.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("PENDING");
  });

  it("busca global acha por TAG, comentário e trecho", async () => {
    const { a, liners } = await setup();
    await svc.addComment(a, liners.id, "Chegada prevista do lote de liners usinados");
    expect((await searchAll(a, "tg-b")).map((h) => h.id)).toContain(liners.id);
    const h = (await searchAll(a, "usinados"))[0]; expect(h.field).toBe("Comentário"); expect(h.snippet?.match).toBe("usinados");
    expect(await searchAll(a, "a")).toEqual([]);
  });
});
