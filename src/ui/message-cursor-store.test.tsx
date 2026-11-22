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

it("selects only visible endpoints and won't anchor VISUAL on a hidden-only chat", () => {
  const { db, store: queries } = freshStore("hidden.db");
  const jid = "hidden-synthetic@g.us";
  queries.upsertChat({ jid, is_group: 1 });
  for (let i = 1; i <= 4; i++) queries.insertMessage({
    id: `h${i}`, chat_jid: jid, from_me: 1, timestamp: i, status: 0,
    type: i === 2 ? "conversation" : "reactionMessage", text: "synthetic",
  });
  const [store, setStore, helpers] = createAppStore(queries);
  helpers.selectChat(jid);
  expect(store.selectedMessageIndex).toBe(2);
  helpers.setSelectedMessageIndex(3);
  expect(store.selectedMessageIndex).toBe(2);
  setStore("messages", jid, [queries.getMessage("h4")!]);
  helpers.setSelectedMessageIndex(0);
  helpers.startVisual();
  expect(store.mode).toBe("normal");
  expect(store.visualAnchorId).toBeNull();
  closeDb(db);
});
