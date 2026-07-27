import * as React from "react";
import { ArrowClockwise, DownloadSimple } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Progress } from "@/shared/components/ui/progress";
import { useUpdaterStore } from "@/features/settings/updater/updaterStore";

export function UpdateDialog() {
  const state = useUpdaterStore((s) => s.state);
  const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
  const downloadAndInstall = useUpdaterStore((s) => s.downloadAndInstall);
  const restartApp = useUpdaterStore((s) => s.restartApp);
  const [dismissedVersion, setDismissedVersion] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (import.meta.env.DEV) return;
    void checkForUpdates({ silent: true });
  }, [checkForUpdates]);

  const version =
    state.status === "available" ||
    state.status === "downloading" ||
    state.status === "ready-to-restart"
      ? state.version
      : null;

  const open = version !== null && (state.status !== "available" || version !== dismissedVersion);

  const description =
    state.status === "downloading"
      ? `Version ${version} of Pragma is being installed.`
      : state.status === "ready-to-restart"
        ? `Version ${version} of Pragma was installed.`
        : `Version ${version} of Pragma is ready to install.`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && setDismissedVersion(version)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update available</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {state.status === "available" && state.notes && (
          <p className="max-h-40 overflow-y-auto text-ui-xs whitespace-pre-wrap text-fg-muted">
            {state.notes}
          </p>
        )}

        {state.status === "downloading" && (
          <div className="flex flex-col gap-2">
            <span className="text-ui-xs text-fg-muted">
              Downloading update... {state.progress}%
            </span>
            <Progress value={state.progress} />
          </div>
        )}

        {state.status === "ready-to-restart" && (
          <p className="text-ui-xs text-fg-muted">
            The update was installed. Restart Pragma to finish.
          </p>
        )}

        {state.status !== "downloading" && (
          <DialogFooter>
            {state.status === "available" && (
              <Button size="sm" onClick={() => void downloadAndInstall()}>
                <DownloadSimple size={14} className="mr-1" />
                Install Update
              </Button>
            )}
            {state.status === "ready-to-restart" && (
              <Button size="sm" onClick={() => void restartApp()}>
                <ArrowClockwise size={14} className="mr-1" />
                Restart
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
