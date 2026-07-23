import { useEditorStore } from "@/shared/stores/editor";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { House } from "@phosphor-icons/react";

interface EditorBreadcrumbProps {
  panelId?: string;
}

export function EditorBreadcrumb({ panelId }: EditorBreadcrumbProps) {
  const { tabs, getPanelActiveTabId } = useEditorStore();
  const activeTabId = getPanelActiveTabId(panelId ?? null);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex h-breadcrumb shrink-0 items-center px-3">
        <span className="text-ui-xs text-fg-subtle">No file open</span>
      </div>
    );
  }

  const segments = activeTab.path.split("/").filter(Boolean);
  const isDiff = activeTab.kind === "diff";

  return (
    <div className="flex h-breadcrumb shrink-0 items-center px-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" aria-label="Project root">
                <House size={12} />
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
    </div>
  );
}
