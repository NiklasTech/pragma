import { Check, Palette } from "@phosphor-icons/react";

import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import {
  assignRepositoryColors,
  REPOSITORY_PALETTE,
  repositoryColorEntry,
  withRepositoryColor,
} from "@/shared/lib/repositoryColors";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useSettingsStore } from "@/shared/stores/settings";

const PALETTE_NAMES = ["Blue", "Pink", "Green", "Orange", "Purple", "Yellow", "Teal", "Red"];

/// Picks the active repository's color and whether it serves as the accent color.
export function RepositoryColorMenu({ path }: { path: string }) {
  const settings = useSettingsStore((s) => s.repositoryColors);
  const setSettings = useSettingsStore((s) => s.setRepositoryColorSettings);
  const entry = repositoryColorEntry(settings.byPath, path);

  const choose = (color: string | null) => {
    const byPath = withRepositoryColor(settings.byPath, path, color);
    // Automatic hands out the next free palette color right away.
    const paths = useOpenRepositoriesStore.getState().paths;
    setSettings({ byPath: assignRepositoryColors(paths, byPath) ?? byPath });
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette size={14} />
        Repository Color
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-[200px]">
        <DropdownMenuItem onClick={() => choose(null)}>
          <Check size={14} className={entry?.chosen ? "invisible" : undefined} />
          Automatic
        </DropdownMenuItem>
        {REPOSITORY_PALETTE.map((color, index) => (
          <DropdownMenuItem key={color} onClick={() => choose(color)}>
            <Check
              size={14}
              className={entry?.chosen && entry.color === color ? undefined : "invisible"}
            />
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            {PALETTE_NAMES[index]}
          </DropdownMenuItem>
        ))}
        <label className="flex items-center gap-2 px-2 py-1.5 text-ui-sm text-fg-default">
          <Input
            type="color"
            aria-label="Custom repository color"
            value={entry?.color ?? REPOSITORY_PALETTE[0]}
            onChange={(e) => choose(e.target.value)}
            className="h-6 w-8 cursor-pointer p-0.5"
          />
          Custom…
        </label>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.useAsAccent}
          onCheckedChange={(useAsAccent) => setSettings({ useAsAccent })}
        >
          Use as Accent Color
        </DropdownMenuCheckboxItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
