"use client";

import { useState } from "react";
import { ChatCircle, PencilSimple, Plus, Robot, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { outsideChildren, releaseChildren } from "@/features/ai/children/release";

import { seededAccent } from "../panes/providerAccent";
import { AgentFoldersTab } from "./AgentFoldersTab";
import { AgentMemoryTab } from "./AgentMemoryTab";
import { AgentSkillsTab } from "./AgentSkillsTab";
import { DeleteAgentDialog } from "./DeleteAgentDialog";
import { engineLabel } from "./AgentEnginePicker";
import { useNamedAgentsStore } from "./store";
import type { Agent } from "./types";

type AgentTab = "brief" | "memory" | "skills" | "folders";

const TABS: Array<{ id: AgentTab; label: string }> = [
  { id: "brief", label: "Brief" },
  { id: "memory", label: "Memory" },
  { id: "skills", label: "Skills" },
  { id: "folders", label: "Folders" },
];

interface AgentPageProps {
  agent: Agent;
  onNewChat: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}

export function AgentPage({ agent, onNewChat, onEdit, onDeleted }: AgentPageProps) {
  const [tab, setTab] = useState<AgentTab>("brief");
  const accent = seededAccent(agent.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const saveAgent = useNamedAgentsStore((state) => state.saveAgent);
  const deleteAgent = useNamedAgentsStore((state) => state.deleteAgent);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const cliManifests = useAIStore((state) => state.cliManifests);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

  const chatCount = chatSessions.filter((session) => session.agentId === agent.id).length;
  const ownedIds = chatSessions
    .filter((session) => session.agentId === agent.id && !session.archived)
    .map((session) => session.id);
  const childCount = outsideChildren(chatSessions, ownedIds).length;
  const cliName =
    cliManifests.find((manifest) => manifest.id === agent.engine.cliProviderId)?.name ?? null;

  const handleFolders = (folders: string[]) => {
    void saveAgent({ ...agent, folders, updatedAt: Date.now() }).catch(() =>
      toast.error("Could not save folders"),
    );
  };

  const handleDelete = (archiveChildren: boolean) => {
    setConfirmingDelete(false);
    void deleteAgent(rootPath, agent.id)
      .then(() => releaseChildren(rootPath, ownedIds, archiveChildren))
      .then(onDeleted)
      .catch(() => toast.error("Could not delete the agent"));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex shrink-0 animate-in flex-col gap-2 border-b border-border-subtle bg-linear-to-r to-transparent to-50% px-4 py-3 duration-200 fade-in-0",
          accent.tint,
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              accent.soft,
              accent.text,
            )}
          >
            <Robot size={18} weight="fill" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-ui-md font-semibold text-fg-default">{agent.name}</h2>
            <span className="truncate text-ui-xs text-fg-subtle">
              {engineLabel(agent.engine, cliName)}
            </span>
          </div>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Delete agent"
            title="Delete agent"
            onClick={() => setConfirmingDelete(true)}
            className="flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-status-error"
          >
            <Trash size={14} />
          </button>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <PencilSimple size={13} />
            Edit
          </Button>
          <Button type="button" size="sm" onClick={onNewChat}>
            <Plus size={13} />
            New chat
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(value: AgentTab) => setTab(value)}>
          <TabsList variant="line">
            {TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="px-2.5">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "brief" ? (
          <div className="p-4">
            <p className="text-ui-sm whitespace-pre-wrap text-fg-default">{agent.brief}</p>
          </div>
        ) : tab === "memory" ? (
          <AgentMemoryTab agentId={agent.id} memory={agent.memory} />
        ) : tab === "skills" ? (
          <AgentSkillsTab agent={agent} />
        ) : (
          <AgentFoldersTab folders={agent.folders} onChange={handleFolders} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle px-4 py-2 text-ui-2xs text-fg-subtle">
        <ChatCircle size={12} />
        {`${agent.memory.length} memory entries`}
      </div>

      <DeleteAgentDialog
        agent={agent}
        chatCount={chatCount}
        childCount={childCount}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onConfirm={handleDelete}
      />
    </div>
  );
}
