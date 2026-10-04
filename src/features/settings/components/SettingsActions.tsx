import { ArrowCounterClockwise, DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { exportSettings, importSettings } from "./settings-io";

export function SettingsActions() {
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);

  const handleExport = async () => {
    try {
      await exportSettings();
    } catch {}
  };

  const handleImport = async () => {
    try {
      await importSettings();
    } catch {}
  };

  return (
    <div className="flex shrink-0 flex-col gap-0.5 border-t border-border-subtle p-2">
      <button
        type="button"
        onClick={handleExport}
        className="flex h-7 items-center gap-2.5 rounded-md px-2.5 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
      >
        <DownloadSimple size={14} />
        Export
      </button>
      <button
        type="button"
        onClick={handleImport}
        className="flex h-7 items-center gap-2.5 rounded-md px-2.5 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
      >
        <UploadSimple size={14} />
        Import
      </button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <button
              type="button"
              className="flex h-7 items-center gap-2.5 rounded-md px-2.5 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-status-error"
            >
              <ArrowCounterClockwise size={14} />
              Reset Defaults
            </button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore all settings to their default values. Your custom themes and API
              keys will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetToDefaults}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
