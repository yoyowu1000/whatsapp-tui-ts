import { describe, expect, it } from "bun:test";
import type { MessageRow } from "../store/queries.ts";
import { planYank } from "./yank.ts";

function msg(id: string, fields: Partial<MessageRow> = {}): MessageRow {
  return { id, type: "conversation", text: id, media_type: null, ...fields } as MessageRow;
}

describe("planYank", () => {
  it("separates images (including stickers) from text messages", () => {
    const sticker = msg("s", { type: "stickerMessage", media_type: "stickerMessage", text: null });
    const img2 = msg("img2", { type: "imageMessage", media_type: "imageMessage", text: null });
    const img4 = msg("img4", { type: "imageMessage", media_type: "imageMessage", text: "caption" });
    const plan = planYank([msg("m1"), img2, sticker, img4, msg("m5")]);
    expect(plan.images.map((m) => m.id)).toEqual(["img2", "s", "img4"]);
    expect(plan.texts).toEqual(["m1", "m5"]);
  });

  it("skips messages with no text", () => {
    const doc = msg("d", { type: "documentMessage", media_type: "documentMessage", text: null });
    expect(planYank([doc])).toEqual({ images: [], texts: [] });
  });
});
