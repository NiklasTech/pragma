import { useEffect } from "react";
import { startLspDidCloseWatcher } from "@/features/editor/lsp/didClose";
import { Layout } from "@/shell/layout";
import { WindowResizeHandles } from "@/shell/chrome/WindowResizeHandles";
import { Toaster } from "@/shared/components/ui/sonner";
import { useAIInit } from "@/shared/hooks/useAIInit";
import { ThemeProvider } from "@/theme";
import { useGlobalShortcuts } from "@/shared/hooks/useGlobalShortcuts";
import { useMemoryStats } from "@/shared/hooks/useMemoryStats";
import { useOnboarding } from "@/shared/hooks/useOnboarding";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { useExternalWindowManager } from "@/shared/stores/sync/useExternalWindowManager";
import { useDisableBrowserBehaviors } from "@/shared/hooks/useDisableBrowserBehaviors";
import { useWorkspaceRestore } from "@/shared/hooks/useWorkspaceRestore";
import { useDiagnosticsCleanup } from "@/shared/hooks/useDiagnosticsCleanup";
import { useTerminalShellResolver } from "@/shared/hooks/useTerminalShellResolver";
import { GlobalContextMenu } from "./GlobalContextMenu";
import { useAppShortcutActions } from "./useAppShortcutActions";
import { useCommandPaletteCommands } from "./useCommandPaletteCommands";
import { useLspSymbolCommands } from "./useLspSymbolCommands";
import { CommandPalette } from "./CommandPalette";
import { GoToFile } from "./GoToFile";
import { RenameDialog } from "@/features/editor/components/RenameDialog";
import { CodeActionsDialog } from "@/features/editor/components/CodeActionsDialog";
import { SymbolDialog } from "@/features/editor/components/SymbolDialog";

export default function App() {
  useAIInit();
  useMemoryStats();
  useExternalWindowManager();
  useDisableBrowserBehaviors();
  useWorkspaceRestore();
  useDiagnosticsCleanup();
  useTerminalShellResolver();
  const { isLoading: onboardingLoading, isCompleted: onboardingCompleted } = useOnboarding();

  const actions = useAppShortcutActions();

  useGlobalShortcuts(actions);
  useCommandPaletteCommands();
  useLspSymbolCommands();
  useEffect(() => startLspDidCloseWatcher(), []);

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
        <Toaster position="bottom-right" />
      </GlobalContextMenu>
    </ThemeProvider>
  );
}
