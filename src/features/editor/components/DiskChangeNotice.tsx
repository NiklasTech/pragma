import { Warning } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useEditorStore } from "@/shared/stores/editor";
import { useDiskStateStore } from "@/shared/stores/diskState";
import { compareWithDisk, keepLocalVersion, reloadFromDisk } from "@/features/editor/diskSync";

interface DiskChangeNoticeProps {
  tabId: string;
  path: string;
  name: string;
}

export function DiskChangeNotice({ tabId, path, name }: DiskChangeNoticeProps) {
  const status = useDiskStateStore((s) => s.statuses[path]);
  const closeTab = useEditorStore((s) => s.closeTab);

  if (!status) return null;

  if (status === "deleted") {
    return (
      <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
        <Warning />
        <AlertDescription className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1">{name} was deleted on disk. Saving recreates it.</span>
          <Button size="xs" variant="outline" onClick={() => closeTab(tabId)}>
            Close
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
      <Warning />
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1">{name} changed on disk and you have unsaved edits.</span>
        <Button size="xs" variant="outline" onClick={() => void reloadFromDisk(tabId)}>
          Reload
        </Button>
        <Button size="xs" variant="outline" onClick={() => void keepLocalVersion(tabId)}>
          Keep Mine
        </Button>
        <Button size="xs" variant="outline" onClick={() => void compareWithDisk(tabId)}>
          Compare
        </Button>
      </AlertDescription>
    </Alert>
  );
}
