import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  hover: vi.fn(),
  documentSymbol: vi.fn(),
  findDefinition: vi.fn(),
  diagnosticsReport: vi.fn(),
}));

vi.mock("@/features/agent/lspTools", () => ({
  withLspDocument: async (_path: string, run: (language: string, content: string) => unknown) =>
    run("typescript", "function run() {}\n"),
  locateSymbol: () => ({ line: 0, character: 9 }),
  findDefinition: mocks.findDefinition,
  findReferences: vi.fn(),
  findWorkspaceSymbols: vi.fn(),
}));
vi.mock("@/features/editor/lsp/client", () => ({
  lspHover: mocks.hover,
  lspDocumentSymbol: mocks.documentSymbol,
}));
vi.mock("./diagnostics", () => ({ diagnosticsReport: mocks.diagnosticsReport }));
vi.mock("./rename", () => ({ RENAME_TOOL: "lsp_rename", renameSymbol: vi.fn() }));

const { CODE_TOOLS } = await import("./codeTools");

const context = { sessionId: "s1", requestId: "r1", cwd: "/work/tree", rootPath: "/work" };

describe("CODE_TOOLS", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("resolves paths against the session's working folder", async () => {
    mocks.findDefinition.mockResolvedValue("/work/tree/src/a.ts:1:10");
    await CODE_TOOLS.lsp_definition({ path: "src/a.ts", line: 4, symbol: "run" }, context);
    expect(mocks.findDefinition).toHaveBeenCalledWith("/work/tree/src/a.ts", 4, "run");
    await expect(CODE_TOOLS.lsp_definition({ line: 1, symbol: "x" }, context)).rejects.toThrow(
      "path is required",
    );
  });

  it("returns the hover text, or says there is none", async () => {
    mocks.hover.mockResolvedValue({ contents: "function run(): void\n" });
    await expect(
      CODE_TOOLS.lsp_hover({ path: "a.ts", line: 1, symbol: "run" }, context),
    ).resolves.toBe("function run(): void");
    expect(mocks.hover).toHaveBeenCalledWith("typescript", "/work/tree/a.ts", 0, 9);
    mocks.hover.mockResolvedValue(null);
    await expect(
      CODE_TOOLS.lsp_hover({ path: "a.ts", line: 1, symbol: "run" }, context),
    ).resolves.toContain("no information");
  });

  it("lists document symbols as an indented outline", async () => {
    const range = (line: number) => ({
      start: { line, character: 0 },
      end: { line, character: 1 },
    });
    mocks.documentSymbol.mockResolvedValue([
      { name: "Store", kind: 5, range: range(2), depth: 0 },
      { name: "load", kind: 6, detail: "(): void", range: range(4), depth: 1 },
    ]);
    await expect(CODE_TOOLS.lsp_document_symbols({ path: "a.ts" }, context)).resolves.toBe(
      "class Store: line 3\n  method load (): void: line 5",
    );
  });

  it("checks one file, or all open files without a path", async () => {
    mocks.diagnosticsReport.mockResolvedValue("No errors or warnings.");
    await CODE_TOOLS.lsp_diagnostics({ path: "src/a.ts" }, context);
    await CODE_TOOLS.lsp_diagnostics({}, context);
    expect(mocks.diagnosticsReport.mock.calls).toEqual([["/work/tree/src/a.ts"], [null]]);
  });
});
