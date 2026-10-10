import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { startLspDidCloseWatcher } from "@/features/editor/lsp/didClose";
import { Layout } from "@/shell/layout";
import { WindowResizeHandles } from "@/shell/chrome/WindowResizeHandles";
import { Toaster } from "@/shared/components/ui/sonner";
import { useAIInit } from "@/shared/hooks/useAIInit";
import { ThemeProvider } from "@/theme";
import { useGlobalShortcuts } from "@/shared/hooks/useGlobalShortcuts";
import { useGuardedShortcutActions, useNativeAppMenu } from "@/shared/hooks/useNativeAppMenu";
import { useMemoryStats } from "@/shared/hooks/useMemoryStats";
import { useOnboarding } from "@/shared/hooks/useOnboarding";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useExternalWindowManager } from "@/shared/stores/sync/useExternalWindowManager";
import { useDisableBrowserBehaviors } from "@/shared/hooks/useDisableBrowserBehaviors";
import { useWorkspaceRestore } from "@/shared/hooks/useWorkspaceRestore";
import { useWorkspaceWatcher } from "@/shared/hooks/useWorkspaceWatcher";
import { useWorkspaceSettingsSync } from "@/shared/hooks/useWorkspaceSettingsSync";
import { useFolderTrust } from "@/shared/hooks/useFolderTrust";
import { useDiagnosticsCleanup } from "@/shared/hooks/useDiagnosticsCleanup";
import { useTerminalShellResolver } from "@/shared/hooks/useTerminalShellResolver";
import { useExtensions } from "@/features/extensions/useExtensions";
import { useAcpBrowserRequests } from "@/features/ai/browser/acpBrowser";
import { useAcpSpawnRequests } from "@/features/ai/children/acpSpawn";
import { useSessionNotifications } from "@/features/ai/notifications/useSessionNotifications";
import { useActivityTracker } from "@/features/ai/activity/useActivityTracker";
import { useSubscriptionUsagePoller } from "@/features/ai/subscription/useSubscriptionUsagePoller";
import { useTaskAutomation } from "@/features/ai/tasks/useTaskAutomation";
import { GlobalContextMenu } from "./GlobalContextMenu";
import { useAppShortcutActions } from "./useAppShortcutActions";
import { useCommandPaletteCommands } from "./useCommandPaletteCommands";
import { useLspSymbolCommands } from "./useLspSymbolCommands";
import { useGitPaletteCommands } from "./useGitPaletteCommands";
import { useAgentPaletteCommands } from "./useAgentPaletteCommands";
import { useThemePaletteCommand } from "./useThemePaletteCommand";
import { useRunPaletteCommands } from "./useRunPaletteCommands";
import { useRecentFolderPaletteCommand } from "./useRecentFolderPaletteCommand";
import { CommandPalette } from "./CommandPalette";
import { GoToFile } from "./GoToFile";
import { RenameDialog } from "@/features/editor/components/RenameDialog";
import { CodeActionsDialog } from "@/features/editor/components/CodeActionsDialog";
import { SymbolDialog } from "@/features/editor/components/SymbolDialog";
import { BreakpointEditDialog } from "@/features/debug/components/BreakpointEditDialog";
import { AttachProcessDialog } from "@/features/debug/components/AttachProcessDialog";
import { GitCompareDialog } from "@/features/sidebar/components/GitCompareDialog";
import { FileHistoryDialog } from "@/features/sidebar/components/FileHistoryDialog";
import { UpdateDialog } from "./UpdateDialog";

export default function App() {
  useAIInit();
  useMemoryStats();
  useExternalWindowManager();
  useDisableBrowserBehaviors();
  useWorkspaceRestore();
  useWorkspaceWatcher();
  useWorkspaceSettingsSync();
  useFolderTrust();
  useDiagnosticsCleanup();
  useTerminalShellResolver();
  useExtensions();
  useAcpSpawnRequests();
  useAcpBrowserRequests();
  useSessionNotifications();
  useActivityTracker();
  useSubscriptionUsagePoller();
  useTaskAutomation();
  const { isLoading: onboardingLoading, isCompleted: onboardingCompleted } = useOnboarding();

  const actions = useGuardedShortcutActions(useAppShortcutActions());

  useGlobalShortcuts(actions);
  useNativeAppMenu(actions);
  useCommandPaletteCommands();
  useLspSymbolCommands();
  useGitPaletteCommands();
  useAgentPaletteCommands();
  useThemePaletteCommand();
  useRunPaletteCommands();
  useRecentFolderPaletteCommand();
  useEffect(() => startLspDidCloseWatcher(), []);
  useEffect(() => {
    const unlisten = listen<{ path: string }>("pragma:cli:invalid-path", (event) => {
      toast.error(`Cannot open folder: ${event.payload.path}`);
    });
    return () => {
      unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, []);

  return (
    <ThemeProvider>
      <GlobalContextMenu>
        <WindowResizeHandles />
        <Layout />
        {!onboardingLoading && !onboardingCompleted && <Onboarding />}
        <CommandPalette />
        <GoToFile />
        <RenameDialog />
        <CodeActionsDialog />
        <SymbolDialog />
        <BreakpointEditDialog />
        <AttachProcessDialog />
        <GitCompareDialog />
        <FileHistoryDialog />
        <UpdateDialog />
        <Toaster position="bottom-right" />
      </GlobalContextMenu>
    </ThemeProvider>
  );
}
