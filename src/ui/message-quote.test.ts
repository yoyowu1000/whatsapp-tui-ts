import { describe, expect, it } from "bun:test";
import type { MessageRow } from "../store/queries.ts";
import { formatQuoteForCopy, quoteBodyText, resolveQuote } from "./message-quote.ts";

const message = (fields: Partial<MessageRow>): MessageRow => ({
  id: "reply", chat_jid: "synthetic@g.us", from_me: 0, timestamp: 1,
  status: 0, type: "conversation", text: "A reminder about this too", ...fields,
});
const queries = (original: MessageRow | null = null) => ({
  getMessage: (_id: string) => original,
  resolveContactName: (_jid: string) => "Example Author",
});

describe("Quote content shared by display and copying", () => {
  it("copies a photo Quote's author, label and caption, without fetching the image", () => {
    const quote = resolveQuote(message({ quoted_id: "photo", quoted_type: "imageMessage", quoted_author: "author", quoted_text: "Please widen the heading" }), queries());
    expect(quoteBodyText(quote!)).toBe("Photo: Please widen the heading");
    expect(formatQuoteForCopy(quote)).toBe("> Example Author\n> Photo: Please widen the heading");
  });
  it("copies current Original text and the same edited marker as the bubble", () => {
    const quote = resolveQuote(message({ quoted_id: "original", quoted_author: "author", quoted_text: "Old version" }), queries(message({ id: "original", text: "Current version" })));
    expect(formatQuoteForCopy(quote)).toBe("> Example Author · edited\n> Current version");
  });
  it("copies full multiline text, independently of the screen fold and cap", () => {
    const text = Array.from({ length: 120 }, (_, i) => `Line ${i + 1}`).join("\n");
    const quote = resolveQuote(message({ quoted_id: "original", quoted_author: "author", quoted_text: text }), queries());
    const copied = formatQuoteForCopy(quote)!;
    expect(copied.split("\n")).toHaveLength(121);
    expect(copied).toEndWith("> Line 120");
    expect(copied).not.toContain("more lines");
  });
  it("keeps a missing-Original marker rather than inventing Quote content", () => {
    expect(formatQuoteForCopy(resolveQuote(message({ quoted_id: "missing" }), queries())))
      .toBe("> Reply to a message wa doesn't have");
  });
  it("labels a saved self-authored Original as You", () => {
    expect(formatQuoteForCopy(resolveQuote(message({ quoted_id: "original" }), queries(message({ id: "original", from_me: 1, text: "My note" })))))
      .toBe("> You\n> My note");
  });
  it("leaves ordinary messages without a Quote", () => {
    expect(formatQuoteForCopy(resolveQuote(message({}), queries()))).toBeNull();
  });
});
