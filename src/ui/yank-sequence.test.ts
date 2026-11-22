import { describe, expect, it } from "bun:test";
import { createYankSequence } from "./yank-sequence.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

describe("yank ordering", () => {
  it("ignores a downloaded image after a newer text yank", async () => {
    const sequence = createYankSequence();
    const download = deferred();
    const image = sequence.begin();
    let clipboard = "";
    const old = download.promise.then(() => sequence.write(image, () => { clipboard = "image"; }));
    const text = sequence.begin();
    await sequence.write(text, () => { clipboard = "text"; });
    download.resolve();
    expect(await old).toBe(false);
    expect(clipboard).toBe("text");
    expect(sequence.isCurrent(image)).toBe(false);
  });
  it("skips older mixed/image writes queued before newer writes", async () => {
    const sequence = createYankSequence();
    const calls: string[] = [];
    const old = sequence.write(sequence.begin(), () => { calls.push("old"); });
    const newer = sequence.write(sequence.begin(), () => { calls.push("new"); });
    expect(await old).toBe(false);
    expect(await newer).toBe(true);
    expect(calls).toEqual(["new"]);
  });
  it("puts newer text after a native write that already started", async () => {
    const sequence = createYankSequence();
    const started = deferred();
    const finish = deferred();
    let clipboard = "";
    const native = sequence.write(sequence.begin(), async () => {
      started.resolve();
      await finish.promise;
      clipboard = "image";
    });
    await started.promise;
    const text = sequence.write(sequence.begin(), () => { clipboard = "text"; });
    finish.resolve();
    await Promise.all([native, text]);
    expect(clipboard).toBe("text");
  });
  it("allows another write after a copy failure", async () => {
    const sequence = createYankSequence();
    await expect(sequence.write(sequence.begin(), () => { throw new Error("synthetic failure"); })).rejects.toThrow("synthetic failure");
    let written = false;
    await sequence.write(sequence.begin(), () => { written = true; });
    expect(written).toBe(true);
  });
});
