import { describe, expect, it } from "bun:test";
import type { MessageRow } from "../store/queries.ts";
import { buildMixedParts, planYank, visualSelection } from "./yank.ts";

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

describe("buildMixedParts", () => {
  const names: Record<string, string> = { a: "Alice", me: "You" };
  const nameOf = (m: MessageRow) => names[m.sender_jid ?? ""] ?? "?";
  const paths: Record<string, string> = { img1: "/m/img1.jpg" };
  const pathOf = (m: MessageRow) => paths[m.id];

  it("keeps chat order, names each run of one sender, and follows an image with its caption", () => {
    const parts = buildMixedParts([
      msg("t1", { sender_jid: "a", text: "look" }),
      msg("img1", { sender_jid: "a", type: "imageMessage", media_type: "imageMessage", text: "the view" }),
      msg("t2", { sender_jid: "me", text: "nice" }),
      msg("t3", { sender_jid: "me", text: "really" }),
    ], pathOf, nameOf);
    expect(parts).toEqual([
      { text: "Alice: look" },
      { image: "/m/img1.jpg" },
      { text: "the view" },
      { text: "You: nice" },
      { text: "really" },
    ]);
  });

  it("names the sender before an image that starts a run, and marks an unavailable image", () => {
    const parts = buildMixedParts([
      msg("t1", { sender_jid: "me", text: "send it" }),
      msg("gone", { sender_jid: "a", type: "imageMessage", media_type: "imageMessage", text: null }),
      msg("doc", { sender_jid: "a", type: "documentMessage", media_type: "documentMessage", text: null }),
      msg("t2", { sender_jid: "a", text: "oops" }),
    ], pathOf, nameOf);
    expect(parts).toEqual([
      { text: "You: send it" },
      { text: "Alice:" },
      { text: "[image unavailable]" },
      { text: "oops" },
    ]);
  });
});


describe("sender identity in mixed copies", () => {
  it("separates different participants with the same display name", () => {
    expect(buildMixedParts([
      msg("a", { sender_jid: "alice-1", text: "one" }),
      msg("b", { sender_jid: "alice-2", text: "two" }),
    ], () => null, () => "Alex")).toEqual([{ text: "Alex: one" }, { text: "Alex: two" }]);
  });
  it("starts a new sender run for an image from a namesake", () => {
    expect(buildMixedParts([
      msg("a", { sender_jid: "alice-1", text: "one" }),
      msg("b", { sender_jid: "alice-2", type: "imageMessage", media_type: "imageMessage", text: null }),
    ], () => "/synthetic.jpg", () => "Alex")).toEqual([
      { text: "Alex: one" }, { text: "Alex:" }, { image: "/synthetic.jpg" },
    ]);
  });
  it("groups your own consecutive messages even across sender JID variants", () => {
    expect(buildMixedParts([
      msg("a", { sender_jid: "phone", from_me: 1, text: "one" }),
      msg("b", { sender_jid: "lid", from_me: 1, text: "two" }),
      msg("c", { sender_jid: "lid", from_me: 0, text: "three" }),
    ], () => null, () => "You")).toEqual([
      { text: "You: one" }, { text: "two" }, { text: "You: three" },
    ]);
  });
});
