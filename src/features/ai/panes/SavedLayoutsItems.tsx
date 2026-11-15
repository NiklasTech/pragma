import { FloppyDisk, SquareHalf, Trash } from "@phosphor-icons/react";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ICON_SIZE } from "@/shared/components/ui/icon-button";

import { presetPaneCount, useLayoutPresetsStore } from "./layoutPresets";
import { openLayoutPreset } from "./openLayoutPreset";

interface SavedLayoutsItemsProps {
  rootPath: string;
  canSave: boolean;
  onSave: () => void;
}

/// The layouts part of the pane layout menu: save the tab, open a saved layout, delete one.
export function SavedLayoutsItems({ rootPath, canSave, onSave }: SavedLayoutsItemsProps) {
  const presets = useLayoutPresetsStore((state) => state.presets);
  const remove = useLayoutPresetsStore((state) => state.remove);

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Layouts</DropdownMenuLabel>
        <DropdownMenuItem disabled={!canSave} onClick={onSave}>
          <FloppyDisk size={ICON_SIZE.sm} />
          Save tab as layout…
        </DropdownMenuItem>
        {presets.map((preset) => (
          <DropdownMenuItem key={preset.id} onClick={() => void openLayoutPreset(rootPath, preset)}>
            <SquareHalf size={ICON_SIZE.sm} />
            <span className="min-w-0 flex-1 truncate">{preset.name}</span>
            <span className="text-ui-2xs text-fg-subtle tabular-nums">
              {presetPaneCount(preset.layout)}
            </span>
          </DropdownMenuItem>
        ))}
        {presets.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Trash size={ICON_SIZE.sm} />
              Delete layout
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[180px]">
              {presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  variant="destructive"
                  onClick={() => remove(preset.id)}
                >
                  {preset.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuGroup>
    </>
  );
}
