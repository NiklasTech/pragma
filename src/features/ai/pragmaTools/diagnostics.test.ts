import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type Listener = (event: { payload: unknown }) => void;

const mocks = vi.hoisted(() => ({
  listeners: [] as Listener[],
  tabs: [] as Array<{ kind: string; path: string }>,
  problems: [] as unknown[],
  onOpen: (() => {}) as () => void,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async (_event: string, listener: Listener) => {
    mocks.listeners.push(listener);
    return () => {
      mocks.listeners = mocks.listeners.filter((item) => item !== listener);
    };
  },
}));
vi.mock("@/features/agent/lspTools", () => ({
  withLspDocument: async (_path: string, run: (language: string, content: string) => unknown) => {
    mocks.onOpen();
    return run("typescript", "");
  },
}));
vi.mock("@/shared/stores/editor", () => ({
  useEditorStore: { getState: () => ({ tabs: mocks.tabs }) },
}));
vi.mock("@/shared/stores/problems", () => ({
  useProblemsStore: { getState: () => ({ problems: mocks.problems }) },
}));

const { collectDiagnostics, diagnosticsReport, toProblems } = await import("./diagnostics");

function publish(filePath: string, message: string, severity = 1) {
  const diagnostics = [{ range: { start: { line: 2, character: 4 } }, severity, message }];
  for (const listener of mocks.listeners)
    listener({ payload: { file_path: filePath, diagnostics } });
}

describe("toProblems", () => {
  it("uses 1-based positions and reads unnecessary code as info", () => {
    const [problem, faded] = toProblems("/p/a.ts", [
      { range: { start: { line: 0, character: 0 } }, severity: 2, message: "w", source: "ts" },
      { range: { start: { line: 1, character: 2 } }, message: "unused", tags: [1] },
    ]);
    expect(problem).toMatchObject({ line: 1, column: 1, severity: "warning", source: "ts" });
    expect(faded).toMatchObject({ line: 2, column: 3, severity: "info", source: "LSP" });
  });
});

describe("collectDiagnostics", () => {
  beforeEach(() => {
    mocks.listeners = [];
    mocks.onOpen = () => {};
  });

  it("keeps the last report of the file and stops listening", async () => {
    mocks.onOpen = () => {
      publish("/p/other.ts", "not this file");
      publish("/p/a.ts", "first");
      setTimeout(() => publish("/p/a.ts", "second"), 10);
    };
    const diagnostics = await collectDiagnostics("/p/a.ts");
    expect(diagnostics?.map((item) => item.message)).toEqual(["second"]);
    expect(mocks.listeners).toHaveLength(0);
  });
});

describe("diagnosticsReport", () => {
  beforeEach(() => {
    mocks.listeners = [];
    mocks.tabs = [{ kind: "file", path: "/p/open.ts" }];
    mocks.problems = [
      {
        id: "1",
        severity: "error",
        message: "boom",
        filePath: "/p/open.ts",
        line: 3,
        column: 5,
        source: "ts",
      },
      {
        id: "2",
        severity: "warning",
        message: "meh",
        filePath: "/p/b.ts",
        line: 1,
        column: 1,
        source: "ts",
      },
    ];
  });

  it("reads files open in the editor from the Problems panel", async () => {
    const text = await diagnosticsReport("/p/open.ts");
    expect(text).toBe("1 errors, 0 warnings\n/p/open.ts:3:5: error: boom [ts]");
  });

  it("lists every open file's problems without a path", async () => {
    const text = await diagnosticsReport(null);
    expect(text).toContain("1 errors, 1 warnings");
    expect(text).toContain("Only files open in Pragma's editor are checked");
  });

  it("asks the language server for a file the editor has not opened", async () => {
    mocks.onOpen = () => publish("/p/closed.ts", "Type 'string' is not assignable", 1);
    const text = await diagnosticsReport("/p/closed.ts");
    expect(text).toBe(
      "1 errors, 0 warnings\n/p/closed.ts:3:5: error: Type 'string' is not assignable [LSP]",
    );
  });
});
