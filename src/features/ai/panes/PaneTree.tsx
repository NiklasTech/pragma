"use client";

import { useCallback, useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore, type AgentStatus } from "@/features/agent/store";

import { BrowserPane } from "../browser/BrowserPane";
import { ChatPanel } from "../components/ChatPanel";
import { TerminalPane } from "../terminal/TerminalPane";
import { getTerminalEntryStatus } from "../terminal/runner";
import { ChildRunView } from "../children/ChildRunView";
import { isRunLive, useChildRunsStore } from "../children/runStore";
import { ChatTranscript } from "./ChatTranscript";
import { EmptyLeafView } from "./EmptyLeafView";
import { collectLeaves } from "./layout";
import { usePaneMaximizeStore } from "./maximize";
import { PaneHeader } from "./PaneHeader";
import { buildCloseConfirm, type CloseConfirm, type SessionCloseTarget } from "./sessionClose";
import {
  findGroup,
  findLeafGroup,
  MAX_PANES,
  type Leaf,
  type PaneNode,
  type SplitNode,
  type TabsNode,
} from "./operations";
import { usePaneDragStore } from "./paneDrag";
import { selectLeafCount, selectRoot, useAgentsPanesStore } from "./store";

const MIN_PANE_SIZE = `${160}px`;

function LeafContent({ leaf, focused }: { leaf: Leaf; focused: boolean }) {
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const session = useAIStore((state) =>
    state.chatSessions.find((item) => item.id === leaf.sessionId),
  );
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const runningInBackground = useChildRunsStore((state) =>
    leaf.sessionId ? isRunLive(state.runs[leaf.sessionId]) : false,
  );

  if (leaf.browser) return <BrowserPane leafId={leaf.id} />;
  if (leaf.sessionId === null) return <EmptyLeafView leafId={leaf.id} />;
  if (session?.kind === "terminal") {
    return <TerminalPane session={session} workspaceRoot={rootPath} />;
  }
  if (runningInBackground) return <ChildRunView sessionId={leaf.sessionId} />;
  if (focused && leaf.sessionId === activeChatSessionId) return <ChatPanel hideHeader />;
  return <ChatTranscript sessionId={leaf.sessionId} />;
}

