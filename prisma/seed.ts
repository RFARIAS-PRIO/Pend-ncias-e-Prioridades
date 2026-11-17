/* Dados DEMONSTRATIVOS e fictícios. Datas relativas a "hoje" para exercitar filtros (vencidas, semana, etc.). */
import { PrismaClient, type Priority, type Status, type Impact } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d; };
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

async function main() {
  await db.$transaction([
    db.aiSuggestion.deleteMany(), db.chatMessage.deleteMany(), db.conversation.deleteMany(), db.notification.deleteMany(),
    db.historyEntry.deleteMany(), db.comment.deleteMany(), db.reference.deleteMany(), db.dependency.deleteMany(),
    db.pendencyInvolved.deleteMany(), db.pendency.deleteMany(), db.projectMember.deleteMany(), db.auditLog.deleteMany(),
    db.person.deleteMany(), db.user.deleteMany(), db.equipment.deleteMany(), db.system.deleteMany(),
    db.project.deleteMany(), db.asset.deleteMany(), db.supplier.deleteMany(),
  ]);
  const pw = await bcrypt.hash("Demo@1234", 10);
  const admin = await db.user.create({ data: { email: "admin@demo.local", name: "Engenheiro Demo", passwordHash: pw, role: "ADMIN" } });
  const editor = await db.user.create({ data: { email: "editor@demo.local", name: "Planejadora Demo", passwordHash: pw, role: "EDITOR" } });
  await db.user.create({ data: { email: "leitor@demo.local", name: "Leitor Demo", passwordHash: pw, role: "VIEWER" } });

  const forte = await db.asset.create({ data: { name: "FPSO FORTE", description: "Unidade demonstrativa" } });
  const bravo = await db.asset.create({ data: { name: "FPSO Bravo", description: "Unidade demonstrativa" } });
  const polvo = await db.asset.create({ data: { name: "Polvo-A", description: "Plataforma demonstrativa" } });
  const peregrino = await db.asset.create({ data: { name: "Peregrino", description: "Campo demonstrativo" } });

  const pTgb = await db.project.create({ data: { code: "GI-TGB", name: "Grande Intervenção TG-B", assetId: forte.id, description: "Revisão geral do turbogerador B" } });
  const pBravo = await db.project.create({ data: { code: "BRV-MNT", name: "Campanha de manutenção FPSO Bravo", assetId: bravo.id } });
  const pPolvo = await db.project.create({ data: { code: "PLV-DOC", name: "Atualização documental Polvo-A", assetId: polvo.id } });
  await db.project.create({ data: { code: "PRG-MAT", name: "Gestão de materiais Peregrino", assetId: peregrino.id } });
  const pPrg = await db.project.findUniqueOrThrow({ where: { code: "PRG-MAT" } });
  for (const p of [pTgb, pBravo]) await db.projectMember.create({ data: { userId: editor.id, projectId: p.id } });

  const sysGas = await db.system.create({ data: { name: "Turbogeração", assetId: forte.id } });
  const sysLub = await db.system.create({ data: { name: "Óleo lubrificante", assetId: forte.id } });
  const sysBr = await db.system.create({ data: { name: "Compressão de gás", assetId: bravo.id } });
  const eqTgb = await db.equipment.create({ data: { tag: "TG-B", name: "Turbogerador B", assetId: forte.id, systemId: sysGas.id } });
  const eqBomba = await db.equipment.create({ data: { tag: "P-3102B", name: "Bomba de óleo lubrificante B", assetId: forte.id, systemId: sysLub.id } });
  const eqComp = await db.equipment.create({ data: { tag: "K-2201A", name: "Compressor de gás A", assetId: bravo.id, systemId: sysBr.id } });

  const metaliza = await db.supplier.create({ data: { name: "Metaliza (demo)", contact: "Carlos Demo", email: "contato@metaliza.demo" } });
  const turbo = await db.supplier.create({ data: { name: "TurboServ (demo)", contact: "Ana Demo" } });
  const logis = await db.supplier.create({ data: { name: "LogiMar (demo)", contact: "Paulo Demo" } });
  const docs = await db.supplier.create({ data: { name: "DocTec (demo)", contact: "Marina Demo" } });

  const me = await db.person.create({ data: { name: "Engenheiro Demo", area: "Engenharia de Manutenção", userId: admin.id } });
  await db.person.create({ data: { name: "Planejadora Demo", area: "Planejamento", userId: editor.id } });
  const compras = await db.person.create({ data: { name: "Renata (Suprimentos)", area: "Suprimentos" } });
  const op = await db.person.create({ data: { name: "Marcos (Operação)", area: "Operação" } });
  const seg = await db.person.create({ data: { name: "Julia (SMS)", area: "Segurança" } });
  const cm = await db.person.create({ data: { name: "Carlos (Metaliza)", area: "Comercial", supplierId: metaliza.id } });
  const at = await db.person.create({ data: { name: "Ana (TurboServ)", area: "Engenharia", supplierId: turbo.id } });
  const pl = await db.person.findFirstOrThrow({ where: { name: "Planejadora Demo" } });

  type Seed = {
    key: string; title: string; description?: string; status: Status; priority: Priority; due?: number | null; follow?: number;
    project?: string; asset?: string; sys?: string; eq?: string; tag?: string; supplier?: string; area?: string;
    owner?: string; next?: string; nextAction?: string; block?: string; source?: string; notes?: string;
    crit?: number; op?: Impact; fin?: Impact; safety?: boolean; shutdown?: boolean; material?: boolean; mob?: boolean; chase?: number; stale?: number; created?: number;
  };
  const ids: Record<string, string> = {};
  const P = { forte: forte.id, bravo: bravo.id, polvo: polvo.id, peregrino: peregrino.id };
  const PJ = { tgb: pTgb.id, bravo: pBravo.id, polvo: pPolvo.id, prg: pPrg.id };
  const SUP = { metaliza: metaliza.id, turbo: turbo.id, logis: logis.id, docs: docs.id };
  const PER = { me: me.id, compras: compras.id, op: op.id, seg: seg.id, cm: cm.id, at: at.id, pl: pl.id };

  const list: Seed[] = [
    { key: "liners", title: "Confirmar prazo de entrega dos liners do TG-B", description: "Liners usinados pela Metaliza são caminho crítico da montagem do TG-B.", status: "WAITING_SUPPLIER", priority: "P1", due: -3, follow: 0, project: "tgb", asset: "forte", sys: sysGas.id, eq: eqTgb.id, tag: "TG-B", supplier: "metaliza", owner: "cm", next: "me", nextAction: "Cobrar confirmação de data de embarque dos liners", source: "Reunião semanal", crit: 5, op: "HIGH", shutdown: true, material: true, chase: 3, stale: 5, created: 20 },
    { key: "cronograma", title: "Cobrar cronograma detalhado da Metaliza", status: "WAITING_SUPPLIER", priority: "P2", due: 1, project: "tgb", asset: "forte", supplier: "metaliza", owner: "cm", next: "me", nextAction: "Enviar e-mail de cobrança", crit: 4, op: "MEDIUM", shutdown: true, chase: 1, stale: 2, created: 10 },
    { key: "wp", title: "Aprovar workpack de desmontagem do TG-B", status: "WAITING_APPROVAL", priority: "P1", due: -1, project: "tgb", asset: "forte", sys: sysGas.id, eq: eqTgb.id, tag: "TG-B", owner: "me", next: "me", nextAction: "Revisar e aprovar WP rev.2", crit: 5, op: "HIGH", shutdown: true, safety: true, stale: 1, created: 15 },
    { key: "embarque", title: "Programar embarque da equipe TurboServ para o TG-B", status: "WAITING_MOBILIZATION", priority: "P1", due: 2, project: "tgb", asset: "forte", supplier: "turbo", owner: "pl", next: "pl", nextAction: "Confirmar vagas no voo e bilhete", crit: 4, op: "HIGH", shutdown: true, mob: true, stale: 3, created: 12 },
    { key: "rc", title: "Emitir RC de juntas e parafusos do TG-B", description: "RC 1000012345 (demo).", status: "IN_PROGRESS", priority: "P2", due: 4, project: "tgb", asset: "forte", owner: "compras", next: "compras", nextAction: "Aprovar RC no fluxo de compras", material: true, crit: 4, op: "MEDIUM", fin: "MEDIUM", stale: 2, created: 14 },
    { key: "po", title: "Acompanhar PO de kit de vedação", description: "PO 4500098765 (demo).", status: "WAITING_MATERIAL", priority: "P2", due: -6, project: "tgb", asset: "forte", supplier: "turbo", owner: "compras", next: "me", nextAction: "Solicitar ETA ao fornecedor", material: true, crit: 3, fin: "HIGH", stale: 9, created: 30 },
    { key: "cron", title: "Atualizar cronograma da GI do TG-B com novas durações", status: "OPEN", priority: "P2", due: 3, project: "tgb", asset: "forte", owner: "pl", next: "pl", nextAction: "Atualizar no software de planejamento", crit: 4, op: "MEDIUM", shutdown: true, stale: 4, created: 8 },
    { key: "relat", title: "Revisar relatório técnico de inspeção boroscópica", status: "WAITING_INTERNAL", priority: "P3", due: 7, project: "tgb", asset: "forte", eq: eqTgb.id, tag: "TG-B", owner: "me", next: "me", nextAction: "Ler e emitir parecer", crit: 3, op: "LOW", stale: 6, created: 9 },
    { key: "bloq", title: "Montagem do rotor do TG-B", status: "BLOCKED", priority: "P2", due: 14, project: "tgb", asset: "forte", eq: eqTgb.id, tag: "TG-B", owner: "at", next: "me", block: "Depende dos liners e do kit de vedação", crit: 5, op: "HIGH", shutdown: true, stale: 1, created: 25 },
    { key: "doc1", title: "Atualizar P&ID do sistema de óleo lubrificante", status: "WAITING_DOCUMENTATION", priority: "P3", due: 10, project: "tgb", asset: "forte", sys: sysLub.id, supplier: "docs", owner: "pl", next: "pl", nextAction: "Cobrar revisão do desenho", crit: 2, op: "LOW", stale: 12, created: 40 },
    { key: "bomba", title: "Avaliar vibração da bomba P-3102B", status: "OPEN", priority: "P2", due: 0, project: "tgb", asset: "forte", sys: sysLub.id, eq: eqBomba.id, tag: "P-3102B", owner: "me", next: "me", nextAction: "Analisar tendência e definir ação", crit: 4, op: "MEDIUM", safety: false, stale: 2, created: 5 },
    { key: "b1", title: "Definir escopo da manutenção do compressor K-2201A", status: "IN_PROGRESS", priority: "P2", due: 5, project: "bravo", asset: "bravo", sys: sysBr.id, eq: eqComp.id, tag: "K-2201A", owner: "me", next: "me", nextAction: "Fechar escopo com Operação", crit: 4, op: "HIGH", stale: 1, created: 18 },
    { key: "b2", title: "Aprovação da proposta comercial de revisão do K-2201A", status: "WAITING_APPROVAL", priority: "P3", due: -2, project: "bravo", asset: "bravo", eq: eqComp.id, tag: "K-2201A", supplier: "turbo", owner: "op", next: "op", nextAction: "Aprovar proposta", fin: "HIGH", crit: 3, stale: 8, created: 22 },
    { key: "b3", title: "Negociar desconto na proposta de mobilização Bravo", status: "IN_PROGRESS", priority: "P3", due: 9, project: "bravo", asset: "bravo", supplier: "logis", owner: "me", next: "me", nextAction: "Contraproposta", fin: "MEDIUM", crit: 3, stale: 2, created: 7 },
    { key: "b4", title: "Reunião de alinhamento da campanha FPSO Bravo", status: "SCHEDULED", priority: "P3", due: 2, follow: 2, project: "bravo", asset: "bravo", owner: "pl", next: "pl", nextAction: "Enviar pauta", crit: 2, stale: 1, created: 4 },
    { key: "b5", title: "Liberar permissão de trabalho para serviço em K-2201A", status: "WAITING_INTERNAL", priority: "P1", due: 1, project: "bravo", asset: "bravo", eq: eqComp.id, tag: "K-2201A", owner: "seg", next: "seg", nextAction: "Revisar APR", safety: true, crit: 5, op: "HIGH", stale: 1, created: 3 },
    { key: "p1", title: "Revisar lista de documentos de Polvo-A", status: "OPEN", priority: "P4", due: 20, project: "polvo", asset: "polvo", supplier: "docs", owner: "pl", next: "pl", nextAction: "Conferir inventário documental", crit: 1, stale: 15, created: 50 },
    { key: "p2", title: "Emitir relatório mensal de status Polvo-A", status: "IN_PROGRESS", priority: "P4", due: 6, project: "polvo", asset: "polvo", owner: "me", next: "me", crit: 2, stale: 3, created: 11 },
    { key: "p3", title: "Validar TAGs de instrumentos no cadastro", status: "OPEN", priority: "P4", due: null, project: "polvo", asset: "polvo", owner: "pl", crit: 1, stale: 30, created: 60 },
    { key: "g1", title: "Mobilizar equipe de andaimes para Peregrino", status: "WAITING_MOBILIZATION", priority: "P3", due: 8, project: "prg", asset: "peregrino", supplier: "logis", owner: "pl", next: "pl", nextAction: "Confirmar janela de embarque", mob: true, crit: 3, stale: 2, created: 6 },
    { key: "g2", title: "Receber materiais de reposição do almoxarifado Peregrino", status: "WAITING_MATERIAL", priority: "P3", due: -4, project: "prg", asset: "peregrino", owner: "compras", next: "compras", nextAction: "Verificar status de transporte", material: true, crit: 3, stale: 10, created: 28 },
    { key: "g3", title: "Responder questionário de fornecedor (qualificação)", status: "OPEN", priority: "P4", due: 12, project: "prg", asset: "peregrino", supplier: "docs", owner: "me", next: "me", crit: 1, stale: 4, created: 6 },
    { key: "done1", title: "Aprovar procedimento de içamento do TG-B", status: "DONE", priority: "P2", due: -8, project: "tgb", asset: "forte", eq: eqTgb.id, tag: "TG-B", owner: "me", next: "me", crit: 4, stale: 6, created: 25 },
    { key: "done2", title: "Receber proposta técnica da TurboServ", status: "DONE", priority: "P3", due: -12, project: "tgb", asset: "forte", supplier: "turbo", owner: "me", crit: 3, stale: 10, created: 35 },
    { key: "canc1", title: "Contratar consultoria externa de vibração", status: "CANCELED", priority: "P4", due: -5, project: "tgb", asset: "forte", owner: "me", crit: 2, stale: 14, created: 30 },
  ];

  for (const s of list) {
    const p = await db.pendency.create({
      data: {
        title: s.title, description: s.description, status: s.status, priority: s.priority,
        dueDate: s.due == null ? null : day(s.due), followUpDate: s.follow == null ? null : day(s.follow),
        projectId: s.project ? PJ[s.project as keyof typeof PJ] : null, assetId: s.asset ? P[s.asset as keyof typeof P] : null,
        systemId: s.sys, equipmentId: s.eq, tag: s.tag, supplierId: s.supplier ? SUP[s.supplier as keyof typeof SUP] : null,
        area: s.area, currentOwnerId: s.owner ? PER[s.owner as keyof typeof PER] : null,
        nextActionOwnerId: s.next ? PER[s.next as keyof typeof PER] : null, nextAction: s.nextAction, blockReason: s.block,
        source: s.source ?? "Demonstração", notes: s.notes,
        criticality: s.crit ?? 3, operationalImpact: s.op ?? "LOW", financialImpact: s.fin ?? "NONE",
        safety: !!s.safety, shutdownImpact: !!s.shutdown, materialRelated: !!s.material, mobilizationRelated: !!s.mob, chaseCount: s.chase ?? 0,
        completedAt: s.status === "DONE" ? ago(s.stale ?? 5) : null, createdAt: ago(s.created ?? 10),
        createdById: admin.id, updatedById: admin.id,
      },
    });
    ids[s.key] = p.id;
    await db.historyEntry.create({ data: { pendencyId: p.id, userId: admin.id, type: "CREATED", note: `Pendência criada com prioridade ${s.priority}.`, createdAt: ago(s.created ?? 10) } });
    // updatedAt controlado por SQL para simular itens sem atualização
    await db.$executeRaw`UPDATE "Pendency" SET "updatedAt" = ${ago(s.stale ?? 2)} WHERE id = ${p.id}`;
  }

  const dep = (a: string, b: string, kind: "BLOCKS" | "RELATED" = "BLOCKS") => db.dependency.create({ data: { fromId: ids[a], toId: ids[b], kind } });
  await dep("liners", "bloq"); await dep("po", "bloq"); await dep("rc", "po"); await dep("wp", "embarque");
  await dep("cronograma", "cron"); await dep("b5", "b1"); await dep("relat", "wp", "RELATED"); await dep("bomba", "bloq", "RELATED");

  const h = (k: string, type: "STATUS" | "DUE_DATE" | "UPDATE" | "PRIORITY" | "FOLLOW_UP", n: number, o: Partial<{ field: string; oldValue: string; newValue: string; note: string }>) =>
    db.historyEntry.create({ data: { pendencyId: ids[k], userId: admin.id, type, createdAt: ago(n), ...o } });
  await h("liners", "DUE_DATE", 12, { field: "Prazo", oldValue: day(-15).toLocaleDateString("pt-BR"), newValue: day(-3).toLocaleDateString("pt-BR"), note: "Fornecedor pediu mais prazo para tratamento térmico." });
  await h("liners", "STATUS", 8, { field: "Status", oldValue: "Em andamento", newValue: "Aguardando fornecedor" });
  await h("liners", "UPDATE", 5, { note: "Metaliza informou que o tratamento térmico termina na próxima semana (demo)." });
  await h("liners", "PRIORITY", 4, { field: "Prioridade", oldValue: "P2", newValue: "P1", note: "Caminho crítico da montagem." });
  await h("po", "UPDATE", 9, { note: "ETA ainda não informado pelo fornecedor." });
  await h("wp", "STATUS", 6, { field: "Status", oldValue: "Em andamento", newValue: "Aguardando aprovação" });
  await db.comment.create({ data: { pendencyId: ids.liners, authorId: admin.id, body: "Metaliza informou que o tratamento térmico termina na próxima semana (demo).", createdAt: ago(5) } });
  await db.comment.create({ data: { pendencyId: ids.po, authorId: editor.id, body: "Cobrança enviada por e-mail; aguardando ETA.", createdAt: ago(9) } });
  await db.historyEntry.create({ data: { pendencyId: ids.done1, userId: admin.id, type: "COMPLETED", field: "Status", oldValue: "Em andamento", newValue: "Concluída", note: "Procedimento aprovado, rev.3 emitida.", createdAt: ago(6) } });

  const ref = (k: string, kind: "RC" | "PO" | "DOCUMENT" | "LINK", label: string, code?: string, url?: string) =>
    db.reference.create({ data: { pendencyId: ids[k], kind, label, code, url } });
  await ref("rc", "RC", "RC de juntas e parafusos", "1000012345"); await ref("po", "PO", "PO kit de vedação", "4500098765");
  await ref("wp", "DOCUMENT", "Workpack WP-TGB-001 rev.2", "WP-TGB-001"); await ref("doc1", "DOCUMENT", "P&ID óleo lubrificante", "PID-LUB-001");
  await ref("liners", "LINK", "Pasta do projeto (exemplo)", undefined, "https://example.com/projeto-tgb");
  await db.pendencyInvolved.createMany({ data: [{ pendencyId: ids.liners, personId: cm.id }, { pendencyId: ids.liners, personId: compras.id }, { pendencyId: ids.embarque, personId: at.id }] });

  console.log("Seed concluído. Logins demo (senha Demo@1234): admin@demo.local, editor@demo.local, leitor@demo.local");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
