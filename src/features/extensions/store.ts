import { create, type StateCreator } from "zustand";
import type { ExtensionSummary } from "./types";

export type ExtensionStatus = "running" | "error" | "disabled";

export interface ExtensionRuntimeState {
  status: ExtensionStatus;
  error?: string;
}

export interface RegisteredPanel {
  extensionId: string;
  id: string;
  title: string;
  icon?: string;
  html?: string;
}

export interface RegisteredStatusBarItem {
  extensionId: string;
  id: string;
  text: string;
  tooltip?: string;
  /** Command id of the extension, run on click. */
  command?: string;
  alignment: "left" | "right";
}

export interface RegisteredKeybinding {
  extensionId: string;
  /** Command id of the extension. */
  command: string;
  key: string;
  mac?: string;
}

export interface RegisteredLanguageProvider {
  extensionId: string;
  id: string;
  /** Pragma language id, or "*" for every language. */
  language: string;
  triggerCharacters: string[];
}

export interface RegisteredAgentTool {
  extensionId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Read-only tools run without approval; all others follow the approval settings. */
  readOnly: boolean;
}

interface ExtensionContributions {
  statusBarItems: RegisteredStatusBarItem[];
  keybindings: RegisteredKeybinding[];
  diagnosticsProviders: RegisteredLanguageProvider[];
  completionProviders: RegisteredLanguageProvider[];
  agentTools: RegisteredAgentTool[];
}

export type ContributionKind = keyof ExtensionContributions;

interface ExtensionsState extends ExtensionContributions {
  workspaceRoot: string | null;
  summaries: ExtensionSummary[];
  statuses: Record<string, ExtensionRuntimeState>;
  panels: RegisteredPanel[];
}

interface ExtensionsActions {
  setWorkspaceRoot: (root: string | null) => void;
  setSummaries: (summaries: ExtensionSummary[]) => void;
  setStatus: (id: string, status: ExtensionRuntimeState) => void;
  setPanelsFor: (extensionId: string, panels: RegisteredPanel[]) => void;
  /** Replaces one kind of contribution of an extension. */
  setContributionsFor: <K extends ContributionKind>(
    kind: K,
    extensionId: string,
    items: ExtensionContributions[K],
  ) => void;
  clearContributionsFor: (extensionId: string) => void;
  reset: () => void;
}

const emptyContributions: ExtensionContributions = {
  statusBarItems: [],
  keybindings: [],
  diagnosticsProviders: [],
  completionProviders: [],
  agentTools: [],
};

const initialState: ExtensionsState = {
  workspaceRoot: null,
  summaries: [],
  statuses: {},
  panels: [],
  ...emptyContributions,
};

const extensionsStoreCreator: StateCreator<ExtensionsState & ExtensionsActions> = (set) => ({
  ...initialState,

  setWorkspaceRoot: (workspaceRoot) => set({ workspaceRoot }),

  setSummaries: (summaries) => set({ summaries }),

  setStatus: (id, status) => set((state) => ({ statuses: { ...state.statuses, [id]: status } })),

  setPanelsFor: (extensionId, panels) =>
    set((state) => ({
      panels: [
        ...state.panels.filter((p) => p.extensionId !== extensionId),
        ...panels.map((p) => ({ ...p, extensionId })),
      ],
    })),

  setContributionsFor: (kind, extensionId, items) =>
    set((state) => ({
      [kind]: [
        ...state[kind].filter((item) => item.extensionId !== extensionId),
        ...items.map((item) => ({ ...item, extensionId })),
      ],
    })),

  clearContributionsFor: (extensionId) =>
    set((state) => ({
      statusBarItems: state.statusBarItems.filter((item) => item.extensionId !== extensionId),
      keybindings: state.keybindings.filter((item) => item.extensionId !== extensionId),
      diagnosticsProviders: state.diagnosticsProviders.filter(
        (item) => item.extensionId !== extensionId,
      ),
      completionProviders: state.completionProviders.filter(
        (item) => item.extensionId !== extensionId,
      ),
      agentTools: state.agentTools.filter((item) => item.extensionId !== extensionId),
    })),

  reset: () => set({ ...initialState, workspaceRoot: null }),
});

export const useExtensionsStore = create<ExtensionsState & ExtensionsActions>()(
  extensionsStoreCreator,
);

/// Language providers of an extension kind that apply to `language`.
export function providersFor(
  providers: RegisteredLanguageProvider[],
  language: string | null | undefined,
): RegisteredLanguageProvider[] {
  return providers.filter(
    (provider) => provider.language === "*" || (!!language && provider.language === language),
  );
}
