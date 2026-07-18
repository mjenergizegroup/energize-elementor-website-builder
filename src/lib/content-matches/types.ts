export type ContentMatchStatus = "matched" | "check" | "empty";

export interface ContentMatchCandidate {
  sourcePageId: string;
  title: string;
  path: string;
  preview: string;
  score: number;
  signals: string[];
}

export interface ContentMatchResult {
  pagePlanItemId: string;
  sourcePageId?: string;
  score: number;
  signals: string[];
  candidates: ContentMatchCandidate[];
  status: ContentMatchStatus;
  confirmedByUser: boolean;
  normalizedContentRevision?: number;
}

export interface PersistedContentMatch extends ContentMatchResult {
  id: string;
  createdAt: string;
  updatedAt: string;
}
