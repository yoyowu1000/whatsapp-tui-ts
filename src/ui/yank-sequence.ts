/** Only the newest yank may start a write. Serialize native and text writes so
 * an already-running native copy cannot finish after a newer text copy. */
export function createYankSequence() {
  let latest = 0;
  let tail: Promise<unknown> = Promise.resolve();
  return {
    begin: () => ++latest,
    isCurrent: (ticket: number) => ticket === latest,
    write(ticket: number, write: () => void | Promise<void>): Promise<boolean> {
      const result = tail.then(async () => {
        if (ticket !== latest) return false;
        await write();
        return true;
      });
      // A failed copy must not block future copies.
      tail = result.catch(() => {});
      return result;
    },
  };
}
