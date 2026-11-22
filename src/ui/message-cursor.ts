import type { MessageRow } from "../store/queries.ts";

/** Follow live messages only at the newest position outside VISUAL mode. */
export function cursorAfterReload(
  before: readonly MessageRow[],
  after: readonly MessageRow[],
  index: number,
  visual: boolean,
): number {
  if (!visual && index === 0) return 0;
  const id = before[index]?.id;
  const next = id ? after.findIndex((message) => message.id === id) : -1;
  return next >= 0 ? next : Math.max(0, Math.min(index, after.length - 1));
}
