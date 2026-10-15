import { Plus } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { terminalRepositoryChoices } from "../terminalRepository";

const BUTTON_CLASS =
  "flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40";

/// Starts a terminal in the active repository, or asks for the repository once several are open.
export function NewTerminalButton({ onCreate }: { onCreate: (rootPath: string | null) => void }) {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const activeRoot = useFileExplorerStore((state) => state.rootPath);
  const choices = terminalRepositoryChoices(paths, activeRoot);

  if (choices.length < 2) {
    return (
      <button
        type="button"
        onClick={() => onCreate(activeRoot)}
        className={BUTTON_CLASS}
        title="New Session"
      >
        <Plus size={13} weight="bold" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={BUTTON_CLASS} title="New Session">
            <Plus size={13} weight="bold" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>New terminal in</DropdownMenuLabel>
          {choices.map((path) => (
            <DropdownMenuItem key={path} title={path} onClick={() => onCreate(path)}>
              <span className="min-w-0 truncate">{getWorkspaceName(path)}</span>
              {path === activeRoot && (
                <span className="ml-auto text-ui-2xs text-fg-subtle">active</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
