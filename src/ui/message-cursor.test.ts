import { describe, expect, it } from "bun:test";
import type { MessageRow } from "../store/queries.ts";
import { cursorAfterReload, moveMessageCursor, visibleMessageIndex } from "./message-cursor.ts";

const message = (id: string) => ({ id, type: "conversation" }) as MessageRow;
const before = [message("m3"), message("m2"), message("m1")];
const after = [message("m4"), ...before];

describe("cursorAfterReload", () => {
  it("keeps the VISUAL cursor on its message, including the newest one", () => {
    expect(cursorAfterReload(before, after, 0, true)).toBe(1);
    expect(cursorAfterReload(before, after, 1, true)).toBe(2);
  });
  it("follows newest in normal mode, but preserves a cursor elsewhere", () => {
    expect(cursorAfterReload(before, after, 0, false)).toBe(0);
    expect(cursorAfterReload(before, after, 1, false)).toBe(2);
  });
  it("clamps safely when the cursor message is gone", () => {
    expect(cursorAfterReload(before, [message("other")], 2, true)).toBe(0);
    expect(cursorAfterReload(before, [], 2, true)).toBe(-1);
  });
});

const hidden = (id: string) => ({ id, type: "reactionMessage" }) as MessageRow;
const mixed = [hidden("edge"), message("new"), hidden("r1"), hidden("r2"), message("middle"), message("old"), hidden("tail")];

describe("visible message navigation", () => {
  it("moves one visible message at a time in either direction", () => {
    expect(moveMessageCursor(mixed, 1, 1)).toBe(4);
    expect(moveMessageCursor(mixed, 4, -1)).toBe(1);
  });
  it("counts visible rows when paging, clamping at visible endpoints", () => {
    expect(moveMessageCursor(mixed, 1, 2)).toBe(5);
    expect(moveMessageCursor(mixed, 1, 10)).toBe(5);
    expect(moveMessageCursor(mixed, 5, -10)).toBe(1);
  });
  it("normalizes endpoints and legacy hidden cursors", () => {
    expect(visibleMessageIndex(mixed, 0)).toBe(1);
    expect(visibleMessageIndex(mixed, 6)).toBe(5);
    expect(moveMessageCursor(mixed, 2, 1)).toBe(4);
    expect(moveMessageCursor(mixed, 3, -1)).toBe(1);
  });
  it("returns no target for empty or entirely hidden lists", () => {
    expect(visibleMessageIndex([], 0)).toBe(-1);
    expect(moveMessageCursor([hidden("r")], 0, 1)).toBe(-1);
  });
  it("follows the newest displayed message even with a hidden leading row", () => {
    expect(cursorAfterReload(mixed, [message("live"), ...mixed], 1, false)).toBe(0);
    expect(cursorAfterReload(mixed, [message("live"), ...mixed], 1, true)).toBe(2);
  });
});
