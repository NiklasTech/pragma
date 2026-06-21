import { useEffect } from "react";
import { useOnboardingStore } from "@/shared/stores/onboarding";

export function useOnboarding(): {
  isLoading: boolean;
  isCompleted: boolean;
  initialized: boolean;
} {
  const { isLoading, isCompleted, initialized, initialize } = useOnboardingStore();

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialized, initialize]);

  return { isLoading, isCompleted, initialized };
}
