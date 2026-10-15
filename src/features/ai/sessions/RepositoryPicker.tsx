"use client";

import { FolderSimple } from "@phosphor-icons/react";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { getWorkspaceName } from "@/shared/lib/workspaceName";

interface RepositoryPickerProps {
  paths: string[];
  value: string;
  onChange: (path: string) => void;
}

/// A select of the open repositories for forms and toolbars.
export function RepositorySelect({
  paths,
  value,
  onChange,
  className,
  size,
}: RepositoryPickerProps & { className?: string; size?: "sm" | "default" }) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
    >
      <SelectTrigger aria-label="Repository" title={value} size={size} className={className}>
        <FolderSimple size={13} className="text-fg-subtle" />
        <SelectValue>{getWorkspaceName(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {paths.map((path) => (
          <SelectItem key={path} value={path} title={path}>
            {getWorkspaceName(path)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/// A submenu of the open repositories at the top of a dropdown menu.
export function RepositoryMenuPicker({ paths, value, onChange }: RepositoryPickerProps) {
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger title={value}>
          <FolderSimple size={14} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">Repository</span>
            <span className="truncate text-ui-2xs text-fg-subtle">{getWorkspaceName(value)}</span>
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-64">
          <DropdownMenuRadioGroup value={value} onValueChange={(next: string) => onChange(next)}>
            {paths.map((path) => (
              <DropdownMenuRadioItem key={path} value={path} title={path}>
                <span className="truncate">{getWorkspaceName(path)}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
    </>
  );
}
