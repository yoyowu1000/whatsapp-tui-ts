import type { MessageRow } from "../store/queries.ts";
import { IMAGE_MEDIA_TYPES } from "./image.ts";

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
