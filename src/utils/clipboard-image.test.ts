import { describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildClipboardDoc, ensureTempDir, writeClipboardSpec } from "./clipboard-image.ts";

describe("buildClipboardDoc", () => {
  const parts = [
    { text: "Alice: <b>hi</b> & \"bye\"\nline two" },
    { image: "/m/a.jpg" },
    { text: "You: ok" },
  ];
  const doc = buildClipboardDoc(parts, (p) => `data:x;base64,${p}`);

  it("plain text keeps order and gives each image as its path", () => {
    expect(doc.text).toBe("Alice: <b>hi</b> & \"bye\"\nline two\n/m/a.jpg\nYou: ok");
  });

  it("HTML escapes message text, keeps line breaks and inlines images in order", () => {
    expect(doc.html).toBe(
      "<p>Alice: &lt;b&gt;hi&lt;/b&gt; &amp; &quot;bye&quot;<br>line two</p>\n" +
      "<p><img src=\"data:x;base64,/m/a.jpg\" style=\"max-width:100%\"></p>\n" +
      "<p>You: ok</p>",
    );
  });
});

describe("private clipboard storage", () => {
  function withTempDir(test: (root: string) => void): void {
    const root = mkdtempSync(join(tmpdir(), "wa-tui-clipboard-test-"));
    try {
      test(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  function mode(path: string): number {
    return statSync(path).mode & 0o777;
  }

  it("creates a new directory with owner-only permissions", () => {
    withTempDir((root) => {
      const path = join(root, "clipboard");
      expect(ensureTempDir(path)).toBe(true);
      expect(mode(path)).toBe(0o700);
    });
  });

  it("tightens an existing directory to owner-only permissions", () => {
    withTempDir((root) => {
      const path = join(root, "clipboard");
      mkdirSync(path);
      chmodSync(path, 0o755);
      expect(ensureTempDir(path)).toBe(true);
      expect(mode(path)).toBe(0o700);
    });
  });

  it("does not follow a pre-existing directory symlink", () => {
    withTempDir((root) => {
      const target = join(root, "target");
      const path = join(root, "clipboard");
      mkdirSync(target);
      chmodSync(target, 0o755);
      symlinkSync(target, path);

      expect(ensureTempDir(path)).toBe(false);
      expect(mode(target)).toBe(0o755);
    });
  });

  it("creates an owner-only, exclusive spec file", () => {
    withTempDir((root) => {
      const directory = join(root, "clipboard");
      const path = join(directory, "copy.json");
      expect(ensureTempDir(directory)).toBe(true);

      writeClipboardSpec(path, '{"files":[]}');

      expect(mode(path)).toBe(0o600);
      expect(readFileSync(path, "utf8")).toBe('{"files":[]}');
      expect(() => writeClipboardSpec(path, "different")).toThrow();
      expect(readFileSync(path, "utf8")).toBe('{"files":[]}');
    });
  });
});
