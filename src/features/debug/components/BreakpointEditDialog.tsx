import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useBreakpointEditorStore } from "../breakpointEditor";
import type { BreakpointSettings } from "../breakpointSettings";
import { useDebugStore } from "../store";

const FIELDS: Array<{
  key: keyof BreakpointSettings;
  label: string;
  placeholder: string;
}> = [
  { key: "condition", label: "Condition", placeholder: "Break when the expression is true" },
  {
    key: "hitCondition",
    label: "Hit count",
    placeholder: "Break when the hit count is met, e.g. 5",
  },
  {
    key: "logMessage",
    label: "Log message",
    placeholder: "Log instead of breaking, e.g. value is {value}",
  },
];

export function BreakpointEditDialog() {
  const target = useBreakpointEditorStore((state) => state.target);
  const closeEditor = useBreakpointEditorStore((state) => state.closeEditor);
  const [settings, setSettings] = useState<BreakpointSettings>({});

  const hasBreakpoint = useDebugStore((state) =>
    target ? (state.breakpoints[target.file]?.includes(target.line) ?? false) : false,
  );

  useEffect(() => {
    if (!target) return;
    const current = useDebugStore.getState().breakpointSettings[target.file]?.[target.line];
    setSettings(current ?? {});
  }, [target]);

  const save = () => {
    if (!target) return;
    useDebugStore.getState().setBreakpointSettings(target.file, target.line, settings);
    closeEditor();
  };

  const remove = () => {
    if (!target) return;
    useDebugStore.getState().toggleBreakpoint(target.file, target.line);
    closeEditor();
  };

  const fileName = target ? (target.file.split(/[\\/]/).pop() ?? target.file) : "";

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasBreakpoint ? "Edit Breakpoint" : "Add Breakpoint"}</DialogTitle>
          <DialogDescription>
            {fileName}:{target?.line}. A log message turns the breakpoint into a logpoint that does
            not pause.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {FIELDS.map((field, index) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`breakpoint-${field.key}`}>{field.label}</Label>
              <Input
                id={`breakpoint-${field.key}`}
                autoFocus={index === 0}
                value={settings[field.key] ?? ""}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
                placeholder={field.placeholder}
              />
            </div>
          ))}
          <DialogFooter className="mt-4">
            {hasBreakpoint && (
              <Button type="button" variant="outline" onClick={remove}>
                Remove
              </Button>
            )}
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button type="submit">{hasBreakpoint ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
