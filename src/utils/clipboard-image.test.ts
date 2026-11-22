import { describe, expect, it } from "bun:test";
import { buildClipboardDoc } from "./clipboard-image.ts";

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
