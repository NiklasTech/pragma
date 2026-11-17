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
    <div className="flex shrink-0 items-center">
      <Button variant="ghost" size="xs" onClick={handleExport} className="px-1.5 text-fg-subtle">
        export
      </Button>
      <Button variant="ghost" size="xs" onClick={handleImport} className="px-1.5 text-fg-subtle">
        import
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="px-1.5 text-fg-subtle hover:text-status-error"
            >
              reset all
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
