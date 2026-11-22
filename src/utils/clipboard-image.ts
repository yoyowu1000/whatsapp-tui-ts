/**
 * Extract an image from the macOS clipboard via osascript and save it to a
 * temporary file. Returns the file path on success, or null if the clipboard
 * doesn't contain image data.
 *
 * Used by the input handler to support Cmd+V / Ctrl+V image paste, mirroring
 * how Claude Code and other native CLIs handle clipboard image attachments.
 *
 * Implementation: AppleScript's `the clipboard as «class PNGf»` returns the
 * clipboard data interpreted as a PNG-format image (or throws if there's no
 * image). We write it to /tmp/wa-tui-clipboard-<ts>-<rand>.png and return
 * the path. Caller is responsible for cleaning up the temp file after send.
 */

import { execFileSync } from "child_process";
import { existsSync, statSync, mkdirSync, unlinkSync } from "fs";
import { randomBytes } from "crypto";

const TEMP_DIR = "/tmp/wa-tui-clipboard";

function ensureTempDir(): boolean {
  try {
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronously check the clipboard for image content. Blocking call (~50-200ms
 * for osascript spawn). Returns the path to a temp PNG file if successful,
 * null if the clipboard has no image or osascript failed.
 *
 * Synchronous because the calling key handler needs to decide whether to
 * preventDefault BEFORE the textarea processes the paste event. Async would
 * race with text paste fallthrough.
 */
export function tryExtractClipboardImageSync(): string | null {
  if (process.platform !== "darwin") return null;
  if (!ensureTempDir()) return null;

  const tmpPath = `${TEMP_DIR}/${Date.now()}-${randomBytes(4).toString("hex")}.png`;

  // AppleScript: try to read clipboard as PNG, write to file, return "ok" or
  // "no image" on failure. Wrapped in `try ... on error ... end try` so the
  // script never raises — we use stdout to discriminate.
  const script = `try
  set theImage to the clipboard as «class PNGf»
  set theFile to (open for access POSIX file "${tmpPath}" with write permission)
  write theImage to theFile
  close access theFile
  return "ok"
on error
  return "no image"
end try`;

  try {
    const result = execFileSync("osascript", ["-e", script], {
      encoding: "utf-8",
      timeout: 2000,
    }).trim();

    if (result !== "ok") return null;
    if (!existsSync(tmpPath)) return null;
    if (statSync(tmpPath).size === 0) return null;

    return tmpPath;
  } catch {
    return null;
  }
}

// ── Writing images (and mixed messages) to the clipboard ───────────

/** One message in a mixed copy: its text, or an image file. */
export type ClipboardPart = { text: string } | { image: string };

/** The clipboard's text and HTML forms of a mixed copy. */
export interface ClipboardDoc {
  /** Plain text: messages in order, each image as its file path on its own
   *  line. Terminals paste this; Claude Code turns a pasted image path into
   *  an attachment. */
  text: string;
  /** HTML for browser editors: paragraphs and inline images. Browsers will
   *  not load file:// images from a paste, so images are inlined as data URIs. */
  html: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Build the text and HTML forms. `dataUri` turns an image path into a data: URI. */
export function buildClipboardDoc(parts: readonly ClipboardPart[], dataUri: (path: string) => string): ClipboardDoc {
  const text = parts.map((p) => ("text" in p ? p.text : p.image)).join("\n");
  const html = parts
    .map((p) => ("text" in p
      ? `<p>${escapeHtml(p.text).replace(/\n/g, "<br>")}</p>`
      : `<p><img src="${dataUri(p.image)}" style="max-width:100%"></p>`))
    .join("\n");
  return { text, html };
}

const DATA_URI_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

async function fileDataUri(path: string): Promise<string> {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const type = DATA_URI_TYPES[ext] ?? "application/octet-stream";
  const b64 = Buffer.from(await Bun.file(path).arrayBuffer()).toString("base64");
  return `data:${type};base64,${b64}`;
}

// JXA (JavaScript for Automation) script that writes the clipboard from a
// JSON spec file (path in argv[0]), so no message text or file name is ever
// interpolated into the script.
//   spec.doc   — optional first item: plain text, HTML, RTFD (rich text with
//                images, for Notes / TextEdit / Pages / Mail) and the first
//                image as PNG (for apps that paste one picture).
//   spec.files — one item per image: its file URL (Finder, Slack and Mail
//                attach every file) and the image as PNG.
const WRITE_CLIPBOARD_JXA = `ObjC.import("AppKit");
function pngOf(path) {
  const image = $.NSImage.alloc.initWithContentsOfFile(path);
  if (image.isNil()) return null;
  const rep = $.NSBitmapImageRep.imageRepWithData(image.TIFFRepresentation);
  if (rep.isNil()) return null;
  return rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}));
}
// Plain run of text. JXA can't reach -[NSAttributedString initWithString:],
// so append to a fresh string's characters (a fresh one, so the text doesn't
// inherit an attachment's attributes from the run before it).
function plain(text) {
  const run = $.NSMutableAttributedString.new;
  run.mutableString.appendString(text);
  return run;
}
function rtfdOf(parts) {
  const doc = $.NSMutableAttributedString.new;
  parts.forEach((part, i) => {
    if (i > 0) doc.appendAttributedString(plain("\\n"));
    if (part.text !== undefined) {
      doc.appendAttributedString(plain(part.text));
    } else {
      const wrapper = $.NSFileWrapper.alloc.initWithURLOptionsError($.NSURL.fileURLWithPath(part.image), 0, null);
      if (wrapper.isNil()) return;
      const attachment = $.NSTextAttachment.alloc.initWithFileWrapper(wrapper);
      doc.appendAttributedString($.NSAttributedString.attributedStringWithAttachment(attachment));
    }
  });
  return doc.RTFDFromRangeDocumentAttributes($.NSMakeRange(0, doc.length), $({}));
}
function run(argv) {
  const raw = $.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null);
  const spec = JSON.parse(raw.js);
  const items = [];
  if (spec.doc) {
    const item = $.NSPasteboardItem.alloc.init;
    item.setStringForType(spec.doc.text, "public.utf8-plain-text");
    item.setStringForType(spec.doc.html, "public.html");
    const rtfd = rtfdOf(spec.doc.parts);
    if (!rtfd.isNil()) item.setDataForType(rtfd, "com.apple.flat-rtfd");
    const firstImage = spec.doc.parts.find((p) => p.image !== undefined);
    const png = firstImage ? pngOf(firstImage.image) : null;
    if (png) item.setDataForType(png, "public.png");
    items.push(item);
  }
  for (const path of spec.files) {
    const item = $.NSPasteboardItem.alloc.init;
    item.setStringForType($.NSURL.fileURLWithPath(path).absoluteString, "public.file-url");
    const png = pngOf(path);
    if (png) item.setDataForType(png, "public.png");
    items.push(item);
  }
  const pb = $.NSPasteboard.generalPasteboard;
  pb.clearContents;
  return pb.writeObjects($(items)) ? "ok" : "fail";
}`;

interface ClipboardSpec {
  doc?: ClipboardDoc & { parts: ClipboardPart[] };
  files: string[];
}

async function writeClipboard(spec: ClipboardSpec): Promise<void> {
  if (process.platform !== "darwin") throw new Error("Image copy needs macOS");
  if (!ensureTempDir()) throw new Error("Can't create temp dir");
  const specPath = `${TEMP_DIR}/copy-${Date.now()}-${randomBytes(4).toString("hex")}.json`;
  await Bun.write(specPath, JSON.stringify(spec));
  const proc = Bun.spawn(["osascript", "-l", "JavaScript", "-e", WRITE_CLIPBOARD_JXA, "--", specPath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => proc.kill(), 15_000);
  try {
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0 || out.trim() !== "ok") {
      throw new Error(err.trim() || `osascript exited ${code}`);
    }
  } finally {
    clearTimeout(timer);
    try { unlinkSync(specPath); } catch {}
  }
}

/**
 * Put image files on the macOS clipboard, replacing what was there. Throws
 * when not on macOS or when the pasteboard write fails. OSC 52 (used for
 * text yank) carries only text, so images need the native pasteboard; this
 * means image yank does not work over SSH.
 */
export async function copyImageFilesToClipboard(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) throw new Error("No images to copy");
  await writeClipboard({ files: [...paths] });
}

/**
 * Put a mix of messages and images on the macOS clipboard as one document,
 * in chat order. Images are not added as separate file items: Chrome then
 * hands web pages only the files and hides the text and HTML, so Slack or
 * Gmail would drop the messages.
 */
export async function copyMixedToClipboard(parts: readonly ClipboardPart[]): Promise<void> {
  if (parts.length === 0) throw new Error("Nothing to copy");
  const uris = new Map<string, string>();
  for (const p of parts) if ("image" in p && !uris.has(p.image)) uris.set(p.image, await fileDataUri(p.image));
  const doc = buildClipboardDoc(parts, (path) => uris.get(path)!);
  await writeClipboard({ doc: { ...doc, parts: [...parts] }, files: [] });
}
