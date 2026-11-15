import { Plus } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Button } from "@/shared/components/ui/button";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { terminalRepositoryChoices } from "../terminalRepository";

/// Starts a terminal in the active repository, or asks for the repository once several are open.
export function NewTerminalButton({ onCreate }: { onCreate: (rootPath: string | null) => void }) {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const activeRoot = useFileExplorerStore((state) => state.rootPath);
  const choices = terminalRepositoryChoices(paths, activeRoot);

  if (choices.length < 2) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New Session"
        onClick={() => onCreate(activeRoot)}
        className="text-fg-muted"
        title="New Session"
      >
        <Plus size={13} weight="bold" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New Session"
            title="New Session"
            type="button"
            className="text-fg-muted"
          >
            <Plus size={13} weight="bold" />
          </Button>
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
