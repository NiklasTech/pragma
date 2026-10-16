import { useEffect } from "react";
import { assignRepositoryColors, repositoryAccent } from "@/shared/lib/repositoryColors";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useSettingsStore } from "@/shared/stores/settings";

/** Gives newly opened repositories their automatic color. */
export function useRepositoryColorAssignment(): void {
  const paths = useOpenRepositoriesStore((s) => s.paths);
  useEffect(() => {
    const settings = useSettingsStore.getState();
    const byPath = assignRepositoryColors(paths, settings.repositoryColors.byPath);
    if (byPath) settings.setRepositoryColorSettings({ byPath });
  }, [paths]);
}

/** The accent the active repository asks for, or an empty string. */
export function useRepositoryAccent(): string {
  const settings = useSettingsStore((s) => s.repositoryColors);
  const activePath = useOpenRepositoriesStore((s) => s.activePath);
  return repositoryAccent(settings, activePath);
}
