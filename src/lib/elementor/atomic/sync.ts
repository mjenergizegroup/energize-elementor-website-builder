import type { AtomicGlobalClass } from "./types";

export interface ElementorGlobalClassListItem {
  id: string;
  label: string;
}

export interface GlobalClassRepairPayload extends Record<string, unknown> {
  context: "frontend";
  changes: {
    added: string[];
    deleted: string[];
    modified: string[];
    order: true;
  };
  items: Record<string, AtomicGlobalClass>;
  order: string[];
}

export function findMissingGlobalClasses(
  foundationClasses: AtomicGlobalClass[],
  existingClasses: ElementorGlobalClassListItem[],
): AtomicGlobalClass[] {
  const existingIds = new Set(existingClasses.map(({ id }) => id));
  return foundationClasses.filter(({ id }) => !existingIds.has(id));
}

export function createGlobalClassRepairPayload(
  foundationClasses: AtomicGlobalClass[],
  existingClasses: ElementorGlobalClassListItem[],
): GlobalClassRepairPayload {
  const missingClasses = findMissingGlobalClasses(
    foundationClasses,
    existingClasses,
  );
  const foundationIds = new Set(foundationClasses.map(({ id }) => id));
  const extraExistingIds = existingClasses
    .map(({ id }) => id)
    .filter((id) => !foundationIds.has(id));

  return {
    context: "frontend",
    changes: {
      added: missingClasses.map(({ id }) => id),
      deleted: [],
      modified: [],
      order: true,
    },
    items: Object.fromEntries(
      missingClasses.map((globalClass) => [globalClass.id, globalClass]),
    ),
    order: [
      ...foundationClasses.map(({ id }) => id),
      ...extraExistingIds,
    ],
  };
}
