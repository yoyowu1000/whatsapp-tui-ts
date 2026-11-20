import { describe, expect, it } from "bun:test";
import { extractQuoteCopy } from "./quote.ts";

describe("extractQuoteCopy", () => {
  it("extracts a conversation and its Quote author", () => {
    expect(extractQuoteCopy({
      participant: "alice@s.whatsapp.net",
      quotedMessage: { conversation: "Can you send the slides?" },
    })).toEqual({
      author: "alice@s.whatsapp.net",
      text: "Can you send the slides?",
      type: "conversation",
    });
  });

  it("extracts extended text and media captions", () => {
    expect(extractQuoteCopy({
      participant: "alice@s.whatsapp.net",
      quotedMessage: { extendedTextMessage: { text: "The longer version" } },
    })).toEqual({
      author: "alice@s.whatsapp.net",
      text: "The longer version",
      type: "extendedTextMessage",
    });
    expect(extractQuoteCopy({
      quotedMessage: { imageMessage: { caption: "Tuesday's slides", jpegThumbnail: "..." } },
    })).toEqual({
      author: null,
      text: "Tuesday's slides",
      type: "imageMessage",
    });
  });

  it("unwraps a wrapped Quote copy", () => {
    expect(extractQuoteCopy({
      participant: "alice@s.whatsapp.net",
      quotedMessage: {
        ephemeralMessage: { message: { videoMessage: { caption: "Watch this" } } },
      },
    })).toEqual({
      author: "alice@s.whatsapp.net",
      text: "Watch this",
      type: "videoMessage",
    });
  });

  it("keeps the author when WhatsApp omitted the Quote copy", () => {
    expect(extractQuoteCopy({ participant: "alice@s.whatsapp.net" })).toEqual({
      author: "alice@s.whatsapp.net",
      text: null,
      type: null,
    });
  });
});
