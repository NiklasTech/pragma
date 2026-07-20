import { PencilSimple, Plus, Trash, ArrowsLeftRight, File } from "@phosphor-icons/react";

export function StatusIcon({ status }: { status: string }) {
  const props = { size: 13, className: "shrink-0" };
  switch (status) {
    case "modified":
      return <PencilSimple {...props} className="shrink-0 text-status-warning" />;
    case "new":
      return <Plus {...props} className="shrink-0 text-status-success" />;
    case "deleted":
      return <Trash {...props} className="shrink-0 text-status-error" />;
    case "renamed":
      return <ArrowsLeftRight {...props} className="shrink-0 text-status-info" />;
    default:
      return <File {...props} className="shrink-0 text-fg-muted" />;
  }
}
