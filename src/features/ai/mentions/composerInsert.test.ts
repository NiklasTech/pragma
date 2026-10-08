import { describe, expect, it } from "vite-plus/test";
import { appendToDraft, useComposerInsertStore } from "./composerInsert";

describe("appendToDraft", () => {
  it("separates the inserted text from the draft and leaves room to type", () => {
    expect(appendToDraft("", "@a.ts")).toBe("@a.ts ");
    expect(appendToDraft("look at", "@a.ts")).toBe("look at @a.ts ");
    expect(appendToDraft("look at ", "@a.ts")).toBe("look at @a.ts ");
  });
});

describe("useComposerInsertStore", () => {
  it("queues inserts until the composer consumes them", () => {
    const store = useComposerInsertStore.getState();
    store.insert("@a.ts");
    store.insert("@b.ts");
    expect(useComposerInsertStore.getState().consume()).toBe("@a.ts @b.ts");
    expect(useComposerInsertStore.getState().consume()).toBeNull();
  });
});
