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
import { aiPlacementOptions, normalizeAIPlacement } from "@/shell/layout/aiPlacement";
import { defaultPresetId, presetLabels } from "@/shell/layout/presets";
import { StatusbarSettings } from "./StatusbarSettings";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export function LayoutSettings() {
  const applyPreset = useLayoutStore((s) => s.applyPreset);
  const aiPlacement = useLayoutStore((s) => s.ai.placement);
  const setAIPlacement = useLayoutStore((s) => s.setAIPlacement);

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
                  <Button variant="destructive" size="sm" className="gap-1">
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

      <SettingSection title="AI Panel">
        <SettingRow
          label="AI position"
          description="Where the AI chat docks and where the AI shortcut restores it."
          control={
            <Select
              value={aiPlacement}
              onValueChange={(value) => setAIPlacement(normalizeAIPlacement(value))}
            >
              <SelectTrigger className="max-w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aiPlacementOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </SettingSection>

      <StatusbarSettings />
    </div>
  );
}
