import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import * as svc from "@/server/pendencies";
import { base, hasDb, mkUser, resetDb } from "./helpers";

describe.skipIf(!hasDb)("serviço de pendências (integração)", () => {
  beforeEach(resetDb);

  it("cria, altera status/prazo/prioridade e gera histórico estruturado", async () => {
    const a = await mkUser("EDITOR");
    const p = await svc.createPendency(a, { ...base, dueDate: "2026-12-01" });
    await svc.updatePendency(a, p.id, { status: "WAITING_SUPPLIER", priority: "P1", dueDate: "2026-12-10" }, { note: "fornecedor atrasou" });
    const h = await db.historyEntry.findMany({ where: { pendencyId: p.id }, orderBy: { createdAt: "asc" } });
    expect(h.map((x) => x.type).sort()).toEqual(["CREATED", "DUE_DATE", "PRIORITY", "STATUS"].sort());
    expect(h.find((x) => x.type === "STATUS")).toMatchObject({ oldValue: "Aberta", newValue: "Aguardando fornecedor", userId: a.id });
    expect(h.find((x) => x.type === "DUE_DATE")?.newValue).toBe("10/12/2026");
  });

  it("não grava histórico quando nada mudou", async () => {
    const a = await mkUser("EDITOR"); const p = await svc.createPendency(a, base);
    await svc.updatePendency(a, p.id, { status: "OPEN", priority: "P3" });
    expect(await db.historyEntry.count({ where: { pendencyId: p.id } })).toBe(1);
  });

  it("concluir exige evidência; reabrir restaura; cancelar exige motivo e não exclui", async () => {
    const a = await mkUser("EDITOR"); const p = await svc.createPendency(a, base);
    await expect(svc.completePendency(a, p.id, " ")).rejects.toThrow(/evidência/i);
    await svc.completePendency(a, p.id, "Relatório aprovado");
    expect((await db.pendency.findUniqueOrThrow({ where: { id: p.id } })).completedAt).not.toBeNull();
    await svc.reopenPendency(a, p.id);
    expect((await db.pendency.findUniqueOrThrow({ where: { id: p.id } })).completedAt).toBeNull();
    await expect(svc.cancelPendency(a, p.id, "")).rejects.toThrow(/motivo/i);
    await svc.cancelPendency(a, p.id, "Escopo removido");
    expect((await db.pendency.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("CANCELED");
    expect(await db.pendency.count()).toBe(1); // nunca excluída
  });

  it("leitor não altera nada", async () => {
    const e = await mkUser("EDITOR"); const v = await mkUser("VIEWER"); const p = await svc.createPendency(e, base);
    await expect(svc.updatePendency(v, p.id, { priority: "P1" })).rejects.toThrow(/perfil/i);
    await expect(svc.createPendency(v, base)).rejects.toThrow(/perfil/i);
  });

  it("dependências: bloqueio conta nos dependentes e ciclos são rejeitados", async () => {
    const a = await mkUser("EDITOR");
    const x = await svc.createPendency(a, { ...base, title: "Bloqueadora" }); const y = await svc.createPendency(a, { ...base, title: "Bloqueada" });
    await svc.addDependency(a, x.id, y.id, "BLOCKS");
    await expect(svc.addDependency(a, y.id, x.id, "BLOCKS")).rejects.toThrow(/ciclo/i);
    await expect(svc.addDependency(a, x.id, y.id, "BLOCKS")).rejects.toThrow(/já existe/i);
    await expect(svc.addDependency(a, x.id, x.id, "BLOCKS")).rejects.toThrow();
    const rows = await svc.listPendencies(a, {});
    expect(rows.find((r) => r.id === x.id)!.dependentsCount).toBe(1);
    expect(rows.find((r) => r.id === y.id)!.isBlocked).toBe(true);
    await svc.completePendency(a, x.id, "liberada e conferida");
    expect((await svc.listPendencies(a, { closed: true })).find((r) => r.id === y.id)!.isBlocked).toBe(false);
  });

  it("lote exige confirmação explícita e não conclui sem evidência", async () => {
    const a = await mkUser("EDITOR"); const p1 = await svc.createPendency(a, base); const p2 = await svc.createPendency(a, base);
    await expect(svc.bulkUpdate(a, { ids: [p1.id, p2.id], priority: "P1" })).rejects.toThrow(/confirma/i);
    await expect(svc.bulkUpdate(a, { ids: [p1.id], status: "DONE", confirmed: true })).rejects.toThrow(/evidência/i);
    expect(await svc.bulkUpdate(a, { ids: [p1.id, p2.id], priority: "P1", confirmed: true })).toBe(2);
    expect(await db.pendency.count({ where: { priority: "P1" } })).toBe(2);
  });

  it("controle de acesso por projeto", async () => {
    const admin = await mkUser("ADMIN"); const ed = await mkUser("EDITOR");
    const pa = await db.project.create({ data: { code: "A", name: "Projeto A" } }); const pb = await db.project.create({ data: { code: "B", name: "Projeto B" } });
    await db.projectMember.create({ data: { userId: ed.id, projectId: pa.id } });
    const ia = await svc.createPendency(admin, { ...base, title: "Item A", projectId: pa.id }); const ib = await svc.createPendency(admin, { ...base, title: "Item B", projectId: pb.id });
    expect((await svc.listPendencies(ed, {})).map((r) => r.id)).toEqual([ia.id]);
    expect(await svc.getPendency(ed, ib.id)).toBeNull();
    await expect(svc.updatePendency(ed, ib.id, { priority: "P1" })).rejects.toThrow(/não encontrada/i);
    await expect(svc.createPendency(ed, { ...base, projectId: pb.id })).rejects.toThrow(/acesso/i);
    expect((await svc.listPendencies(admin, {})).length).toBe(2);
  });

  it("filtros: vencidas, aguardando terceiros e 'depende de mim'", async () => {
    const a = await mkUser("EDITOR"); const me = (await db.person.findFirst({ where: { userId: a.id } }))!;
    await svc.createPendency(a, { ...base, title: "Vencida", dueDate: "2020-01-01" });
    await svc.createPendency(a, { ...base, title: "Aguarda", status: "WAITING_SUPPLIER" });
    await svc.createPendency(a, { ...base, title: "Minha", nextActionOwnerId: me.id });
    expect((await svc.listPendencies(a, { view: "overdue" })).map((r) => r.title)).toEqual(["Vencida"]);
    expect((await svc.listPendencies(a, { view: "waiting" })).map((r) => r.title)).toEqual(["Aguarda"]);
    expect((await svc.listPendencies(a, { view: "mine" })).map((r) => r.title)).toEqual(["Minha"]);
  });
});
