import { describe, expect, it } from "bun:test";
import type { MessageRow } from "../store/queries.ts";
import { cursorAfterReload } from "./message-cursor.ts";

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
    expect(cursorAfterReload(before, [], 2, true)).toBe(0);
  });
});
