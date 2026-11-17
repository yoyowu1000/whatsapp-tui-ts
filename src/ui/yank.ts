import type { MessageRow } from "../store/queries.ts";
import { HIDDEN_MESSAGE_TYPES, IMAGE_MEDIA_TYPES } from "./image.ts";

/**
 * Messages covered by a VISUAL selection, oldest first.
 *
 * `msgs` is the chat's store array, newest first (index 0 is the latest
 * message). The anchor is kept as a message id, not an index, because a new
 * message arriving reloads the array and shifts every index. If the anchor
 * message is gone, the selection shrinks to the cursor. Hidden protocol rows
 * (reactions, edits) sit between real messages in the array; they are left
 * out because the user never sees them.
 */
export function visualSelection(
  msgs: readonly MessageRow[],
  anchorId: string | null,
  cursorIndex: number,
): MessageRow[] {
  if (msgs.length === 0) return [];
  const cursor = Math.max(0, Math.min(msgs.length - 1, cursorIndex));
  const found = anchorId ? msgs.findIndex((m) => m.id === anchorId) : -1;
  const anchor = found >= 0 ? found : cursor;
  const lo = Math.min(anchor, cursor);
  const hi = Math.max(anchor, cursor);
  return msgs
    .slice(lo, hi + 1)
    .filter((m) => !HIDDEN_MESSAGE_TYPES.has(m.type))
    .reverse();
}

export interface YankPlan {
  /** Image and sticker messages, in the order given. */
  images: MessageRow[];
  /** Text of the other messages that have any, in the order given. */
  texts: string[];
}

/**
 * Split the messages to yank into images and the text of the other
 * messages. Images win: when any is present only the images are copied,
 * as files. An image's caption is not counted as text.
 */
export function planYank(msgs: readonly MessageRow[]): YankPlan {
  const images: MessageRow[] = [];
  const texts: string[] = [];
  for (const m of msgs) {
    if (IMAGE_MEDIA_TYPES.has(m.media_type ?? m.type)) images.push(m);
    else if (m.text) texts.push(m.text);
  }
  return { images, texts };
}
