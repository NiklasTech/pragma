import { describe, expect, it } from "vite-plus/test";

import { canStart, setupSections, type SetupInput } from "./setupSections";

const base: SetupInput = {
  themeLabel: "Pragma Dark",
  signedInAgents: 0,
  apiKeyReady: false,
  folderName: null,
  languages: { kind: "no-folder" },
};

describe("setupSections", () => {
  it("needs a signed-in agent before Pragma can start", () => {
    expect(canStart(setupSections(base))).toBe(false);
    const sections = setupSections({ ...base, signedInAgents: 2 });
    expect(sections.agents).toEqual({ done: true, status: "2 signed in" });
    expect(canStart(sections)).toBe(true);
  });

  it("also starts with an API key instead of a CLI", () => {
    const sections = setupSections({ ...base, apiKeyReady: true });
    expect(sections.agents).toEqual({ done: true, status: "API key" });
    expect(canStart(sections)).toBe(true);
  });

  it("treats the project as optional", () => {
    expect(setupSections(base).project).toEqual({ done: false, status: "optional" });
    expect(setupSections({ ...base, folderName: "pragma" }).project).toEqual({
      done: true,
      status: "pragma",
    });
  });

  it("reports the language servers of the open folder", () => {
    const languages = (state: SetupInput["languages"]) =>
      setupSections({ ...base, folderName: "pragma", languages: state }).languages;
    expect(languages({ kind: "off" })).toEqual({ done: false, status: "off" });
    expect(languages({ kind: "checking" })).toEqual({ done: false, status: "checking" });
    expect(languages({ kind: "done", found: 2, missing: 1 })).toEqual({
      done: false,
      status: "1 missing",
    });
    expect(languages({ kind: "done", found: 2, missing: 0 }).done).toBe(true);
    expect(languages({ kind: "done", found: 0, missing: 0 }).status).toBe("none found");
  });
});
