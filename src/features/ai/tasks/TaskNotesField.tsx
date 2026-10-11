"use client";

import { useEffect, useState } from "react";

import { MessageResponse } from "@/features/ai/components/Message";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";

import { TASK_NOTES_MAX } from "./validation";

type NotesMode = "preview" | "edit";

const initialMode = (notes: string): NotesMode => (notes.trim() ? "preview" : "edit");

interface TaskNotesFieldProps {
  open: boolean;
  initialNotes: string;
  notes: string;
  onChange: (notes: string) => void;
}

export function TaskNotesField({ open, initialNotes, notes, onChange }: TaskNotesFieldProps) {
  const [mode, setMode] = useState<NotesMode>(() => initialMode(initialNotes));

  useEffect(() => {
    if (open) setMode(initialMode(initialNotes));
  }, [open, initialNotes]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ui-xs font-medium text-fg-muted">Notes</span>
        <Tabs
          value={mode}
          onValueChange={(value) => {
            if (value === "preview" || value === "edit") setMode(value);
          }}
        >
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {mode === "edit" ? (
        <Textarea
          aria-label="Notes"
          value={notes}
          onChange={(event) => onChange(event.target.value)}
          maxLength={TASK_NOTES_MAX}
          rows={5}
          placeholder="Details, constraints, links"
          className="max-h-64 overflow-y-auto text-ui-sm"
        />
      ) : (
        <div className="max-h-64 min-h-16 overflow-y-auto rounded-lg border border-border bg-bg-input px-3 py-2">
          {notes.trim() ? (
            <MessageResponse>{notes}</MessageResponse>
          ) : (
            <p className="text-ui-sm text-fg-subtle">No notes</p>
          )}
        </div>
      )}
    </div>
  );
}
