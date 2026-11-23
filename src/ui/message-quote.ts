import type { StoreQueries, MessageRow } from "../store/queries.ts";
import { resolveSenderName } from "../utils/text.ts";
import { mediaLabel } from "../wa/message-types.ts";
import { chooseQuoteText, type QuoteDisplay } from "./quote.ts";

function quoteMediaType(original: MessageRow | null, quoteType: string | null | undefined): string | null {
  const candidates = [original?.media_type, original?.type, quoteType];
  for (const type of candidates) {
    if (type && mediaLabel(type)) return type;
  }
  return null;
}

/** Resolve the saved Original and the Quote copy without touching the network. */
export function resolveQuote(msg: MessageRow, queries: Pick<StoreQueries, "getMessage" | "resolveContactName">): QuoteDisplay | null {
  if (!msg.quoted_id) return null;

  const original = queries.getMessage(msg.quoted_id);
  const choice = chooseQuoteText(original?.text, msg.quoted_text);
  const mediaType = quoteMediaType(original, msg.quoted_type);
  const hasContent = !!choice.text || !!mediaType;

  const authorJid = original?.from_me === 1
    ? null
    : msg.quoted_author ?? original?.sender_jid ?? null;
  const author = original?.from_me === 1
    ? "You"
    : authorJid
      ? resolveSenderName(queries, authorJid, original?.push_name)
      : original?.push_name ?? "Unknown";

  return {
    author,
    authorJid,
    text: choice.text,
    mediaType,
    edited: choice.edited,
    missing: !hasContent,
  };
}

/** Quote content shared by the bubble and clipboard; no folding or wrapping. */
export function quoteBodyText(quote: QuoteDisplay): string {
  if (quote.missing) return "Reply to a message wa doesn't have";
  if (quote.mediaType) {
    const label = mediaLabel(quote.mediaType) || quote.mediaType;
    return quote.text ? `${label}: ${quote.text}` : label;
  }
  return quote.text ?? "";
}

/** Plain-text quotation, with each source line marked independently. */
export function formatQuoteForCopy(quote: QuoteDisplay | null): string | null {
  if (!quote) return null;
  const lines = quote.missing ? [] : [`${quote.author}${quote.edited ? " · edited" : ""}`];
  lines.push(...quoteBodyText(quote).split(/\r?\n/));
  return lines.map(line => `> ${line}`).join("\n");
}
