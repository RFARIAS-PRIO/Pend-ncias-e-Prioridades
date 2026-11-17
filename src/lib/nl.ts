/** Utilitários de linguagem natural (pt-BR) — funções puras e testáveis. */
import type { StatusKey } from "./constants";
import { addDays, startOfDay } from "./dates";

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const WEEKDAYS: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

/** Interpreta datas como "27/11", "27/11/2026", "hoje", "amanhã", "sexta-feira", "próxima segunda", "em 3 dias". */
export function parseDatePt(text: string, now = new Date()): Date | null {
  const t = norm(text); const today = startOfDay(now);
  const at = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };
  let m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
  if (m) {
    const day = +m[1], mon = +m[2]; let y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000;
    let d = new Date(y, mon - 1, day, 12);
    if (d.getMonth() !== mon - 1) return null; // data inválida (ex.: 31/02)
    if (!m[3] && d < addDays(today, -30)) d = new Date(y + 1, mon - 1, day, 12);
    return d;
  }
  if (/\bdepois de amanha\b/.test(t)) return at(addDays(today, 2));
  if (/\bamanha\b/.test(t)) return at(addDays(today, 1));
  if (/\bhoje\b/.test(t)) return at(today);
  m = /\bem (\d{1,3}) dias?\b|\bdaqui a (\d{1,3}) dias?\b/.exec(t);
  if (m) return at(addDays(today, +(m[1] ?? m[2])));
  if (/\bproxima semana\b/.test(t)) return at(addDays(today, 7));
  m = /\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/.exec(t);
  if (m) {
    const target = WEEKDAYS[m[1]]; let diff = (target - today.getDay() + 7) % 7; if (diff === 0) diff = 7;
    return at(addDays(today, diff));
  }
  m = /\bdia (\d{1,2})\b/.exec(t);
  if (m) { let d = new Date(today.getFullYear(), today.getMonth(), +m[1], 12); if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, +m[1], 12); return d; }
  return null;
}

