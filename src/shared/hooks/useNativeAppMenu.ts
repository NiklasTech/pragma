import { useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { useUpdaterStore } from "@/features/settings/updater/updaterStore";
import { useLayoutStore } from "@/shell/layout";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { getIsMac, SHORTCUT_ACTIONS, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { wrapWithGuard, type NativeMenuPayload } from "@/shared/lib/menuAction";
import type { ShortcutActions } from "@/shared/hooks/useGlobalShortcuts";

const MENU_EVENT = "pragma:menu";
const GITHUB_URL = "https://github.com/NiklasTech/pragma";
const RECENT_LIMIT = 10;
const DEDUPE_WINDOW_MS = 80;

const SHORTCUT_ACTION_IDS = new Set<string>(SHORTCUT_ACTIONS.map((action) => action.id));

function isShortcutActionId(id: string): id is ShortcutActionId {
  return SHORTCUT_ACTION_IDS.has(id);
}

export function useGuardedShortcutActions(actions: ShortcutActions): ShortcutActions {
  const last = useRef(new Map<string, number>());
  return useMemo(() => wrapWithGuard(actions, last.current, DEDUPE_WINDOW_MS), [actions]);
}

export function useNativeAppMenu(actions: ShortcutActions): void {
  const isMac = getIsMac();
  const { selectRoot } = useFileExplorer();

  const recentFolders = useSettingsStore((state) => state.workspace.recentFolders);
  const canSave = useEditorStore((state) => {
    const tab = state.tabs.find((candidate) => candidate.id === state.activeTabId);
    return tab?.kind === "file" ? tab.isModified : false;
  });
  const sidebarCollapsed = useLayoutStore((state) => state.sidebar.collapsed);
  const terminalMode = useLayoutStore((state) => state.terminal.mode);
  const aiMode = useLayoutStore((state) => state.ai.mode);

  useEffect(() => {
    if (!isMac) return;

    const unlisten = listen<NativeMenuPayload>(MENU_EVENT, (event) => {
      const { action, path } = event.payload;

      if (action === "file.openRecent") {
        if (path) void selectRoot(path);
        return;
      }
      if (action === "app.checkForUpdates") {
        void useUpdaterStore.getState().checkForUpdates({ silent: false });
        return;
      }
      if (action === "app.openGitHub") {
        void invoke("open_external_url", { url: GITHUB_URL });
        return;
      }
      if (!isShortcutActionId(action)) return;
      actions[action]?.();
    });

    return () => {
      unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, [isMac, actions, selectRoot]);

  useEffect(() => {
    if (!isMac) return;
    void invoke("macos_menu_set_recent", { paths: recentFolders.slice(0, RECENT_LIMIT) });
  }, [isMac, recentFolders]);

  useEffect(() => {
    if (!isMac) return;
    void invoke("macos_menu_set_enabled", { id: "file.save", enabled: canSave });
  }, [isMac, canSave]);

  useEffect(() => {
    if (!isMac) return;
    void invoke("macos_menu_set_checked", { id: "view.toggleSidebar", checked: !sidebarCollapsed });
  }, [isMac, sidebarCollapsed]);

  useEffect(() => {
    if (!isMac) return;
    void invoke("macos_menu_set_checked", {
      id: "view.toggleTerminal",
      checked: terminalMode !== "hidden",
    });
  }, [isMac, terminalMode]);

  useEffect(() => {
    if (!isMac) return;
    void invoke("macos_menu_set_checked", { id: "ai.toggle", checked: aiMode !== "hidden" });
  }, [isMac, aiMode]);
}