function PaneView({ node, totalLeaves }: { node: TabsNode; totalLeaves: number }) {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const root = useAgentsPanesStore((state) => selectRoot(state, rootPath));
  const focusedLeafId = useAgentsPanesStore(
    (state) => state.trees[rootPath]?.focusedLeafId ?? null,
  );
  const focusLeaf = useAgentsPanesStore((state) => state.focusLeaf);
  const closeLeaf = useAgentsPanesStore((state) => state.closeLeaf);
  const swapPanes = useAgentsPanesStore((state) => state.swapPanes);
  const maximized = usePaneMaximizeStore((state) => state.maximized[rootPath] === node.id);
  const toggleMaximize = usePaneMaximizeStore((state) => state.toggle);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const leaf = node.children.find((child) => child.id === node.activeLeafId) ?? node.children[0];
  const dragging = usePaneDragStore(
    (state) => leaf !== undefined && state.sourceLeafId === leaf.id,
  );
  const dropTarget = usePaneDragStore(
    (state) => leaf !== undefined && state.targetLeafId === leaf.id,
  );
  const [pendingClose, setPendingClose] = useState<{
    leafIds: string[];
    confirm: CloseConfirm;
  } | null>(null);

  const requestClose = useCallback(
    (leafIds: string[]) => {
      const leaves = collectLeaves(root);
      const targets: SessionCloseTarget[] = leafIds.map((leafId) => {
        const target = leaves.find((child) => child.id === leafId);
        const session = target?.sessionId
          ? chatSessions.find((item) => item.id === target.sessionId)
          : undefined;
        return {
          sessionId: target?.sessionId ?? null,
          title: session?.title ?? "New thread",
          kind: session?.kind,
          terminalStatus:
            target?.sessionId && session?.kind === "terminal"
              ? getTerminalEntryStatus(target.sessionId)
              : null,
        };
      });

      const confirm = buildCloseConfirm(targets, agentStatus, runSessionId);
      if (!confirm) {
        for (const leafId of leafIds) closeLeaf(rootPath, leafId);
        return;
      }
      setPendingClose({ leafIds, confirm });
    },
    [agentStatus, chatSessions, closeLeaf, root, rootPath, runSessionId],
  );

  const handleConfirmClose = useCallback(() => {
    if (!pendingClose) return;
    for (const leafId of pendingClose.leafIds) closeLeaf(rootPath, leafId);
    setPendingClose(null);
  }, [closeLeaf, pendingClose, rootPath]);

  if (!leaf) return null;

  const focused = focusedLeafId === leaf.id;
  const isRunOwner = leaf.sessionId !== null && leaf.sessionId === runSessionId;
  const status: AgentStatus =
    isRunOwner || (runSessionId === null && focused) ? agentStatus : "idle";
  const otherLeafIds = collectLeaves(root)
    .map((child) => child.id)
    .filter((id) => id !== leaf.id);

  return (
    <div
      data-pane-group={node.id}
      data-pane-leaf={leaf.id}
      data-pane-status={status}
      data-pane-focused={focused ? "true" : undefined}
      data-pane-maximized={maximized ? "true" : undefined}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border bg-bg-root transition-[border-color,opacity]",
        focused ? "border-border-focus" : "border-border",
        dragging && "opacity-60",
        maximized ? "absolute inset-0 z-30" : "relative h-full",
      )}
    >
      <PaneHeader
        leaf={leaf}
        focused={focused}
        status={status}
        atCap={totalLeaves >= MAX_PANES}
        maximized={maximized}
        hasOtherPanes={otherLeafIds.length > 0}
        onClose={() => requestClose([leaf.id])}
        onCloseOthers={() => requestClose(otherLeafIds)}
        onToggleMaximize={() => {
          focusLeaf(rootPath, leaf.id);
          toggleMaximize(rootPath, node.id);
        }}
        onDropOn={(targetLeafId) => swapPanes(rootPath, leaf.id, targetLeafId)}
      />

      <div className="relative min-h-0 flex-1" onPointerDown={() => focusLeaf(rootPath, leaf.id)}>
        <LeafContent leaf={leaf} focused={focused} />
      </div>

      {dropTarget && (
        <div
          className="pointer-events-none absolute inset-0 z-20 rounded-lg border-2 border-primary bg-primary/10"
          aria-hidden="true"
        />
      )}

      <AlertDialog
        open={pendingClose !== null}
        onOpenChange={(open) => {
          if (!open) setPendingClose(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Warning size={20} className="text-status-warning" />
            </AlertDialogMedia>
            <AlertDialogTitle>{pendingClose?.confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingClose?.confirm.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SplitView({ node, totalLeaves }: { node: SplitNode; totalLeaves: number }) {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const setSplitSizes = useAgentsPanesStore((state) => state.setSplitSizes);
  const paneMaximized = usePaneMaximizeStore((state) => rootPath in state.maximized);
  const orientation = node.direction === "horizontal" ? "horizontal" : "vertical";
  const childKey = node.children.map((child) => child.id).join("|");
  // Panels re-register when defaultSize changes, so it only follows the store when children change.
  const [initial, setInitial] = useState({ key: childKey, sizes: node.sizes });
  if (initial.key !== childKey) setInitial({ key: childKey, sizes: node.sizes });
  const defaultSizes = initial.key === childKey ? initial.sizes : node.sizes;

  return (
    <ResizablePanelGroup
      id={node.id}
      orientation={orientation}
      className="h-full w-full"
      disabled={paneMaximized}
      resizeTargetMinimumSize={{ fine: 12, coarse: 24 }}
      onLayoutChanged={(layout, meta) => {
        if (!meta.isUserInteraction) return;
        const sizes = node.children.map((child) => layout[child.id] ?? 100 / node.children.length);
        setSplitSizes(rootPath, node.id, sizes);
      }}
    >
      {node.children.flatMap((child, index) => [
        <ResizablePanel
          key={child.id}
          id={child.id}
          defaultSize={`${defaultSizes[index] ?? 100 / node.children.length}%`}
          minSize={MIN_PANE_SIZE}
        >
          <PaneNodeView node={child} totalLeaves={totalLeaves} />
        </ResizablePanel>,
        index < node.children.length - 1 ? (
          <ResizableHandle
            key={`${child.id}-handle`}
            className="w-1.5 rounded-full bg-transparent hover:bg-primary/30 data-[resize-handle-active]:bg-primary/50 aria-[orientation=horizontal]:h-1.5 aria-[orientation=horizontal]:w-full"
          />
        ) : null,
      ])}
    </ResizablePanelGroup>
  );
}

function PaneNodeView({ node, totalLeaves }: { node: PaneNode; totalLeaves: number }) {
  if (node.type === "split") {
    return <SplitView key={node.id} node={node} totalLeaves={totalLeaves} />;
  }
  return <PaneView key={node.id} node={node} totalLeaves={totalLeaves} />;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, .xterm, [role='menu'], [role='dialog']") !== null
  );
}

export function PaneTree() {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const root = useAgentsPanesStore((state) => selectRoot(state, rootPath));
  const totalLeaves = useAgentsPanesStore((state) => selectLeafCount(state, rootPath));
  const focusedLeafId = useAgentsPanesStore(
    (state) => state.trees[rootPath]?.focusedLeafId ?? null,
  );
  const maximizedGroupId = usePaneMaximizeStore((state) => state.maximized[rootPath] ?? null);
  const restore = usePaneMaximizeStore((state) => state.restore);

  const focusedGroupId = focusedLeafId ? (findLeafGroup(root, focusedLeafId)?.id ?? null) : null;
  const maximizedExists = maximizedGroupId !== null && findGroup(root, maximizedGroupId) !== null;

  useEffect(() => {
    if (!maximizedGroupId) return;
    // A closed pane, a new pane or focus elsewhere brings the full layout back.
    if (!maximizedExists || (focusedGroupId !== null && focusedGroupId !== maximizedGroupId)) {
      restore(rootPath);
    }
  }, [focusedGroupId, maximizedExists, maximizedGroupId, restore, rootPath]);

  useEffect(() => {
    if (!maximizedGroupId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isTextEntry(event.target)) return;
      restore(rootPath);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maximizedGroupId, restore, rootPath]);

  if (!root) return null;

  return (
    <div className="relative min-h-0 flex-1 p-1.5">
      <div className="relative h-full w-full">
        <PaneNodeView node={root} totalLeaves={totalLeaves} />
      </div>
    </div>
  );
}
