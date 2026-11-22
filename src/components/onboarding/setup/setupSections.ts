export const SETUP_SECTIONS = ["look", "agents", "project", "languages"] as const;

export type SetupSection = (typeof SETUP_SECTIONS)[number];

export const SECTION_LABELS: Record<SetupSection, string> = {
  look: "Look",
  agents: "Agents",
  project: "Project",
  languages: "Languages",
};

/** The line the command line shows while a section is in focus. */
export const SECTION_HINTS: Record<SetupSection, string> = {
  look: "pick a mode and a theme; you see it right away",
  agents: "sign in once; Pragma starts the CLI with your own subscription",
  project: "optional: open a folder to work in",
  languages: "copy an install command, then check again",
};

/** What the language servers of the open folder look like right now. */
export type LanguagesState =
  | { kind: "off" }
  | { kind: "no-folder" }
  | { kind: "checking" }
  | { kind: "done"; missing: number; found: number };

export interface SetupInput {
  themeLabel: string;
  signedInAgents: number;
  /** An API key provider is set up, so Pragma's own agent can run. */
  apiKeyReady: boolean;
  folderName: string | null;
  languages: LanguagesState;
}

export interface SectionState {
  done: boolean;
  status: string;
}

function languagesStatus(state: LanguagesState): SectionState {
  switch (state.kind) {
    case "off":
      return { done: false, status: "off" };
    case "no-folder":
      return { done: false, status: "after a folder" };
    case "checking":
      return { done: false, status: "checking" };
    case "done":
      if (state.found === 0) return { done: true, status: "none found" };
      if (state.missing === 0) return { done: true, status: "all ready" };
      return { done: false, status: `${state.missing} missing` };
  }
}

/// The state of every setup section, as the rail and the strip show it.
export function setupSections(input: SetupInput): Record<SetupSection, SectionState> {
  return {
    look: { done: true, status: input.themeLabel },
    agents: {
      done: input.signedInAgents > 0 || input.apiKeyReady,
      status:
        input.signedInAgents > 0
          ? `${input.signedInAgents} signed in`
          : input.apiKeyReady
            ? "API key"
            : "none signed in",
    },
    project: input.folderName
      ? { done: true, status: input.folderName }
      : { done: false, status: "optional" },
    languages: languagesStatus(input.languages),
  };
}

/** Pragma can start once an agent can run: a signed-in CLI or an API key; the rest can wait. */
export function canStart(sections: Record<SetupSection, SectionState>): boolean {
  return sections.agents.done;
}
