"use client";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useLayoutStore } from "@/shell/layout";
import { defaultPresetId, presetLabels } from "@/shell/layout/presets";
import { StatusbarSettings } from "./StatusbarSettings";
import { ArrowCounterClockwise } from "@phosphor-icons/react";

export function LayoutSettings() {
  const applyPreset = useLayoutStore((s) => s.applyPreset);

  const handleReset = () => {
    applyPreset(defaultPresetId);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Panels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-ui-xs text-fg-muted">
            Reset the sidebar, terminal and AI panel sizes to the default layout.
          </p>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1 self-start">
            <ArrowCounterClockwise size={14} />
            Reset to {presetLabels[defaultPresetId]?.name ?? defaultPresetId}
          </Button>
        </CardContent>
      </Card>

      <StatusbarSettings />
    </div>
  );
}
