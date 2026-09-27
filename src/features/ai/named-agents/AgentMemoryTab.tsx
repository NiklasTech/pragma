"use client";

import { useCallback, useState } from "react";
import { Check, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";

import { useNamedAgentsStore } from "./store";
import type { AgentMemoryEntry } from "./types";

interface AgentMemoryTabProps {
  agentId: string;
  memory: AgentMemoryEntry[];
}

export function AgentMemoryTab({ agentId, memory }: AgentMemoryTabProps) {
  const updateMemory = useNamedAgentsStore((state) => state.updateMemory);
  const deleteMemory = useNamedAgentsStore((state) => state.deleteMemory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = useCallback((entry: AgentMemoryEntry) => {
    setEditingId(entry.id);
    setDraft(entry.text);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const result = updateMemory(agentId, editingId, draft.trim());
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setEditingId(null);
    setDraft("");
  }, [agentId, draft, editingId, updateMemory]);

  if (memory.length === 0) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center px-6 text-center">
        <p className="text-ui-sm text-fg-subtle">No memory yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {memory.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-surface p-2.5"
        >
          {editingId === entry.id ? (
            <>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                className="text-ui-xs"
              />
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" onClick={commitEdit}>
                  <Check size={13} />
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingId(null);
                    setDraft("");
                  }}
                >
                  <X size={13} />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-ui-xs whitespace-pre-wrap text-fg-default">{entry.text}</p>
              <div className="flex items-center gap-2">
                <span className="text-ui-2xs text-fg-subtle">{entry.source}</span>
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label="Edit memory"
                  title="Edit memory"
                  onClick={() => startEdit(entry)}
                  className="rounded p-0.5 text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
                >
                  <PencilSimple size={12} />
                </button>
                <button
                  type="button"
                  aria-label="Delete memory"
                  title="Delete memory"
                  onClick={() => deleteMemory(agentId, entry.id)}
                  className="rounded p-0.5 text-fg-subtle transition-colors hover:bg-bg-hover hover:text-status-error"
                >
                  <Trash size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
