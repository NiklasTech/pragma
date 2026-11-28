import { describe, expect, it, vi } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  state: {
    cliStatusesLoaded: true,
    cliStatuses: {} as Record<string, unknown>,
    cliManifests: [
      {
        id: "anthropic-claude",
        name: "Claude Code",
        uses_acp: true,
      },
    ],
    activeCLIProvider: null,
    apiKeyRefs: { anthropic: null, openai: null },
    copilotAuth: { authenticated: false },
    providers: { custom: { baseUrl: "" } },
  },
}));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: Object.assign(
    (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
    { getState: () => mocks.state },
  ),
}));
vi.mock("@/features/settings/openSettings", () => ({ openSettings: vi.fn() }));

const { ProviderSetupHint } = await import("./ProviderSetupHint");

function render(canChat = false): string {
  return renderToStaticMarkup(<ProviderSetupHint canChat={canChat} agentName="Pragma" />);
}

describe("ProviderSetupHint", () => {
  it("asks to set something up, with a way to put it off, when nothing is", () => {
    const html = render();
    expect(html).toContain("Sign in to a coding CLI or add an API key");
    expect(html).toContain("Not now");
    expect(html).toContain("Set up");
  });

  it("offers a signed-in CLI when only this chat's engine is missing", () => {
    mocks.state.cliStatuses = {
      "anthropic-claude": { installed: true, authenticated: true },
    };
    const html = render();
    expect(html).toContain("Pragma is not set up for this chat.");
    expect(html).toContain("Use Claude Code");
    expect(html).not.toContain("Sign in to a coding CLI");
  });

  it("shows nothing when the chat can answer", () => {
    expect(render(true)).toBe("");
  });
});
