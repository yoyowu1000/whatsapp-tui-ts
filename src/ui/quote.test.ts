import { describe, expect, it } from "bun:test";
import {
  chooseQuoteText,
  planQuoteRows,
  quoteMaxLines,
  quoteScreenRows,
  wrapTextRows,
} from "./quote.ts";

describe("chooseQuoteText", () => {
  it("prefers the saved Original and marks an edit when both differ", () => {
    expect(chooseQuoteText("Current text", "Old text")).toEqual({
      text: "Current text",
      edited: true,
    });
  });

  it("uses the only text available without marking it edited", () => {
    expect(chooseQuoteText(null, "Quote copy")).toEqual({ text: "Quote copy", edited: false });
    expect(chooseQuoteText("Original", null)).toEqual({ text: "Original", edited: false });
  });

  it("returns no text when neither source exists", () => {
    expect(chooseQuoteText(undefined, "")).toEqual({ text: null, edited: false });
  });
});

describe("quote row maths", () => {
  it("wraps explicit lines and long words into screen rows", () => {
    expect(wrapTextRows("one two\nthree", 5)).toEqual(["one", "two", "three"]);
    expect(wrapTextRows("abcdef", 4)).toEqual(["abcd", "ef"]);
  });

  it("folds an unfocused Quote after three wrapped rows", () => {
    const plan = planQuoteRows("one\ntwo\nthree\nfour", 20, false, 100);
    expect(plan.rows).toEqual(["one", "two", "three", "… 1 more line"]);
    expect(plan.moreLines).toBe(1);
    expect(plan.folded).toBe(true);
    expect(plan.totalRows).toBe(4);
  });

  it("shows the full Quote at the cursor, then caps it with a suffix", () => {
    const plan = planQuoteRows("1\n2\n3\n4\n5", 20, true, 4);
    expect(plan.rows).toEqual(["1", "2", "3", "… 2 more lines"]);
    expect(plan.visibleContentRows).toBe(3);
    expect(plan.moreLines).toBe(2);
    expect(plan.folded).toBe(false);
    expect(plan.totalRows).toBe(4);
  });

  it("counts the Quote author separately from capped Quote rows", () => {
    const plan = planQuoteRows("one\ntwo\nthree\nfour", 20, false, 100);
    expect(quoteScreenRows(plan, true)).toBe(5);
    expect(quoteScreenRows(plan, false)).toBe(4);
  });

  it("uses the default for invalid line-cap values", () => {
    expect(quoteMaxLines(undefined)).toBe(100);
    expect(quoteMaxLines("not-a-number")).toBe(100);
    expect(quoteMaxLines("7.9")).toBe(7);
  });
});
