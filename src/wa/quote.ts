/** The Quote copy sent in a Reply's contextInfo. */
export interface QuoteCopy {
  /** JID of the Quote author, when WhatsApp included it. */
  author: string | null;
  /** Text or media caption copied into the Reply. */
  text: string | null;
  /** Baileys message type of the Quote copy. */
  type: string | null;
}

type RecordValue = Record<string, unknown>;

const MESSAGE_TYPES = [
  "conversation",
  "extendedTextMessage",
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "stickerMessage",
  "documentMessage",
  "contactMessage",
  "contactsArrayMessage",
  "locationMessage",
  "liveLocationMessage",
  "buttonsMessage",
  "buttonsResponseMessage",
  "listMessage",
  "listResponseMessage",
  "templateMessage",
  "templateButtonReplyMessage",
  "interactiveMessage",
] as const;

const MESSAGE_WRAPPERS = new Set([
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
]);

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function findMessageContent(message: unknown): { type: string; content: unknown } | null {
  if (!isRecord(message)) return null;

  for (const type of MESSAGE_TYPES) {
    const content = message[type];
    if (content === undefined || content === null) continue;
    if (type === "conversation" && typeof content === "string") {
      return { type, content };
    }
    return { type, content };
  }

  for (const [type, value] of Object.entries(message)) {
    if (value === undefined || value === null || type === "messageContextInfo") continue;
    if (MESSAGE_WRAPPERS.has(type)) {
      const wrapped = isRecord(value) && "message" in value ? value.message : value;
      const inner = findMessageContent(wrapped);
      if (inner) return inner;
    }
  }

  return null;
}

function quoteText(type: string, content: unknown): string | null {
  if (type === "conversation" && typeof content === "string") return content;
  if (!isRecord(content)) return null;

  if (typeof content.text === "string") return content.text;
  if (typeof content.caption === "string") return content.caption;
  return null;
}

/**
 * Extract only the data wa needs to render a Reply's Quote. This is deliberately
 * a pure helper: it reads a plain contextInfo-shaped value and never touches
 * SQLite, a socket, or the live WhatsApp connection.
 */
export function extractQuoteCopy(contextInfo: unknown): QuoteCopy {
  if (!isRecord(contextInfo)) {
    return { author: null, text: null, type: null };
  }

  const author = typeof contextInfo.participant === "string"
    ? contextInfo.participant
    : null;
  const content = findMessageContent(contextInfo.quotedMessage);
  if (!content) return { author, text: null, type: null };

  return {
    author,
    text: quoteText(content.type, content.content),
    type: content.type,
  };
}
