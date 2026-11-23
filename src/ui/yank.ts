import type { MessageRow } from "../store/queries.ts";
import { HIDDEN_MESSAGE_TYPES, IMAGE_MEDIA_TYPES } from "./image.ts";
import type { ClipboardPart } from "../utils/clipboard-image.ts";

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
 * messages. Image captions are not counted as text: images alone are copied
 * as files, and only a selection that also holds text messages becomes a
 * mixed document (see buildMixedParts). Quotes are included even on images,
 * because copying only image files would discard the Reply's context.
 */
export function planYank(
  msgs: readonly MessageRow[],
  quoteOf: (m: MessageRow) => string | null = () => null,
): YankPlan {
  const images: MessageRow[] = [];
  const texts: string[] = [];
  for (const m of msgs) {
    const quote = quoteOf(m);
    const image = IMAGE_MEDIA_TYPES.has(m.media_type ?? m.type);
    if (image) images.push(m);
    // A quoted image Reply needs a mixed document to retain its Quote;
    // ordinary image-only selections still copy as files.
    const text = [quote, image ? null : m.text].filter(Boolean).join("\n");
    if (text) texts.push(text);
  }
  return { images, texts };
}

/**
 * The parts of a mixed text-and-image copy, in chat order. The sender's name
 * starts each run of messages from one person ("Alice: hi"), as the chat
 * view groups them. An image is its file path (`pathOf`), or a placeholder
 * when it could not be fetched; its caption follows it. Messages with no
 * text and no image (a document, say) are skipped.
 */
export function buildMixedParts(
  msgs: readonly MessageRow[],
  pathOf: (m: MessageRow) => string | null | undefined,
  nameOf: (m: MessageRow) => string,
  quoteOf: (m: MessageRow) => string | null = () => null,
): ClipboardPart[] {
  const parts: ClipboardPart[] = [];
  let lastSender: string | null = null;
  for (const m of msgs) {
    const name = nameOf(m);
    // Display names aren't identities: two group members may share one.
    const sender = m.from_me ? "self" : `peer:${m.sender_jid || m.chat_jid || m.id}`;
    const newSender = sender !== lastSender;
    const quote = quoteOf(m);
    if (quote) {
      if (newSender) parts.push({ text: `${name}:` });
      parts.push({ text: quote });
      if (IMAGE_MEDIA_TYPES.has(m.media_type ?? m.type)) {
        const path = pathOf(m);
        parts.push(path ? { image: path } : { text: "[image unavailable]" });
      }
      if (m.text) parts.push({ text: m.text });
    } else if (IMAGE_MEDIA_TYPES.has(m.media_type ?? m.type)) {
      if (newSender) parts.push({ text: `${name}:` });
      const path = pathOf(m);
      parts.push(path ? { image: path } : { text: "[image unavailable]" });
      if (m.text) parts.push({ text: m.text });
    } else if (m.text) {
      parts.push({ text: newSender ? `${name}: ${m.text}` : m.text });
    } else {
      continue;
    }
    lastSender = sender;
  }
  return parts;
}
