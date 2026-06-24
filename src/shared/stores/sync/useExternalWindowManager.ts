import { useEffect } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLayoutStore } from "@/shell/layout";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useEditorStore } from "@/shared/stores/editor";
import { useRunConfigStore } from "@/shared/stores/runConfig";

interface ExternalWindowReadyPayload {
  label: string;
  nodeId: string;
}

interface ExternalWindowClosePayload {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function isMainWindow(): boolean {
  return getCurrentWindow().label === "main";
}

async function sendSnapshot() {
  const source = getCurrentWindow().label;

  await emit(`pragma:store:settings:snapshot`, {
    source,
    state: useSettingsStore.getState(),
  });
  await emit(`pragma:store:layout:snapshot`, {
    source,
    state: useLayoutStore.getState(),
  });
  await emit(`pragma:store:terminal:snapshot`, {
    source,
    state: useTerminalStore.getState(),
  });
  await emit(`pragma:store:editor:snapshot`, {
    source,
    state: useEditorStore.getState(),
  });
  await emit(`pragma:store:runConfig:snapshot`, {
    source,
    state: useRunConfigStore.getState(),
  });
}

export function useExternalWindowManager(): void {
  useEffect(() => {
    if (!isMainWindow()) return;

    // Clean up stale external-window entries: if the store says a panel is
    // hosted in an external window but that Tauri window no longer exists,
    // dock it back into the main layout so it can be reopened.
    const cleanupStale = async () => {
      try {
        const windows = await getAllWebviewWindows();
        const labels = new Set(windows.map((w) => w.label));
        const { floating, dockExternalWindow } = useLayoutStore.getState();
        for (const f of floating) {
          if (f.external && !labels.has(f.external)) {
            dockExternalWindow(f.external, undefined);
          }
        }
      } catch {
        // ignore cleanup errors
      }
    };

    let unlistenReady: (() => void) | null = null;
    let unlistenClose: (() => void) | null = null;

    const setup = async () => {
      await cleanupStale();

      unlistenReady = await listen<ExternalWindowReadyPayload>("pragma:external:ready", () => {
        void sendSnapshot();
      });

      unlistenClose = await listen<ExternalWindowClosePayload>("pragma:external:close", (event) => {
        const { label, x, y, width, height } = event.payload;
        const state = useLayoutStore.getState();
        const floating = state.floating.find((f) => f.external === label);
        if (!floating) return;

        // Persist the final bounds before docking back into the main layout.
        useLayoutStore.setState({
          floating: state.floating.map((f) =>
            f.id === floating.id ? { ...f, x, y, width, height } : f,
          ),
        });
        state.dockFloatingPanel(floating.id);
      });
    };

    void setup();

    return () => {
      unlistenReady?.();
      unlistenClose?.();
    };
  }, []);
}
