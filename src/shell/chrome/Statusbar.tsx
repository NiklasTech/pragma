import { GitBranch, Warning, XCircle, CheckCircle, Robot, Palette } from "@phosphor-icons/react";
import { useSettingsStore, type StatusbarItem } from "@/shared/stores/settings";
import { useEditorStore, type EditorTab } from "@/shared/stores/editor";
import { useGitStore } from "@/shared/stores/git";
import { useAIStore } from "@/shared/stores/ai";
import { useProblemsStore } from "@/shared/stores/problems";
import { cn } from "@/shared/lib/utils";

function isFileTab(tab: EditorTab | undefined): tab is Extract<EditorTab, { kind: "file" }> {
  return tab?.kind === "file";
}

function detectEncoding(content: string): string {
  return content.startsWith("\uFEFF") ? "UTF-8 BOM" : "UTF-8";
}

function detectEol(content: string): string {
  return content.includes("\r\n") ? "CRLF" : "LF";
}

function StatusbarSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 px-2 text-ui-xs text-fg-muted", className)}>
      {children}
    </div>
  );
}

function StatusbarSeparator() {
  return <div className="h-3 w-px bg-border/40 rounded-full" />;
}

export function Statusbar() {
  const { statusbar, theme, editor } = useSettingsStore();
  const { tabs, activeTabId, cursorPositions } = useEditorStore();
  const { snapshot } = useGitStore();
  const { activeProvider, activeModel } = useAIStore();
  const { problems } = useProblemsStore();

  if (!statusbar.visible) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const cursor = activeTabId ? cursorPositions[activeTabId] : null;
  const fileName = activeTab?.name ?? "";
  const activeContent = isFileTab(activeTab) ? activeTab.content : "";

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const fileType = ext ? ext.toUpperCase() : "TXT";

  const branch = snapshot?.repo.branch ?? null;
  const ahead = snapshot?.ahead ?? 0;
  const behind = snapshot?.behind ?? 0;

  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;

  const renderItem = (item: StatusbarItem) => {
    switch (item) {
      case "vimMode":
        if (!editor.vimMode) return null;
        return (
          <StatusbarSection key={item}>
            <span className="rounded-md bg-status-success/15 px-1.5 py-0.5 font-semibold text-status-success text-[10px] tracking-wider">VIM</span>
          </StatusbarSection>
        );

      case "cursor":
        return (
          <StatusbarSection key={item}>
            <span className="tabular-nums">
              Ln {cursor?.line ?? 1}, Col {cursor?.column ?? 1}
            </span>
          </StatusbarSection>
        );

      case "fileType":
        return (
          <StatusbarSection key={item}>
            <span className="rounded-md bg-bg-hover px-1.5 py-0.5 font-medium text-[10px]">{fileType}</span>
          </StatusbarSection>
        );

      case "encoding":
        return (
          <StatusbarSection key={item}>
            <span>{activeContent ? detectEncoding(activeContent) : "UTF-8"}</span>
          </StatusbarSection>
        );

      case "eol":
        return (
          <StatusbarSection key={item}>
            <span>{activeContent ? detectEol(activeContent) : "LF"}</span>
          </StatusbarSection>
        );

      case "gitBranch":
        if (!branch) return null;
        return (
          <StatusbarSection key={item}>
            <GitBranch size={11} className="text-accent" />
            <span className="font-medium text-fg-default">{branch}</span>
          </StatusbarSection>
        );

      case "gitSync":
        if (!branch || (ahead === 0 && behind === 0)) return null;
        return (
          <StatusbarSection key={item}>
            <span className="tabular-nums text-fg-muted">
              {ahead > 0 && (
                <span className="text-status-success">↑{ahead}</span>
              )}
              {behind > 0 && (
                <span className="text-status-warning ml-1">↓{behind}</span>
              )}
            </span>
          </StatusbarSection>
        );

      case "problems":
        if (errorCount === 0 && warningCount === 0) return null;
        return (
          <StatusbarSection key={item} className="gap-2">
            {errorCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle size={11} className="text-status-error" />
                <span className="font-medium text-status-error">{errorCount}</span>
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1">
                <Warning size={11} className="text-status-warning" />
                <span className="font-medium text-status-warning">{warningCount}</span>
              </span>
            )}
          </StatusbarSection>
        );

      case "aiProvider":
        return (
          <StatusbarSection key={item}>
            <Robot size={11} className="text-fg-subtle" />
            <span className="truncate max-w-[120px] text-fg-subtle">
              {activeProvider ? `${activeProvider} · ${activeModel}` : "No AI"}
            </span>
          </StatusbarSection>
        );

      case "theme":
        return (
          <StatusbarSection key={item}>
            <Palette size={11} className="text-fg-subtle" />
            <span className="capitalize text-fg-subtle">{theme}</span>
          </StatusbarSection>
        );

      default:
        return null;
    }
  };

  const items = statusbar.items.map(renderItem).filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="flex h-statusbar shrink-0 items-center justify-between border-t border-border/40 px-1 select-none"
      style={{
        background: "linear-gradient(0deg, var(--bg-surface) 0%, rgba(18,18,26,0.9) 100%)",
      }}
    >
      <div className="flex items-center gap-0.5">
        {items.map((item, index) => (
          <span key={index} className="contents">
            {item}
            {index < items.length - 1 && <StatusbarSeparator />}
          </span>
        ))}
      </div>
      <div className="flex items-center">
        <StatusbarSection>
          <span className="flex h-1.5 w-1.5 rounded-full bg-status-success shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          <span className="text-fg-subtle">Ready</span>
        </StatusbarSection>
      </div>
    </div>
  );
}
