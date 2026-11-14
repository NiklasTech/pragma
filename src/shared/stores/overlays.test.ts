import { beforeEach, describe, expect, it } from "vite-plus/test";

import { SHORTCUT_ACTIONS } from "@/shared/lib/shortcuts";
import { useLayoutStore } from "@/shell/layout";
import { OVERLAY_IDS, OVERLAY_SHORTCUTS, useOverlayStore } from "./overlays";
import { useTerminalStore } from "./terminal";

describe("overlay store", () => {
  beforeEach(() => {
    useOverlayStore.setState({ active: null, target: null });
  });

  it("keeps at most one overlay open; opening another replaces it", () => {
    const overlays = useOverlayStore.getState();
    overlays.open("overview");
    overlays.open("peek", "session-1");
    expect(useOverlayStore.getState()).toMatchObject({ active: "peek", target: "session-1" });
  });

  it("closes only the named overlay when it is the open one", () => {
    const overlays = useOverlayStore.getState();
    overlays.open("goTo");
    overlays.close("spaces");
    expect(useOverlayStore.getState().active).toBe("goTo");
    overlays.close("goTo");
    expect(useOverlayStore.getState()).toMatchObject({ active: null, target: null });
  });

  it("toggles an overlay and switches from another one", () => {
    const overlays = useOverlayStore.getState();
    overlays.toggle("goTo");
    expect(useOverlayStore.getState().active).toBe("goTo");
    overlays.toggle("settings");
    expect(useOverlayStore.getState().active).toBe("settings");
    overlays.toggle("settings");
    expect(useOverlayStore.getState().active).toBeNull();
  });

  it("leaves running terminals and the pane layout untouched", () => {
    useTerminalStore.getState().addSession({
      id: "shell-1",
      name: "Shell",
      type: "shell",
      isActive: true,
    });
    const sessions = useTerminalStore.getState().sessions;
    const layout = useLayoutStore.getState().root;

    for (const id of OVERLAY_IDS) {
      useOverlayStore.getState().open(id);
      useOverlayStore.getState().close();
    }

    expect(useTerminalStore.getState().sessions).toBe(sessions);
    expect(useLayoutStore.getState().root).toBe(layout);
  });

  it("binds overlays only to shortcuts that the Keys page lists and can rebind", () => {
    const actionIds = new Set<string>(SHORTCUT_ACTIONS.map((action) => action.id));
    for (const actionId of Object.values(OVERLAY_SHORTCUTS)) {
      expect(actionIds.has(actionId)).toBe(true);
    }
  });
});
