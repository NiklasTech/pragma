"use client";

import { Button } from "@/shared/components/ui/button";
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
import { useLayoutStore } from "@/shell/layout";
import { defaultPresetId, presetLabels } from "@/shell/layout/presets";
import { StatusbarSettings } from "./StatusbarSettings";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";

export function LayoutSettings() {
  const applyPreset = useLayoutStore((s) => s.applyPreset);

  const handleReset = () => {
    applyPreset(defaultPresetId);
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Panels">
        <SettingRow
          label="Reset Layout"
          description="Restore sidebar, terminal and AI panel sizes to the default layout"
          control={
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1 transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <ArrowCounterClockwise size={14} />
                    Reset to {presetLabels[defaultPresetId]?.name ?? defaultPresetId}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset layout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restore the panel layout to the default preset.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </SettingSection>

      <StatusbarSettings />
    </div>
  );
}
