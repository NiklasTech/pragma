"use client";

import { useState } from "react";
import { Copy, Export } from "@phosphor-icons/react";

import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { ChatSession } from "@/shared/stores/ai";

import { copySessionMarkdown, exportSessionMarkdown } from "./sessionExport";

/// Session menu entries that copy or save the conversation as Markdown.
export function ExportSessionMenu({ session }: { session: ChatSession }) {
  const [includeToolOutput, setIncludeToolOutput] = useState(false);
  if (session.kind === "terminal") return null;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Export size={13} />
        <span>Export</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-[200px]">
        <DropdownMenuItem onClick={() => void copySessionMarkdown(session, includeToolOutput)}>
          <Copy size={13} />
          <span>Copy as Markdown</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void exportSessionMarkdown(session, includeToolOutput)}>
          <Export size={13} />
          <span>Export as Markdown...</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={includeToolOutput}
          onCheckedChange={setIncludeToolOutput}
          closeOnClick={false}
        >
          Include tool output
        </DropdownMenuCheckboxItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
