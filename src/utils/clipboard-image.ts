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

// ── Writing images to the clipboard ────────────────────────────────

// JXA (JavaScript for Automation) script that writes the clipboard from a
// JSON spec file (path in argv[0]), so no file name is ever interpolated into
// the script.
//   spec.files — one item per image: its file URL (Finder, Slack and Mail
//                attach every file) and the image as PNG (apps that paste
//                pixel data, such as Claude Code or Preview, read the first).
const WRITE_CLIPBOARD_JXA = `ObjC.import("AppKit");
function pngOf(path) {
  const image = $.NSImage.alloc.initWithContentsOfFile(path);
  if (image.isNil()) return null;
  const rep = $.NSBitmapImageRep.imageRepWithData(image.TIFFRepresentation);
  if (rep.isNil()) return null;
  return rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}));
}
function run(argv) {
  const raw = $.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null);
  const spec = JSON.parse(raw.js);
  const items = [];
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
