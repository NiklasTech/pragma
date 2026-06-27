"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, ArrowCounterClockwise, Warning } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Kbd, KbdGroup } from "@/shared/components/ui/kbd";
import {
  findConflictingAction,
  formatShortcut,
  getDefaultShortcuts,
  getIsMac,
  isConflict,
  isModifierKey,
  isValidBinding,
  SHORTCUT_ACTIONS,
  type ShortcutActionCategory,
  type ShortcutActionId,
  type ShortcutBinding,
} from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";

const CATEGORY_TITLES: Record<ShortcutActionCategory, string> = {
  file: "File",
  edit: "Edit",
  view: "View",
  search: "Search",
  ai: "AI",
  chat: "Chat",
};

interface RecorderDialogProps {
  actionId: ShortcutActionId;
  actionLabel: string;
  currentBinding: ShortcutBinding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (binding: ShortcutBinding | null) => void;
}

function RecorderDialog({
  actionId,
  actionLabel,
  currentBinding,
  open,
  onOpenChange,
  onSave,
}: RecorderDialogProps) {
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const [captured, setCaptured] = useState<ShortcutBinding | null>(null);
  const isMac = getIsMac();

  useEffect(() => {
    if (!open) {
      setCaptured(null);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }

      if (isModifierKey(event.key)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const binding: ShortcutBinding = {
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
      };

      if (event.key.length > 1) {
        binding.key = event.key;
      } else {
        binding.code = event.code;
      }

      setCaptured(binding);
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, onOpenChange]);

  const conflict = useMemo(() => {
    if (!captured) return null;
    const conflictId = findConflictingAction(actionId, captured, shortcuts);
    if (!conflictId) return null;
    return SHORTCUT_ACTIONS.find((a) => a.id === conflictId)?.label ?? conflictId;
  }, [actionId, captured, shortcuts]);

  const valid = captured ? isValidBinding(captured) : false;
  const displayBinding = captured ?? currentBinding;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record shortcut</DialogTitle>
          <DialogDescription>
            Press the keys for <strong>{actionLabel}</strong>. Escape cancels.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex min-h-[48px] items-center justify-center rounded-md border border-border/60 bg-bg-hover px-4 py-2 font-mono text-ui-base">
            {displayBinding ? formatShortcut(displayBinding, isMac) : "Press a shortcut..."}
          </div>

          {conflict && (
            <div className="flex items-center gap-2 text-ui-xs text-status-error">
              <Warning size={14} />
              <span>Conflicts with: {conflict}</span>
            </div>
          )}

          {!captured && !currentBinding && (
            <p className="text-ui-xs text-fg-muted">This action has no shortcut.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onSave(null);
              onOpenChange(false);
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            disabled={!valid || Boolean(conflict)}
            onClick={() => {
              if (captured) {
                onSave(captured);
                onOpenChange(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KeyboardSettings() {
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const setShortcut = useSettingsStore((state) => state.setShortcut);
  const resetShortcut = useSettingsStore((state) => state.resetShortcut);
  const resetAllShortcuts = useSettingsStore((state) => state.resetAllShortcuts);
  const isMac = getIsMac();
  const defaults = useMemo(() => getDefaultShortcuts(isMac), [isMac]);

  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<ShortcutActionCategory, typeof SHORTCUT_ACTIONS>();
    for (const action of SHORTCUT_ACTIONS) {
      const list = map.get(action.category) ?? [];
      list.push(action);
      map.set(action.category, list);
    }
    return map;
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-ui-sm text-fg-muted">Shortcuts are active immediately after saving.</p>
        <Button variant="outline" size="sm" onClick={resetAllShortcuts}>
          Reset all
        </Button>
      </div>

      {Array.from(grouped.entries()).map(([category, actions]) => (
        <SettingSection key={category} title={CATEGORY_TITLES[category]}>
          {actions.map((action) => {
            const binding = shortcuts[action.id];
            const isDefault =
              binding === null
                ? defaults[action.id] === null
                : isConflict(binding, defaults[action.id]);

            return (
              <SettingRow
                key={action.id}
                label={action.label}
                control={
                  <div className="flex items-center gap-2">
                    <KbdGroup>
                      <Kbd>{formatShortcut(binding, isMac)}</Kbd>
                    </KbdGroup>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setRecordingId(action.id)}
                      aria-label={`Change shortcut for ${action.label}`}
                    >
                      <Pencil size={14} />
                    </Button>
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => resetShortcut(action.id)}
                        aria-label={`Reset shortcut for ${action.label}`}
                      >
                        <ArrowCounterClockwise size={14} />
                      </Button>
                    )}
                  </div>
                }
              />
            );
          })}
        </SettingSection>
      ))}

      {recordingId && (
        <RecorderDialog
          actionId={recordingId}
          actionLabel={SHORTCUT_ACTIONS.find((a) => a.id === recordingId)?.label ?? recordingId}
          currentBinding={shortcuts[recordingId]}
          open
          onOpenChange={(open) => {
            if (!open) setRecordingId(null);
          }}
          onSave={(binding) => setShortcut(recordingId, binding)}
        />
      )}
    </div>
  );
}
