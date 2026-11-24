import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";
import type { CliAccount } from "@/shared/stores/ai/cliAccounts";
import type { AgentLimitHandoff } from "@/shared/stores/settings";

const mocks = vi.hoisted(() => ({
  continueWithAccount: vi.fn(),
  missing: [] as string[],
  toast: vi.fn(),
  sessions: [] as ChatSession[],
  accounts: [] as CliAccount[],
  usage: {} as Record<string, number>,
  leaf: { id: "leaf-1" } as { id: string } | null,
  mode: "switch" as AgentLimitHandoff,
}));

vi.mock("sonner", () => ({ toast: { info: mocks.toast } }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: { getState: () => ({ chatSessions: mocks.sessions }) },
}));
vi.mock("@/shared/stores/ai/cliAccounts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCliAccountsStore: { getState: () => ({ accounts: mocks.accounts }) },
}));
vi.mock("@/shared/stores/fileExplorer", () => ({
  useFileExplorerStore: { getState: () => ({ rootPath: "/repo" }) },
}));
vi.mock("@/shared/stores/settings", () => ({
  useSettingsStore: {
    getState: () => ({
      agent: { limitHandoff: mocks.mode, limitThreshold: 90 },
      ai: { cliAccounts: { names: {} } },
    }),
  },
}));
vi.mock("../panes/operations", () => ({ findLeafBySession: () => mocks.leaf }));
vi.mock("../panes/store", () => ({
  paneTreeKey: () => "tab",
  selectRoot: () => null,
  useAgentsPanesStore: { getState: () => ({}) },
}));
vi.mock("../subscription/store", () => ({
  selectProviderUsage: (_state: unknown, providerId: string, configDir: string | null) => ({
    usage: {
      providerId,
      fetchedAtMs: 1,
      windows: [
        {
          id: "five_hour",
          label: "5h",
          usedPercent: mocks.usage[configDir ?? "default"] ?? 0,
          resetsAtMs: null,
        },
      ],
    },
  }),
  useSubscriptionUsageStore: { getState: () => ({ byProvider: {} }) },
}));
vi.mock("./actions", () => ({ continueWithAccount: mocks.continueWithAccount }));
vi.mock("./missingServers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  missingMcpServers: () => Promise.resolve(mocks.missing),
}));

import { useAgentStatesStore } from "../state/agentStates";
import { useHandoffStore } from "./store";
import { switchOnLimit } from "./switchOnLimit";
import { handleLimit } from "./useHandoffFeed";

const session: ChatSession = {
  id: "s1",
  rootPath: "/repo",
  title: "Billing export",
  messages: [],
  createdAt: 0,
  updatedAt: 0,
  kind: "terminal",
  cliProviderId: "anthropic-claude",
};

function account(configDir: string | null, email: string): CliAccount {
  return {
    providerId: "anthropic-claude",
    configDir,
    email,
    displayName: null,
    organizationName: null,
    signedIn: true,
    available: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessions = [session];
  mocks.accounts = [
    account(null, "home"),
    account("/h/.claude-work", "work"),
    account("/h/.claude-team", "team"),
  ];
  mocks.usage = { "/h/.claude-work": 60, "/h/.claude-team": 20 };
  mocks.leaf = { id: "leaf-1" };
  mocks.mode = "switch";
  mocks.missing = [];
  mocks.continueWithAccount.mockResolvedValue(undefined);
  useHandoffStore.setState({ limitHit: {}, dismissed: {}, waitingUntil: {} });
  useAgentStatesStore.setState({ entries: {} });
});

describe("switchOnLimit", () => {
  it("says which MCP servers the other account lacks", async () => {
    mocks.missing = ["github"];
    await switchOnLimit("s1");
    expect(mocks.toast).toHaveBeenCalledWith(expect.any(String), {
      description: "1 MCP server missing there: github",
    });
  });

  it("moves the session to the account with the most room, in its pane", async () => {
    expect(await switchOnLimit("s1")).toBe(true);
    expect(mocks.continueWithAccount).toHaveBeenCalledWith(
      "/repo",
      "leaf-1",
      session,
      "/h/.claude-team",
    );
  });

  it("stays put when every other account is past the threshold or the pane is elsewhere", async () => {
    mocks.usage = { "/h/.claude-work": 95, "/h/.claude-team": 91 };
    expect(await switchOnLimit("s1")).toBe(false);
    mocks.usage = {};
    mocks.leaf = null;
    expect(await switchOnLimit("s1")).toBe(false);
    expect(mocks.continueWithAccount).not.toHaveBeenCalled();
  });
});

describe("handleLimit", () => {
  it("asks when set to ask, and when switching finds no account", async () => {
    mocks.mode = "ask";
    await handleLimit("s1");
    expect(useHandoffStore.getState().limitHit.s1).toBeDefined();
    expect(useAgentStatesStore.getState().entries.s1?.state).toBe("needs-you");
    expect(mocks.continueWithAccount).not.toHaveBeenCalled();

    useHandoffStore.setState({ limitHit: {} });
    mocks.mode = "switch";
    mocks.accounts = [account(null, "home")];
    await handleLimit("s1");
    expect(useHandoffStore.getState().limitHit.s1).toBeDefined();
  });

  it("switches without asking when it can, and does nothing when turned off", async () => {
    await handleLimit("s1");
    expect(mocks.continueWithAccount).toHaveBeenCalledTimes(1);
    expect(useHandoffStore.getState().limitHit.s1).toBeUndefined();

    mocks.mode = "off";
    await handleLimit("s1");
    expect(mocks.continueWithAccount).toHaveBeenCalledTimes(1);
    expect(useHandoffStore.getState().limitHit.s1).toBeUndefined();
  });

  it("asks when the switch fails", async () => {
    mocks.continueWithAccount.mockRejectedValue(new Error("no transcript"));
    await handleLimit("s1");
    expect(useHandoffStore.getState().limitHit.s1).toBeDefined();
  });
});
