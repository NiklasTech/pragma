import { ArrowCounterClockwise, DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
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
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExport}
        className="h-7 justify-start gap-2.5 px-2.5 font-normal"
      >
        <DownloadSimple size={14} />
        Export
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleImport}
        className="h-7 justify-start gap-2.5 px-2.5 font-normal"
      >
        <UploadSimple size={14} />
        Import
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 justify-start gap-2.5 px-2.5 font-normal hover:text-status-error"
            >
              <ArrowCounterClockwise size={14} />
              Reset Defaults
            </Button>
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
