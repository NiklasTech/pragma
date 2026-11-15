"use client";

import { Browser } from "@phosphor-icons/react";

import { IconButton } from "@/shared/components/ui/icon-button";
import type { ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { findBrowserLeaf, MAX_PANES_TITLE } from "../panes/operations";
import { selectRoot, useAgentsPanesStore, usePaneTreeKey } from "../panes/store";
import { canOpenBrowserPane, openUrlInBrowser } from "./open";
import { useLatestLocalUrl } from "./useLatestLocalUrl";

export function OpenInBrowserButton({ session }: { session: ChatSession }) {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const treeKey = usePaneTreeKey(rootPath);
  const root = useAgentsPanesStore((state) => selectRoot(state, treeKey));
  const url = useLatestLocalUrl(session);

  if (!url) return null;

  const enabled = findBrowserLeaf(root) !== null || canOpenBrowserPane(root);

  return (
    <IconButton
      icon={Browser}
      size="sm"
      label={enabled ? `Open ${url} in browser` : MAX_PANES_TITLE}
      disabled={!enabled}
      className="size-7 text-fg-subtle"
      onClick={() => openUrlInBrowser(rootPath, url, true)}
    />
  );
}
