import { useEditorStore } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { FolderSimple } from "@phosphor-icons/react";
import { EditorStatusChip } from "./EditorStatusChip";

interface EditorBreadcrumbProps {
  panelId?: string;
}

export function EditorBreadcrumb({ panelId }: EditorBreadcrumbProps) {
  const { tabs, getPanelActiveTabId } = useEditorStore();
  const activeTabId = getPanelActiveTabId(panelId ?? null);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const rootPath = useFileExplorerStore((s) => s.rootPath);

  if (!activeTab) return null;

  const insideRoot = rootPath !== null && activeTab.path.startsWith(`${rootPath}/`);
  const relativePath = insideRoot ? activeTab.path.slice(rootPath.length + 1) : activeTab.path;
  const segments = relativePath.split("/").filter(Boolean);
  const isDiff = activeTab.kind === "diff";

  return (
    <div className="@container flex h-breadcrumb shrink-0 items-center px-3">
      <Breadcrumb className="min-w-0 overflow-hidden">
        <BreadcrumbList className="flex-nowrap whitespace-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" aria-label="Project root" className="flex items-center gap-1">
                <FolderSimple size={12} />
                {insideRoot && getWorkspaceName(rootPath)}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {isDiff && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Diff</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            return (
              <span key={`${segment}-${index}`} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{segment}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button type="button">{segment}</button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      {panelId && (
        <div className="hidden @min-[420px]:contents">
          <EditorStatusChip panelId={panelId} />
        </div>
      )}
    </div>
  );
}
