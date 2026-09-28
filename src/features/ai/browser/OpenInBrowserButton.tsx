"use client";

import { Browser } from "@phosphor-icons/react";

import type { ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { findBrowserLeaf, MAX_PANES_TITLE } from "../panes/operations";
import { selectRoot, useAgentsPanesStore } from "../panes/store";
import { canOpenBrowserPane, openUrlInBrowser } from "./open";
import { useLatestLocalUrl } from "./useLatestLocalUrl";

export function OpenInBrowserButton({
  session,
  className,
}: {
  session: ChatSession;
  className: string;
}) {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const root = useAgentsPanesStore((state) => selectRoot(state, rootPath));
  const url = useLatestLocalUrl(session);

  if (!url) return null;

  const enabled = findBrowserLeaf(root) !== null || canOpenBrowserPane(root);

  return (
    <button
      type="button"
      onClick={() => openUrlInBrowser(rootPath, url, true)}
      disabled={!enabled}
      aria-label="Open in browser"
      title={enabled ? `Open ${url} in browser` : MAX_PANES_TITLE}
      className={className}
    >
      <Browser size={13} />
    </button>
  );
}
