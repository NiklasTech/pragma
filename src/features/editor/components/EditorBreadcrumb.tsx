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
      <div className="flex h-breadcrumb shrink-0 items-center border-b border-border/60 bg-bg-surface px-3">
        <span className="text-ui-xs text-fg-subtle">No file open</span>
      </div>
    );
  }

  const segments = activeTab.path.split("/").filter(Boolean);
  const isDiff = activeTab.kind === "diff";

  return (
    <div className="flex h-breadcrumb shrink-0 items-center border-b border-border/60 bg-bg-surface px-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button
                type="button"
                aria-label="Project root"
                className="rounded-sm p-1 text-fg-muted outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.92]"
              >
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
                      <button
                        type="button"
                        className="rounded-sm px-1 py-0.5 text-fg-muted outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
                      >
                        {segment}
                      </button>
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
