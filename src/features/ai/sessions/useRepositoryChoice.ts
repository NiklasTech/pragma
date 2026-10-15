import { useCallback, useState } from "react";

import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { chooseRepository } from "./repositoryChoice";

export interface RepositoryChoice {
  paths: string[];
  /** The picked repository, the active one until something else is picked. */
  rootPath: string | null;
  pick: (path: string) => void;
  /** Goes back to the active repository, for example when a picker opens again. */
  reset: () => void;
}

/// A pick lasts until the active repository changes.
export function useRepositoryChoice(): RepositoryChoice {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const activeRoot = useFileExplorerStore((state) => state.rootPath);
  const [picked, setPicked] = useState<{ path: string; activeRoot: string | null } | null>(null);
  const pick = useCallback((path: string) => setPicked({ path, activeRoot }), [activeRoot]);
  const reset = useCallback(() => setPicked(null), []);
  const current = picked?.activeRoot === activeRoot ? picked.path : null;

  return { paths, rootPath: chooseRepository(paths, activeRoot, current), pick, reset };
}
