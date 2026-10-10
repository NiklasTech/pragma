import { useShallow } from "zustand/react/shallow";
import { useEffect } from "react";
import { useOnboardingStore } from "@/shared/stores/onboarding";

export function useOnboarding(): {
  isLoading: boolean;
  isCompleted: boolean;
  initialized: boolean;
} {
  const { isLoading, isCompleted, initialized, initialize } = useOnboardingStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
      isCompleted: s.isCompleted,
      initialized: s.initialized,
      initialize: s.initialize,
    })),
  );

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialized, initialize]);

  return { isLoading, isCompleted, initialized };
}
