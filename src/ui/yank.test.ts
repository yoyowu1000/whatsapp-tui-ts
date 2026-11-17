import { describe, expect, it } from "bun:test";
import type { MessageRow } from "../store/queries.ts";
import { planYank, visualSelection } from "./yank.ts";

function msg(id: string, fields: Partial<MessageRow> = {}): MessageRow {
  return { id, type: "conversation", text: id, media_type: null, ...fields } as MessageRow;
}

// Store order: newest first.
const chat = [
  msg("m5"),
  msg("img4", { type: "imageMessage", media_type: "imageMessage", text: "caption" }),
  msg("r3", { type: "reactionMessage", text: null }),
  msg("img2", { type: "imageMessage", media_type: "imageMessage", text: null }),
  msg("m1"),
];

describe("visualSelection", () => {
  it("returns the range between anchor and cursor, oldest first, either direction", () => {
    const up = visualSelection(chat, "m5", 3).map((m) => m.id);
    const down = visualSelection(chat, "img2", 0).map((m) => m.id);
    expect(up).toEqual(["img2", "img4", "m5"]);
    expect(down).toEqual(["img2", "img4", "m5"]);
  });

  it("leaves out hidden protocol rows", () => {
    expect(visualSelection(chat, "m1", 0).map((m) => m.id)).toEqual(["m1", "img2", "img4", "m5"]);
  });

  it("falls back to the cursor when the anchor message is gone", () => {
    expect(visualSelection(chat, "missing", 1).map((m) => m.id)).toEqual(["img4"]);
    expect(visualSelection(chat, null, 4).map((m) => m.id)).toEqual(["m1"]);
  });

  it("clamps a cursor past the end and handles an empty chat", () => {
    expect(visualSelection(chat, "m1", 99).map((m) => m.id)).toEqual(["m1"]);
    expect(visualSelection([], "m1", 0)).toEqual([]);
  });
});

describe("planYank", () => {
  it("separates images (including stickers) from text messages", () => {
    const sticker = msg("s", { type: "stickerMessage", media_type: "stickerMessage", text: null });
    const plan = planYank([chat[4]!, chat[3]!, sticker, chat[1]!, chat[0]!]);
    expect(plan.images.map((m) => m.id)).toEqual(["img2", "s", "img4"]);
    expect(plan.texts).toEqual(["m1", "m5"]);
  });

  it("skips messages with no text", () => {
    const doc = msg("d", { type: "documentMessage", media_type: "documentMessage", text: null });
    expect(planYank([doc])).toEqual({ images: [], texts: [] });
  });
});
