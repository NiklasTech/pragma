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
    <div className={cn("flex items-center gap-2 px-2 text-ui-xs text-fg-muted", className)}>
      {children}
    </div>
  );
}

function StatusbarSeparator() {
  return <div className="h-3 w-px bg-border/60" />;
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
            <span className="font-medium text-status-success">VIM</span>
          </StatusbarSection>
        );

      case "cursor":
        return (
          <StatusbarSection key={item}>
            <span>
              Ln {cursor?.line ?? 1}, Col {cursor?.column ?? 1}
            </span>
          </StatusbarSection>
        );

      case "fileType":
        return (
          <StatusbarSection key={item}>
            <span>{fileType}</span>
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
            <GitBranch size={12} />
            <span className="font-medium text-fg-default">{branch}</span>
          </StatusbarSection>
        );

      case "gitSync":
        if (!branch || (ahead === 0 && behind === 0)) return null;
        return (
          <StatusbarSection key={item}>
            <span>
              {ahead > 0 && `↑${ahead}`}
              {behind > 0 && `↓${behind}`}
            </span>
          </StatusbarSection>
        );

      case "problems":
        if (errorCount === 0 && warningCount === 0) return null;
        return (
          <StatusbarSection key={item}>
            {errorCount > 0 && (
              <>
                <XCircle size={12} className="text-status-error" />
                <span>{errorCount}</span>
              </>
            )}
            {warningCount > 0 && (
              <>
                <Warning size={12} className="text-status-warning" />
                <span>{warningCount}</span>
              </>
            )}
          </StatusbarSection>
        );

      case "aiProvider":
        return (
          <StatusbarSection key={item}>
            <Robot size={12} />
            <span className="truncate max-w-[120px]">
              {activeProvider ? `${activeProvider} · ${activeModel}` : "No AI"}
            </span>
          </StatusbarSection>
        );

      case "theme":
        return (
          <StatusbarSection key={item}>
            <Palette size={12} />
            <span className="capitalize">{theme}</span>
          </StatusbarSection>
        );

      default:
        return null;
    }
  };

  const items = statusbar.items.map(renderItem).filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="flex h-statusbar shrink-0 items-center justify-between border-t border-border/60 bg-bg-surface px-1 select-none">
      <div className="flex items-center">
        {items.map((item, index) => (
          <span key={index} className="contents">
            {item}
            {index < items.length - 1 && <StatusbarSeparator />}
          </span>
        ))}
      </div>
      <div className="flex items-center">
        <StatusbarSection>
          <CheckCircle size={12} className="text-status-success" />
          <span>Ready</span>
        </StatusbarSection>
      </div>
    </div>
  );
}
