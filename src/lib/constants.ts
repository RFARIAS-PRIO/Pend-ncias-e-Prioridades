export const STATUSES = [
  "OPEN","IN_PROGRESS","WAITING_SUPPLIER","WAITING_INTERNAL","WAITING_APPROVAL","WAITING_MATERIAL",
  "WAITING_DOCUMENTATION","WAITING_MOBILIZATION","SCHEDULED","BLOCKED","DONE","CANCELED",
] as const;
export type StatusKey = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<StatusKey, string> = {
  OPEN: "Aberta", IN_PROGRESS: "Em andamento", WAITING_SUPPLIER: "Aguardando fornecedor",
  WAITING_INTERNAL: "Aguardando time interno", WAITING_APPROVAL: "Aguardando aprovação",
  WAITING_MATERIAL: "Aguardando material", WAITING_DOCUMENTATION: "Aguardando documentação",
  WAITING_MOBILIZATION: "Aguardando embarque/mobilização", SCHEDULED: "Programada",
  BLOCKED: "Bloqueada", DONE: "Concluída", CANCELED: "Cancelada",
};
// Ícone textual: o status nunca depende só de cor
export const STATUS_ICON: Record<StatusKey, string> = {
  OPEN: "○", IN_PROGRESS: "▶", WAITING_SUPPLIER: "⏳", WAITING_INTERNAL: "⏳", WAITING_APPROVAL: "✎",
  WAITING_MATERIAL: "▣", WAITING_DOCUMENTATION: "▤", WAITING_MOBILIZATION: "✈", SCHEDULED: "▦",
  BLOCKED: "⛔", DONE: "✔", CANCELED: "✕",
};
export const WAITING_THIRD_PARTY: StatusKey[] = [
  "WAITING_SUPPLIER","WAITING_APPROVAL","WAITING_MATERIAL","WAITING_DOCUMENTATION","WAITING_MOBILIZATION",
];
export const CLOSED: StatusKey[] = ["DONE","CANCELED"];
export const OPEN_STATUSES = STATUSES.filter((s) => !CLOSED.includes(s));

export const PRIORITIES = ["P1","P2","P3","P4"] as const;
export type PriorityKey = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<PriorityKey, string> = {
  P1: "P1 · Crítica", P2: "P2 · Alta", P3: "P3 · Média", P4: "P4 · Baixa",
};
export const PRIORITY_CLASS: Record<PriorityKey, string> = {
  P1: "bg-red-600 text-white", P2: "bg-orange-500 text-white",
  P3: "bg-amber-300 text-amber-950", P4: "bg-slate-300 text-slate-900 dark:bg-slate-600 dark:text-slate-50",
};

export const IMPACT = ["NONE","LOW","MEDIUM","HIGH"] as const;
export const IMPACT_LABEL: Record<(typeof IMPACT)[number], string> = {
  NONE: "Nenhum", LOW: "Baixo", MEDIUM: "Médio", HIGH: "Alto",
};
export const ROLE_LABEL = { ADMIN: "Administrador", EDITOR: "Editor", VIEWER: "Leitor" } as const;
export const LINK_KIND_LABEL = { LINK: "Link", RC: "RC", PO: "PO", DOCUMENT: "Documento" } as const;
export const HISTORY_LABEL: Record<string, string> = {
  CREATED: "Criada", UPDATED: "Editada", STATUS: "Status", PRIORITY: "Prioridade", DUE_DATE: "Prazo",
  OWNER: "Responsável", COMMENT: "Comentário", UPDATE: "Atualização", BLOCK: "Bloqueio", UNBLOCK: "Desbloqueio",
  COMPLETED: "Concluída", REOPENED: "Reaberta", CANCELED: "Cancelada", DEPENDENCY: "Dependência",
  REFERENCE: "Referência", FOLLOW_UP: "Acompanhamento",
};
