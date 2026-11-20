export interface QuoteTextChoice {
  text: string | null;
  edited: boolean;
}

/** Display data for a Reply's Quote after the Original lookup. */
export interface QuoteDisplay {
  author: string;
  authorJid: string | null;
  text: string | null;
  mediaType: string | null;
  edited: boolean;
  missing: boolean;
}

/** Pick the current Original text before falling back to the Quote copy. */
export function chooseQuoteText(
  originalText: string | null | undefined,
  quoteCopyText: string | null | undefined,
): QuoteTextChoice {
  const original = originalText || null;
  const copy = quoteCopyText || null;
  const hasOriginal = original !== null;
  const hasCopy = copy !== null;

  return {
    text: hasOriginal ? original : copy,
    edited: hasOriginal && hasCopy && original !== copy,
  };
}

/** Split text into the rows a fixed-width terminal bubble will display. */
export function wrapTextRows(text: string, width: number): string[] {
  if (text.length === 0) return [];
  const safeWidth = Math.max(1, Math.floor(width));
  const rows: string[] = [];

  for (const sourceLine of text.split("\n")) {
    if (sourceLine.length === 0) {
      rows.push("");
      continue;
    }

    let remaining = sourceLine;
    while (remaining.length > safeWidth) {
      let breakAt = remaining.lastIndexOf(" ", safeWidth);
      if (breakAt <= 0) breakAt = safeWidth;
      rows.push(remaining.slice(0, breakAt).replace(/\s+$/, ""));
      remaining = remaining.slice(breakAt).replace(/^\s+/, "");
    }
    rows.push(remaining);
  }

  return rows;
}

export function wrappedRowCount(text: string, width: number): number {
  return wrapTextRows(text, width).length;
}

/** Read and validate WA_TUI_QUOTE_MAX_LINES. */
export function quoteMaxLines(value: string | number | undefined = process.env.WA_TUI_QUOTE_MAX_LINES): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.max(1, Math.floor(parsed));
}

export interface QuoteRowsPlan {
  /** Text rows only; the Quote author line is intentionally not included. */
  rows: string[];
  /** Number of wrapped rows before folding or the max-line cap. */
  originalRows: number;
  /** Number of original rows shown as content, excluding the suffix. */
  visibleContentRows: number;
  /** Number of original wrapped rows omitted by the suffix. */
  moreLines: number;
  folded: boolean;
  truncated: boolean;
  /** Actual on-screen rows, including a multi-row suffix if it wraps. */
  totalRows: number;
}

function moreLabel(count: number): string {
  return `… ${count} more ${count === 1 ? "line" : "lines"}`;
}

/**
 * Apply the Quote folding and line cap rules to already wrap-aware rows.
 * `isCursor` is true only while the Reply itself is selected.
 */
export function planQuoteRows(
  text: string,
  width: number,
  isCursor: boolean,
  maxLines: number = quoteMaxLines(),
): QuoteRowsPlan {
  const allRows = wrapTextRows(text, width);
  const originalRows = allRows.length;
  const safeMax = Math.max(1, Math.floor(maxLines));
  const foldLimit = isCursor ? originalRows : 3;
  const folded = !isCursor && originalRows > foldLimit;

  if (originalRows === 0) {
    return {
      rows: [], originalRows: 0, visibleContentRows: 0, moreLines: 0,
      folded: false, truncated: false, totalRows: 0,
    };
  }

  let visibleContentRows = Math.min(
    originalRows,
    foldLimit,
    originalRows > safeMax ? Math.max(0, safeMax - 1) : safeMax,
  );
  while (visibleContentRows >= 0) {
    const moreLines = originalRows - visibleContentRows;
    if (moreLines === 0) {
      const rows = allRows.slice(0, visibleContentRows);
      return {
        rows,
        originalRows,
        visibleContentRows,
        moreLines: 0,
        folded,
        truncated: false,
        totalRows: rows.length,
      };
    }

    const suffixRows = wrapTextRows(moreLabel(moreLines), width);
    if (visibleContentRows + suffixRows.length <= safeMax || visibleContentRows === 0) {
      const rows = [...allRows.slice(0, visibleContentRows), ...suffixRows].slice(0, safeMax);
      return {
        rows,
        originalRows,
        visibleContentRows,
        moreLines,
        folded,
        truncated: true,
        totalRows: rows.length,
      };
    }
    visibleContentRows--;
  }

  // safeMax is at least one, so the loop above always returns. Keep a narrow
  // fallback for defensive callers that pass unusual numeric values.
  const rows = [moreLabel(originalRows)].slice(0, safeMax);
  return {
    rows,
    originalRows,
    visibleContentRows: 0,
    moreLines: originalRows,
    folded,
    truncated: true,
    totalRows: rows.length,
  };
}

export function quoteScreenRows(plan: QuoteRowsPlan, hasAuthor: boolean): number {
  return plan.totalRows + (hasAuthor ? 1 : 0);
}
