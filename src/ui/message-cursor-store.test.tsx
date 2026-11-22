import { expect, it } from "bun:test";
import { closeDb } from "../store/db.ts";
import { tempStores } from "../test-store.ts";
import { createAppStore } from "./state.tsx";
import { visualSelection } from "./yank.ts";

const { freshStore } = tempStores("wa-cursor");

it("retains both VISUAL endpoints beyond the first 100 rows on arrival", () => {
  const { db, store: queries } = freshStore("cursor.db");
  const jid = "synthetic@g.us";
  queries.upsertChat({ jid, is_group: 1 });
  const message = (i: number) => ({
    id: `m${i}`, chat_jid: jid, sender_jid: "sender", from_me: 1,
    timestamp: i, type: "conversation", text: `text ${i}`, status: 0,
  });
  for (let i = 1; i <= 130; i++) queries.insertMessage(message(i));
  const [store, , helpers] = createAppStore(queries);
  helpers.hydrate();
  helpers.selectChat(jid);
  helpers.loadMoreMessages(jid);
  helpers.setSelectedMessageIndex(120);
  helpers.startVisual();
  helpers.setSelectedMessageIndex(125);
  const selected = () => visualSelection(store.messages[jid]!, store.visualAnchorId, store.selectedMessageIndex).map(m => m.id);
  const originalSelection = selected();
  queries.insertMessage(message(131));
  helpers.createBridge().onNewMessage(message(131), jid);
  expect(selected()).toEqual(originalSelection);
  expect(store.selectedMessageIndex).toBe(126);
  closeDb(db);
});
