import { expect, it } from "bun:test";
import { testRender } from "@opentui/solid";
import { closeDb } from "../store/db.ts";
import { tempStores } from "../test-store.ts";
import { App } from "./app.tsx";
import { AppStoreProvider, createAppStore } from "./state.tsx";
import { ThemeProvider } from "./theme.tsx";

const { freshStore } = tempStores("wa-visible-navigation");

it("keeps j/k, paging and gg/G on displayed rows in NORMAL and VISUAL", async () => {
  const { db, store: queries } = freshStore("keyboard.db");
  const jid = "keyboard-synthetic@g.us";
  queries.upsertChat({ jid, name: "Synthetic", is_group: 1 });
  for (let i = 1; i <= 28; i++) queries.insertMessage({
    id: `keyboard-${i}`, chat_jid: jid, from_me: 1, timestamp: i,
    status: 0, type: i % 2 ? "conversation" : "reactionMessage", text: `Synthetic ${i}`,
  });
  const [store, setStore, helpers] = createAppStore(queries);
  helpers.hydrate();
  helpers.selectChat(jid);
  helpers.setConnection({ status: "connected" });
  helpers.setFocusZone("messages");
  const ui = await testRender(() => (
    <AppStoreProvider store={store} setStore={setStore} helpers={helpers}>
      <ThemeProvider>
        <App queries={queries} getSock={() => null} getRenderer={() => null} onQuit={() => {}} />
      </ThemeProvider>
    </AppStoreProvider>
  ), { width: 120, height: 30 });
  async function key(name: string, modifiers?: { ctrl: boolean }) {
    ui.mockInput.pressKey(name, modifiers);
    await ui.renderOnce();
  }
  try {
    await ui.renderOnce();
    expect(store.selectedMessageIndex).toBe(1);
    await key("k");
    expect(store.selectedMessageIndex).toBe(3);
    await key("j");
    expect(store.selectedMessageIndex).toBe(1);
    await key("v");
    expect(store.mode).toBe("visual");
    await key("k");
    expect(store.selectedMessageIndex).toBe(3);
    await key("G");
    expect(store.selectedMessageIndex).toBe(1);
    await key("u", { ctrl: true });
    expect(store.selectedMessageIndex).toBe(21);
    await key("g"); await key("g");
    expect(store.selectedMessageIndex).toBe(27);
    await key("d", { ctrl: true });
    expect(store.selectedMessageIndex).toBe(7);
  } finally {
    ui.renderer.destroy();
    closeDb(db);
  }
});
