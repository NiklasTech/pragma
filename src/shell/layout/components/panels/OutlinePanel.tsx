import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  CaretDown,
  CaretRight,
  Function as FunctionIcon,
  Info,
  ListBullets,
} from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";
import { detectLanguage } from "@/shared/lib/language";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { flushLspDocumentSync } from "@/features/editor/lsp/lspDocuments";
import { lspDocumentSymbol, type LspDocumentSymbolItem } from "@/features/editor/lsp/client";
import { symbolKindName } from "@/features/editor/lsp/symbols";
import { buildOutlineTree, outlineNodeKey, type OutlineNode } from "@/features/editor/lsp/outline";

type OutlineStatus = "idle" | "loading" | "ready" | "error";

export default function OutlinePanel() {
  const { tabs, activeTabId, setActiveTab, setPanelActiveTab, goToPosition } = useEditorStore();
  const editorPanelId = useEditorPanelId();
  const experimentalLsp = useSettingsStore((state) => state.experimental.lsp);
  const activeTab =
    tabs.find((tab): tab is FileTab => tab.id === activeTabId && tab.kind === "file") ?? null;
  const language = activeTab ? detectLanguage(activeTab.name) : null;
  const lspEnabled = useSettingsStore((state) =>
    language ? (state.lsp.enabled[language] ?? true) : false,
  );

  const [items, setItems] = useState<LspDocumentSymbolItem[]>([]);
  const [status, setStatus] = useState<OutlineStatus>("idle");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);

  const supported = Boolean(
    activeTab && language && experimentalLsp && isLspSupported(language) && lspEnabled,
  );
  const filePath = activeTab?.path ?? null;
  const content = activeTab?.content ?? "";

  useEffect(() => {
    setCollapsed([]);
  }, [filePath]);

  useEffect(() => {
    if (!supported || !language || !filePath) {
      setItems([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    const timer = setTimeout(() => {
      void flushLspDocumentSync(language, filePath, content)
        .catch(() => {})
        .then(() => lspDocumentSymbol(language, filePath))
        .then((symbols) => {
          if (cancelled) return;
          setItems(symbols);
          setStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          setItems([]);
          setStatus("error");
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [supported, language, filePath, content, refreshToken]);

  const tree = useMemo(() => buildOutlineTree(items), [items]);

  const toggleNode = useCallback((key: string) => {
    setCollapsed((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  }, []);

  const selectNode = useCallback(
    (node: OutlineNode) => {
      if (!activeTab) return;
      if (editorPanelId) {
        setPanelActiveTab(editorPanelId, activeTab.id);
      } else {
        setActiveTab(activeTab.id);
      }
      goToPosition(activeTab.id, {
        line: node.item.range.start.line + 1,
        column: node.item.range.start.character + 1,
      });
    },
    [activeTab, editorPanelId, setActiveTab, setPanelActiveTab, goToPosition],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-tab shrink-0 items-center justify-between px-3">
        <span className="text-ui-xs font-medium text-fg-default">
          Outline
          {items.length > 0 && (
            <span className="ml-2 rounded-full bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-muted">
              {items.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setRefreshToken((value) => value + 1)}
          disabled={!supported || status === "loading"}
          className="flex items-center gap-1 rounded px-2 py-1 text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-50"
        >
          <ArrowClockwise size={14} className={cn(status === "loading" && "animate-spin")} />
          Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {!activeTab ? (
          <OutlineEmpty icon={ListBullets} message="No file open." />
        ) : !supported ? (
          <OutlineEmpty icon={Info} message="Outline needs a language server for this language." />
        ) : status === "error" ? (
          <OutlineEmpty icon={Info} message="Could not load symbols." />
        ) : tree.length === 0 ? (
          <OutlineEmpty
            icon={ListBullets}
            message={status === "loading" ? "Loading symbols..." : "No symbols in this file."}
          />
        ) : (
          <OutlineTree
            nodes={tree}
            parentKey=""
            collapsed={collapsed}
            onToggle={toggleNode}
            onSelect={selectNode}
          />
        )}
      </div>
    </div>
  );
}

function OutlineEmpty({ icon: Icon, message }: { icon: typeof Info; message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
      <Icon size={28} className="text-fg-subtle" />
      <span>{message}</span>
    </div>
  );
}

interface OutlineTreeProps {
  nodes: OutlineNode[];
  parentKey: string;
  collapsed: string[];
  onToggle: (key: string) => void;
  onSelect: (node: OutlineNode) => void;
}

function OutlineTree({ nodes, parentKey, collapsed, onToggle, onSelect }: OutlineTreeProps) {
  return (
    <ul>
      {nodes.map((node, index) => {
        const key = outlineNodeKey(node, parentKey, index);
        const hasChildren = node.children.length > 0;
        const isCollapsed = collapsed.includes(key);

        return (
          <li key={key}>
            <div className="flex w-full items-center gap-1 pr-3 pl-2 transition-colors hover:bg-bg-hover">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggle(key)}
                  aria-label={
                    isCollapsed ? `Expand ${node.item.name}` : `Collapse ${node.item.name}`
                  }
                  aria-expanded={!isCollapsed}
                  className="flex size-5 shrink-0 items-center justify-center text-fg-subtle"
                >
                  {isCollapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
                </button>
              ) : (
                <span className="size-5 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelect(node)}
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
              >
                <FunctionIcon size={14} className="shrink-0 text-fg-muted" />
                <span className="truncate text-ui-sm text-fg-default">{node.item.name}</span>
                {node.item.detail && (
                  <span className="truncate text-ui-xs text-fg-muted">{node.item.detail}</span>
                )}
                <span className="ml-auto shrink-0 rounded bg-bg-hover px-1.5 py-0.5 text-ui-2xs text-fg-subtle">
                  {symbolKindName(node.item.kind)}
                </span>
              </button>
            </div>
            {hasChildren && !isCollapsed && (
              <OutlineTree
                nodes={node.children}
                parentKey={key}
                collapsed={collapsed}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
