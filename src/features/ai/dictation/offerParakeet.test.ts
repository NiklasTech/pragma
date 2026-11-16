import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toast: vi.fn(),
  openSettings: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/features/settings/openSettings", () => ({ openSettings: mocks.openSettings }));

import { useSettingsStore } from "@/shared/stores/settings";

import { offerParakeet } from "./offerParakeet";

function setVoice(voiceEngine: "web-speech" | "parakeet", parakeetOffered: boolean) {
  useSettingsStore.getState().setAISettings({ voiceEngine, parakeetOffered });
}

describe("offerParakeet", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.toast.mockReset();
    mocks.invoke.mockResolvedValue({ supported: true, installed: false });
  });

  it("asks someone on Web Speech once", async () => {
    setVoice("web-speech", false);
    await offerParakeet();
    await offerParakeet();
    expect(mocks.toast).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().ai.parakeetOffered).toBe(true);
  });

  it("switches to Parakeet and opens the voice settings when accepted", async () => {
    setVoice("web-speech", false);
    await offerParakeet();
    const options = mocks.toast.mock.calls[0][1] as { action: { onClick: () => void } };
    options.action.onClick();
    expect(useSettingsStore.getState().ai.voiceEngine).toBe("parakeet");
    expect(mocks.openSettings).toHaveBeenCalledWith("agents", "Voice input");
  });

  it("stays quiet on Parakeet and where Parakeet has no build", async () => {
    setVoice("parakeet", false);
    await offerParakeet();
    setVoice("web-speech", false);
    mocks.invoke.mockResolvedValue({ supported: false, installed: false });
    await offerParakeet();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().ai.parakeetOffered).toBe(false);
  });
});
