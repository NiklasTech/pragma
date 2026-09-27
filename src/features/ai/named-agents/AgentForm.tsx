"use client";

import { useCallback, useMemo, useState } from "react";
import { MagicWand, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAIStore } from "@/shared/stores/ai";

import { AgentEnginePicker } from "./AgentEnginePicker";
import { AgentFoldersTab } from "./AgentFoldersTab";
import { draftAgent } from "./draft";
import { useNamedAgentsStore } from "./store";
import type { Agent, AgentEngine } from "./types";
import {
  AGENT_BRIEF_MAX,
  AGENT_NAME_MAX,
  isAgentBriefValid,
  isAgentNameUnique,
  isAgentNameValid,
} from "./validation";

interface AgentFormProps {
  agent?: Agent;
  onCancel: () => void;
  onSaved: (agent: Agent) => void;
}

export function AgentForm({ agent, onCancel, onSaved }: AgentFormProps) {
  const agents = useNamedAgentsStore((state) => state.agents);
  const saveAgent = useNamedAgentsStore((state) => state.saveAgent);

  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const providers = useAIStore((state) => state.providers);

  const [description, setDescription] = useState("");
  const [name, setName] = useState(agent?.name ?? "");
  const [brief, setBrief] = useState(agent?.brief ?? "");
  const [folders, setFolders] = useState<string[]>(agent?.folders ?? []);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultEngine = useMemo<AgentEngine>(() => {
    const engine: AgentEngine = { kind: "builtin", provider: activeProvider, model: activeModel };
    const baseUrl = providers[activeProvider].baseUrl;
    if (baseUrl) engine.baseUrl = baseUrl;
    return engine;
  }, [activeProvider, activeModel, providers]);

  const [engine, setEngine] = useState<AgentEngine>(agent?.engine ?? defaultEngine);

  const handleDraft = useCallback(async () => {
    const trimmed = description.trim();
    if (!trimmed || !activeModel) {
      toast.error("Describe the agent and pick a model first");
      return;
    }

    setDrafting(true);
    try {
      const drafted = await draftAgent({
        provider: activeProvider,
        model: activeModel,
        baseUrl: providers[activeProvider].baseUrl,
        description: trimmed,
      });
      if (!drafted) {
        toast.error("Could not draft the agent");
        return;
      }
      setName(drafted.name);
      setBrief(drafted.brief);
    } catch {
      toast.error("Could not draft the agent");
    } finally {
      setDrafting(false);
    }
  }, [activeModel, activeProvider, description, providers]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedBrief = brief.trim();

    if (!isAgentNameValid(trimmedName)) {
      setError(`Name must be 1 to ${AGENT_NAME_MAX} characters`);
      return;
    }
    if (!isAgentNameUnique(trimmedName, agents, agent?.id)) {
      setError("An agent with this name already exists");
      return;
    }
    if (!isAgentBriefValid(trimmedBrief)) {
      setError(`Brief must be 1 to ${AGENT_BRIEF_MAX} characters`);
      return;
    }

    setError(null);
    setSaving(true);
    const now = Date.now();
    const saved: Agent = {
      id: agent?.id ?? crypto.randomUUID(),
      name: trimmedName,
      brief: trimmedBrief,
      engine,
      folders,
      memory: agent?.memory ?? [],
      skills: agent?.skills ?? [],
      createdAt: agent?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveAgent(saved);
      onSaved(saved);
    } catch {
      toast.error("Could not save the agent");
    } finally {
      setSaving(false);
    }
  }, [agent, agents, brief, engine, folders, name, onSaved, saveAgent]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-tab shrink-0 items-center gap-2 border-b border-border-subtle px-3">
        <h2 className="text-ui-sm font-semibold text-fg-default">
          {agent ? "Edit agent" : "New agent"}
        </h2>
        <span className="flex-1" />
        <button
          type="button"
          aria-label="Close agent form"
          title="Close"
          onClick={onCancel}
          className="flex size-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-medium text-fg-muted">Describe this agent</span>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="A one-paragraph description used to draft the name and brief."
              className="text-ui-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={drafting || !description.trim()}
              onClick={() => void handleDraft()}
            >
              <MagicWand size={14} />
              {drafting ? "Drafting..." : "Draft with the current model"}
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-medium text-fg-muted">Name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={AGENT_NAME_MAX}
              placeholder="Agent name"
              className="text-ui-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-medium text-fg-muted">Brief</span>
            <Textarea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              maxLength={AGENT_BRIEF_MAX}
              rows={6}
              placeholder="The system instruction for every chat of this agent."
              className="text-ui-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-medium text-fg-muted">Engine</span>
            <AgentEnginePicker value={engine} onChange={setEngine} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-ui-xs font-medium text-fg-muted">Folders</span>
            <div className="rounded-md border border-border-subtle">
              <AgentFoldersTab folders={folders} onChange={setFolders} />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-ui-xs text-status-error">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-subtle px-3 py-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          Save
        </Button>
      </div>
    </div>
  );
}
