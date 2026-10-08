import { toast } from "sonner";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useUiModeStore } from "@/shell/mode";
import { revealChatSession } from "@/features/ai/revealChatSession";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import { useNamedAgentsUiStore } from "@/features/ai/named-agents/ui";
import { useTasksUiStore } from "@/features/ai/tasks/ui";
import { createSessionForChoice } from "@/features/ai/worktree/create";
import { useWorktreeChoiceStore } from "@/features/ai/worktree/remember";
import { useRegisterPaletteCommands } from "./useRegisterPaletteCommands";

const ASK_ID = "ask";
const CHECKOUT_ID = "checkout";
const WORKTREE_ID = "worktree";

function workspaceRoot(): string {
  return useFileExplorerStore.getState().rootPath ?? "default";
}

function showSessions(): void {
  useUiModeStore.getState().setUiMode("agents");
  useNamedAgentsUiStore.getState().setView("sessions");
}

async function startSession(rootPath: string, choice: string): Promise<void> {
  let session: ChatSession | null;
  if (choice === ASK_ID) {
    session = await useAIStore
      .getState()
      .createChatSession(rootPath, { kind: "ask", environment: "checkout" });
  } else {
    const environment = choice === WORKTREE_ID ? "worktree" : "checkout";
    useWorktreeChoiceStore.getState().setChoice(rootPath, environment);
    session = await createSessionForChoice(rootPath, environment);
  }
  if (session) revealChatSession(rootPath, session.id);
}

function pickNewSession(): void {
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) {
    toast.error("Open a folder to start a session.");
    return;
  }
  const isRepo = useGitStore.getState().snapshot !== null;
  useCommandPaletteStore.getState().openPicker({
    placeholder: "Start a new session...",
    emptyText: "No session types found.",
    items: [
      { id: ASK_ID, label: "Ask", detail: "Talk about the code without changing files" },
      {
        id: CHECKOUT_ID,
        label: "Agent in this checkout",
        detail: "Plans, edits files and runs commands in your folder",
      },
      ...(isRepo
        ? [
            {
              id: WORKTREE_ID,
              label: "Agent in a new worktree",
              detail: "Isolated branch, safe to discard",
            },
          ]
        : []),
    ],
    onSelect: (item) => {
      void startSession(rootPath, item.id).catch(() => {
        toast.error("Could not start the session.");
      });
    },
  });
}

function pickSession(): void {
  const sessions = useAIStore
    .getState()
    .chatSessions.filter((session) => !session.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  useCommandPaletteStore.getState().openPicker({
    placeholder: "Go to session...",
    emptyText: "No sessions found.",
    items: sessions.map((session) => ({
      id: session.id,
      label: session.title,
      detail: session.category,
    })),
    onSelect: (item) => {
      showSessions();
      useTasksUiStore.getState().closeBoard();
      revealChatSession(workspaceRoot(), item.id);
    },
  });
}

async function pickNamedAgent(): Promise<void> {
  const store = useNamedAgentsStore.getState();
  if (!store.loaded) await store.loadAgents();
  const { agents } = useNamedAgentsStore.getState();
  useCommandPaletteStore.getState().openPicker({
    placeholder: "Open agent...",
    emptyText: "No agents found.",
    items: agents.map((agent) => ({ id: agent.id, label: agent.name, detail: agent.brief })),
    onSelect: (item) => {
      useUiModeStore.getState().setUiMode("agents");
      const ui = useNamedAgentsUiStore.getState();
      ui.setView("agents");
      ui.selectAgent(item.id);
    },
  });
}

function openTasks(): void {
  showSessions();
  useTasksUiStore.getState().openBoard();
}

const AGENT_COMMANDS: CommandPaletteItem[] = [
  {
    id: "agents.newSession",
    label: "Agents: New Session...",
    category: "Agents",
    keywords: ["new", "session", "chat", "agent", "ask"],
    action: pickNewSession,
  },
  {
    id: "agents.goToSession",
    label: "Agents: Go to Session...",
    category: "Agents",
    keywords: ["session", "chat", "thread", "go to", "open"],
    action: pickSession,
  },
  {
    id: "agents.openAgent",
    label: "Agents: Open Agent...",
    category: "Agents",
    keywords: ["agent", "named", "roster", "open"],
    action: () => void pickNamedAgent(),
  },
  {
    id: "agents.openTasks",
    label: "Agents: Open Tasks",
    category: "Agents",
    keywords: ["tasks", "board", "kanban", "todo"],
    action: openTasks,
  },
];

export function useAgentPaletteCommands(): void {
  useRegisterPaletteCommands(AGENT_COMMANDS);
}
