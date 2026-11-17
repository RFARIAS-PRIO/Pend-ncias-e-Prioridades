import type { PendencyRow } from "@/server/pendencies";

export interface RowDTO {
  id: string; number: number; title: string; status: string; priority: string;
  dueDate: string | null; followUpDate: string | null;
  project: string | null; asset: string | null; supplier: string | null; tag: string | null;
  owner: string | null; nextOwner: string | null; nextOwnerId: string | null; nextAction: string | null; blockReason: string | null;
  isOverdue: boolean; isBlocked: boolean; staleDays: number; dependentsCount: number;
  score: number; suggested: string; explanation: string;
}
export function toDTO(r: PendencyRow): RowDTO {
  return {
    id: r.id, number: r.number, title: r.title, status: r.status, priority: r.priority,
    dueDate: r.dueDate?.toISOString() ?? null, followUpDate: r.followUpDate?.toISOString() ?? null,
    project: r.project?.name ?? null, asset: r.asset?.name ?? null, supplier: r.supplier?.name ?? null, tag: r.tag,
    owner: r.currentOwner?.name ?? null, nextOwner: r.nextActionOwner?.name ?? null, nextOwnerId: r.nextActionOwnerId,
    nextAction: r.nextAction, blockReason: r.blockReason, isOverdue: r.isOverdue, isBlocked: r.isBlocked,
    staleDays: r.staleDays, dependentsCount: r.dependentsCount,
    score: r.score.score, suggested: r.score.suggested, explanation: r.score.explanation,
  };
}