export function extractPendencyRef(text: string): number | null {
  const m = /(?:pend[eê]ncia|item|tarefa|pnd-?|#)\s*-?\s*(\d{1,6})/i.exec(text);
  return m ? Number(m[1]) : null;
}

const STATUS_PHRASES: [RegExp, StatusKey][] = [
  [/aguardando (o )?fornecedor/, "WAITING_SUPPLIER"], [/aguardando (o )?(time|area) interno|aguardando interno/, "WAITING_INTERNAL"],
  [/aguardando aprovacao/, "WAITING_APPROVAL"], [/aguardando material/, "WAITING_MATERIAL"], [/aguardando documentacao/, "WAITING_DOCUMENTATION"],
  [/aguardando (embarque|mobilizacao)/, "WAITING_MOBILIZATION"], [/em andamento/, "IN_PROGRESS"], [/programada?/, "SCHEDULED"],
  [/bloquead[ao]/, "BLOCKED"], [/\baberta\b/, "OPEN"],
];
export function statusFromText(text: string): StatusKey | null {
  const t = norm(text); for (const [re, s] of STATUS_PHRASES) if (re.test(t)) return s; return null;
}

const STOP = new Set("de da do das dos para por com sem uma uns umas que como sobre entre pela pelo pelas pelos este esta isso essa esse aos nas nos mais menos ainda pendencia item tarefa cobrar sexta feira informou confirmou disse avisou".split(" "));
export const tokens = (s: string) => norm(s).split(/[^a-z0-9-]+/).filter((w) => w.length > 3 && !STOP.has(w));

export function similarity(a: string, b: string): number {
  const A = new Set(tokens(a)), B = new Set(tokens(b)); if (!A.size || !B.size) return 0;
  let i = 0; A.forEach((x) => B.has(x) && i++); return i / (A.size + B.size - i);
}

export type Intent =
  | { kind: "create"; title: string } | { kind: "set_status"; ref: number; status: StatusKey } | { kind: "postpone"; ref: number; date: Date }
  | { kind: "set_priority"; ref: number; priority: string } | { kind: "complete"; ref: number; evidence: string | null } | { kind: "cancel"; ref: number; reason: string | null }
  | { kind: "today" } | { kind: "overdue" } | { kind: "mine" } | { kind: "waiting_supplier" } | { kind: "stale"; days: number }
  | { kind: "risk"; subject: string } | { kind: "chase" } | { kind: "blockers" } | { kind: "summarize"; ref: number | null }
  | { kind: "changes"; days: number } | { kind: "related"; subject: string } | { kind: "update_info" } | { kind: "unknown" };

const REPORT_VERBS = /(informou|confirmou|avisou|disse|enviou|entregou|aprovou|recebemos|recebi|atrasou|adiou|liberou|reprovou|solicitou|pediu|respondeu|retornou|prometeu|vai entregar|ficou de|chegou|embarcou|foi aprovad|foi entregue)/;

export function classify(raw: string, now = new Date()): Intent {
  const text = raw.trim(); const t = norm(text); const ref = extractPendencyRef(text);
  // --- comandos de escrita ---
  const create = /^(crie|criar|cadastre|cadastrar|adicione|adicionar|abra|abrir|registre|registrar|nova)\b.*?\b(pendencia|tarefa|item)\b\s*(?:para|de|:|-)?\s*(.+)$/is.exec(t);
  if (create && create[3].trim().length > 2) return { kind: "create", title: text.slice(t.length - create[3].length).trim().replace(/[.!]+$/, "") };
  if (/\b(conclua|concluir|finalize|finalizar|encerre|encerrar)\b|marque.*como (concluida|concluido|finalizada)/.test(t) && ref)
    return { kind: "complete", ref, evidence: /[:—]\s*(.{3,})$/.exec(text)?.[1] ?? /\bevidencia\s+(.{3,})$/i.exec(text)?.[1] ?? null };
  if (/\b(cancele|cancelar)\b/.test(t) && ref) return { kind: "cancel", ref, reason: /[:—]\s*(.{3,})$/.exec(text)?.[1] ?? null };
  if (/\b(adie|adiar|prorrogue|prorrogar|reagende|reagendar|mude o prazo|altere o prazo|mudar o prazo|alterar o prazo)\b/.test(t) && ref) {
    const after = text.split(/\bpara\b/i).slice(1).join(" para ") || text; const d = parseDatePt(after, now);
    if (d) return { kind: "postpone", ref, date: d };
  }
  const pr = /\bprioridade\b.*\b(p[1-4])\b|\b(p[1-4])\b.*\bprioridade\b/.exec(t);
  if (pr && ref && /(altere|mude|alterar|mudar|defina|coloque|passe)/.test(t)) return { kind: "set_priority", ref, priority: (pr[1] ?? pr[2]).toUpperCase() };
  if (ref && /\b(marque|altere|mude|coloque|passe|defina|alterar|mudar|marcar)\b/.test(t)) { const s = statusFromText(text); if (s) return { kind: "set_status", ref, status: s }; }
  // --- consultas ---
  const days = /(\d+)\s*dias?/.exec(t);
  if (/sem atualiza|nao atualiza|desatualizad|parad[ao]s? ha/.test(t)) return { kind: "stale", days: days ? +days[1] : 7 };
  if (/o que mudou|mudancas|novidades|alteracoes/.test(t)) return { kind: "changes", days: /hoje/.test(t) ? 1 : /ontem/.test(t) ? 2 : 7 };
  if (/resum[ao]|historico d[ae]/.test(t)) return { kind: "summarize", ref };
  if (/(relacionad|mesmo equipamento|mesma tag|da tag|do equipamento|do tag)/.test(t)) { const m = /\b([A-Za-z]{1,4}-[A-Za-z0-9]+)\b/.exec(text); return { kind: "related", subject: m?.[1] ?? text }; }
  if (/(pode|podem|vai|vao) atrasar|em risco|riscos?\b|ameac/.test(t)) return { kind: "risk", subject: text };
  if (/cobrar|cobranca|quem (eu )?(preciso|devo) cobrar/.test(t) && !create) return { kind: "chase" };
  if (/bloqueiam|bloqueando|bloqueios?\b|bloqueadas?/.test(t)) return { kind: "blockers" };
  if (/aguardando (o )?fornecedor|esperando (o )?fornecedor|depende de fornecedor/.test(t) && /\?|quais|o que|liste|mostre/.test(t)) return { kind: "waiting_supplier" };
  if (/vencid|atrasad/.test(t) && /(\?|quais|o que|liste|mostre|tenho)/.test(t)) return { kind: "overdue" };
  if (/depend(e|em) de mim|minhas pendencias|o que e (meu|minha)|meu(s)? item/.test(t)) return { kind: "mine" };
  if (/\bhoje\b/.test(t) && /(fazer|prioridade|agenda|foco|comecar|priorizar)/.test(t) || /o que devo fazer|por onde comeco|proximas acoes/.test(t)) return { kind: "today" };
  if (REPORT_VERBS.test(t)) return { kind: "update_info" };
  return { kind: "unknown" };
}
