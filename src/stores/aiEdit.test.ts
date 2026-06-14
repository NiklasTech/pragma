import { describe, expect, it } from "vite-plus/test";

import { useAIEditStore } from "./aiEdit";

describe("useAIEditStore", () => {
  it("starts an edit with composing status and a prefill prompt", () => {
    const store = useAIEditStore.getState();
    store.startEdit({
      originalCode: "const x = 1;",
      filePath: "/project/src/app.ts",
      fileTabId: "tab-1",
      language: "typescript",
    });

    const state = useAIEditStore.getState();
    expect(state.edit).not.toBeNull();
    expect(state.edit?.status).toBe("composing");
    expect(state.prefillPrompt).toContain("app.ts");
    expect(state.prefillPrompt).toContain("const x = 1;");
  });

  it("consumes the prefill prompt", () => {
    const store = useAIEditStore.getState();
    store.startEdit({
      originalCode: "const x = 1;",
      filePath: "/project/src/app.ts",
      fileTabId: "tab-1",
    });
    store.consumePrefill();

    expect(useAIEditStore.getState().prefillPrompt).toBeNull();
  });

  it("transitions to awaiting on submit", () => {
    const store = useAIEditStore.getState();
    store.startEdit({
      originalCode: "const x = 1;",
      filePath: "/project/src/app.ts",
      fileTabId: "tab-1",
    });
    store.submitPrompt();

    const state = useAIEditStore.getState();
    expect(state.edit?.status).toBe("awaiting");
    expect(state.prefillPrompt).toBeNull();
  });

  it("receives a proposal", () => {
    const store = useAIEditStore.getState();
    store.startEdit({
      originalCode: "const x = 1;",
      filePath: "/project/src/app.ts",
      fileTabId: "tab-1",
    });
    store.submitPrompt();
    store.receiveProposal("const x = 2;");

    const state = useAIEditStore.getState();
    expect(state.edit?.status).toBe("proposed");
    expect(state.proposedCode).toBe("const x = 2;");
  });

  it("clears state on accept", () => {
    const store = useAIEditStore.getState();
    store.startEdit({
      originalCode: "const x = 1;",
      filePath: "/project/src/app.ts",
      fileTabId: "tab-1",
    });
    store.submitPrompt();
    store.receiveProposal("const x = 2;");
    store.acceptEdit();

    const state = useAIEditStore.getState();
    expect(state.edit).toBeNull();
    expect(state.proposedCode).toBeNull();
    expect(state.prefillPrompt).toBeNull();
  });

  it("clears state on reject", () => {
    const store = useAIEditStore.getState();
    store.startEdit({
      originalCode: "const x = 1;",
      filePath: "/project/src/app.ts",
      fileTabId: "tab-1",
    });
    store.rejectEdit();

    const state = useAIEditStore.getState();
    expect(state.edit).toBeNull();
    expect(state.proposedCode).toBeNull();
    expect(state.prefillPrompt).toBeNull();
  });
});
