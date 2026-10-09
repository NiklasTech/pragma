"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { FileTab } from "@/shared/stores/editor";

import { reopenWithEncoding, saveWithEncoding } from "./encodingActions";
import { encodingLabel, FILE_ENCODINGS } from "./encodings";

/// The status bar encoding, with actions to reopen or save the file in another encoding.
export function EncodingMenu({ tab }: { tab: FileTab }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title="Change file encoding"
            className="rounded-sm transition-colors hover:text-fg-default"
          />
        }
      >
        {encodingLabel(tab.encoding)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={tab.isModified}>
            Reopen with encoding
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
            {FILE_ENCODINGS.map((item) => (
              <DropdownMenuItem
                key={item.value}
                onClick={() => void reopenWithEncoding(tab, item.value)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Save with encoding</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
            {FILE_ENCODINGS.map((item) => (
              <DropdownMenuItem
                key={item.value}
                onClick={() => void saveWithEncoding(tab, item.value)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
