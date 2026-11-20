import { describe, expect, it } from "bun:test";
import { clearJumpLists, popJumpPosition, pushJumpPosition } from "./jump-list.ts";

describe("jump list", () => {
  it("pushes positions and caps the oldest entries", () => {
    let positions: string[] = [];
    for (let i = 1; i <= 52; i++) {
      positions = pushJumpPosition(positions, `m${i}`);
    }
    expect(positions).toHaveLength(50);
    expect(positions[0]).toBe("m3");
    expect(positions[49]).toBe("m52");
  });

  it("pops the most recent position without mutating the input", () => {
    const positions = ["m1", "m2"];
    expect(popJumpPosition(positions)).toEqual({ messageId: "m2", remaining: ["m1"] });
    expect(positions).toEqual(["m1", "m2"]);
    expect(popJumpPosition([])).toEqual({ messageId: null, remaining: [] });
  });

  it("clears every chat's jump list", () => {
    expect(clearJumpLists({ chatA: ["m1"], chatB: ["m2", "m3"] })).toEqual({});
  });
});
