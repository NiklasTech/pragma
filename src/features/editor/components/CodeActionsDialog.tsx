import { Lightning } from "@phosphor-icons/react";

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { executeCodeAction, useCodeActionsStore } from "@/features/editor/lsp/codeActions";

export function CodeActionsDialog() {
  const open = useCodeActionsStore((state) => state.open);
  const actions = useCodeActionsStore((state) => state.actions);
  const closeDialog = useCodeActionsStore((state) => state.closeDialog);

  const handleSelect = (index: number) => {
    const action = actions[index];
    closeDialog();
    if (action) {
      void executeCodeAction(action);
    }
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
      className="sm:max-w-md"
      title="Quick Fix"
      description="Available code actions"
    >
      <CommandInput placeholder="Filter actions..." />
      <CommandList>
        <CommandEmpty>
          <span>No code actions available.</span>
        </CommandEmpty>
        {actions.map((action, index) => (
          <CommandItem
            key={`${action.title}:${index}`}
            value={action.title}
            keywords={[action.title, action.kind ?? ""]}
            onSelect={() => handleSelect(index)}
          >
            <Lightning size={14} className="shrink-0 text-fg-muted" />
            <span className="flex-1 truncate text-ui-sm text-fg-default">{action.title}</span>
            {action.kind && (
              <span className="rounded bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-subtle">
                {action.kind}
              </span>
            )}
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
