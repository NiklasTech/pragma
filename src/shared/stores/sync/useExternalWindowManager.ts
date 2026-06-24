import { useEffect } from "react";
import { emit, listen } from "@tauri-apps/api/event";
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

async function sendSnapshot(_label: string) {
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

    let unlistenReady: (() => void) | null = null;
    let unlistenClose: (() => void) | null = null;

    const setup = async () => {
      unlistenReady = await listen<ExternalWindowReadyPayload>("pragma:external:ready", (event) => {
        void sendSnapshot(event.payload.label);
      });

      unlistenClose = await listen<ExternalWindowClosePayload>("pragma:external:close", (event) => {
        const { label, x, y, width, height } = event.payload;
        useLayoutStore.getState().dockExternalWindow(label, { x, y, width, height });
      });
    };

    void setup();

    return () => {
      unlistenReady?.();
      unlistenClose?.();
    };
  }, []);
}
