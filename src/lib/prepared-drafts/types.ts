import type { AtomicElement } from "@/lib/elementor/atomic/types";

export type PreparedDraftStatus = "ready" | "needs_attention";

export interface PreparedDraftResult {
  pagePlanItemId: string;
  layoutRevisionId: string;
  sourcePageId?: string;
  sourceContentRevision?: number;
  contentChecksum: string;
  artifact: AtomicElement[];
  notes: string[];
  residueReport: string[];
  status: PreparedDraftStatus;
  adapterId: string;
  adapterVersion: string;
  replacedSlots: number;
  appendedSlots: number;
  removedPlaceholders: number;
}

export interface PreparedDraftSummary {
  id: string;
  pagePlanItemId: string;
  layoutRevisionId: string;
  version: number;
  sourcePageId?: string;
  sourceContentRevision?: number;
  contentChecksum: string;
  notes: string[];
  residueReport: string[];
  status: PreparedDraftStatus;
  adapterId: string;
  adapterVersion: string;
  createdAt: string;
}
