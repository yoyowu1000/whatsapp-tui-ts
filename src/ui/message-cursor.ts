import { HIDDEN_MESSAGE_TYPES } from "./image.ts";
import type { MessageRow } from "../store/queries.ts";

/** Follow live messages only at the newest position outside VISUAL mode. */
export function cursorAfterReload(
  before: readonly MessageRow[],
  after: readonly MessageRow[],
  index: number,
  visual: boolean,
): number {
  if (!visual && index === visibleMessageIndex(before, 0)) return visibleMessageIndex(after, 0);
  const id = before[index]?.id;
  const next = id ? after.findIndex((message) => message.id === id) : -1;
  return visibleMessageIndex(after, next >= 0 ? next : index);
}

export function isVisibleMessage(message: Pick<MessageRow, "type">): boolean {
  return !HIDDEN_MESSAGE_TYPES.has(message.type);
}

/** Find a displayed row at/after a raw index, falling back towards newer rows. */
export function visibleMessageIndex(messages: readonly MessageRow[], index: number): number {
  const start = Math.max(0, Math.min(index, messages.length - 1));
  for (let i = start; i < messages.length; i++) if (isVisibleMessage(messages[i]!)) return i;
  for (let i = start - 1; i >= 0; i--) if (isVisibleMessage(messages[i]!)) return i;
  return -1;
}

/** Count visible messages, but keep indices into the original newest-first array. */
export function moveMessageCursor(messages: readonly MessageRow[], index: number, delta: number): number {
  const visible = messages.flatMap((message, i) => isVisibleMessage(message) ? [i] : []);
  if (visible.length === 0) return -1;
  // A legacy hidden cursor should land on the next displayed row in the
  // requested direction, without skipping an extra visible message.
  let position = visible.indexOf(index);
  if (position < 0) {
    if (delta < 0) {
      position = visible.findLastIndex(i => i < index);
      return visible[Math.max(0, position + delta + 1)]!;
    }
    position = visible.findIndex(i => i > index);
    if (position < 0) position = visible.length - 1;
    return visible[Math.min(visible.length - 1, position + Math.max(0, delta - 1))]!;
  }
  return visible[Math.max(0, Math.min(visible.length - 1, position + delta))]!;
}
