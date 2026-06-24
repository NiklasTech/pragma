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
import { useAppShortcutActions } from "./useAppShortcutActions";

export default function App() {
  useAIInit();
  useMemoryStats();
  useExternalWindowManager();
  const { isLoading: onboardingLoading, isCompleted: onboardingCompleted } = useOnboarding();

  const actions = useAppShortcutActions();

  useGlobalShortcuts(actions);

  return (
    <ThemeProvider>
      <WindowResizeHandles />
      <Layout />
      {!onboardingLoading && !onboardingCompleted && <Onboarding />}
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}
