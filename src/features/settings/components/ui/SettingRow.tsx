"use client";

import { useContext, useId } from "react";

import { Button } from "@/shared/components/ui/button";
import { FieldLabelContext } from "@/shared/components/ui/field-label";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";

import { findSetting, isChanged, resetPatch } from "../../settingChanges";
import { SettingsAreaContext } from "../settingsArea";

interface SettingRowProps {
  label: string;
  description?: React.ReactNode;
  control: React.ReactNode;
  disabled?: boolean;
}

export function SettingRow({ label, description, control, disabled }: SettingRowProps) {
  const area = useContext(SettingsAreaContext);
  const setting = area ? findSetting(label, area) : undefined;
  const changed = useSettingsStore((state) => (setting ? isChanged(setting, state) : false));
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div
      data-setting-row
      data-changed={changed || undefined}
      className={cn(
        "relative flex w-full flex-row items-center justify-between gap-5 py-2.5",
        disabled && "opacity-50",
      )}
    >
      {changed && (
        <span
          aria-hidden="true"
          className="absolute top-[1.05rem] -left-3 size-1.5 rounded-[1px] bg-primary"
        />
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-[13px] font-medium text-fg-default">
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="text-ui-xs leading-snug text-fg-subtle">
            {description}
          </span>
        )}
        {changed && setting && (
          <span className="flex items-center gap-1.5 font-mono text-ui-2xs">
            <span className="text-primary">changed</span>
            <span aria-hidden="true" className="text-fg-subtle">
              ·
            </span>
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Reset ${label} to its default`}
              onClick={() => useSettingsStore.setState((state) => resetPatch(state, setting))}
              className="h-auto px-0 text-ui-2xs text-fg-subtle underline decoration-fg-default/25 underline-offset-2 hover:bg-transparent hover:text-fg-default"
            >
              reset to default
            </Button>
          </span>
        )}
      </div>
      <div className="shrink-0">
        <FieldLabelContext.Provider
          value={{ labelId, descriptionId: description ? descriptionId : undefined }}
        >
          {control}
        </FieldLabelContext.Provider>
      </div>
    </div>
  );
}
