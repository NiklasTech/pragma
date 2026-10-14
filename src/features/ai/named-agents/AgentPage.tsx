"use client";

import { useState } from "react";
import { ChatCircle, Export, PencilSimple, Plus, Robot, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useRepositorySessions } from "@/features/ai/sessions/repositorySessions";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { outsideChildren, releaseChildren } from "@/features/ai/children/release";

import { seededAccent } from "../panes/providerAccent";
import { AgentFoldersTab } from "./AgentFoldersTab";
import { AgentMemoryTab } from "./AgentMemoryTab";
import { AgentSkillsTab } from "./AgentSkillsTab";
import { DeleteAgentDialog } from "./DeleteAgentDialog";
import { engineLabel } from "./AgentEnginePicker";
import { agentOriginLabel, agentScope, SCOPE_LABELS } from "./scope";
import { useNamedAgentsStore } from "./store";
import { exportAgent, exportAgentMarkdown } from "./transferActions";
import type { Agent, AgentScope } from "./types";
import { useNamedAgentsUiStore } from "./ui";

type AgentTab = "brief" | "memory" | "skills" | "folders";

const TABS: Array<{ id: AgentTab; label: string; editable?: boolean }> = [
  { id: "brief", label: "Brief" },
  { id: "memory", label: "Memory" },
  { id: "skills", label: "Skills", editable: true },
  { id: "folders", label: "Folders", editable: true },
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
  const copyAgent = useNamedAgentsStore((state) => state.copyAgent);
  const copyCliAgent = useNamedAgentsStore((state) => state.copyCliAgent);
  const chatSessions = useRepositorySessions();
  const cliManifests = useAIStore((state) => state.cliManifests);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

  const chatCount = chatSessions.filter((session) => session.agentId === agent.id).length;
  const ownedIds = chatSessions
    .filter((session) => session.agentId === agent.id && !session.archived)
    .map((session) => session.id);
  const childCount = outsideChildren(chatSessions, ownedIds).length;
  const cliName =
    cliManifests.find((manifest) => manifest.id === agent.engine.cliProviderId)?.name ?? null;
  const scope = agentScope(agent);
  const copyTarget: AgentScope = scope === "project" ? "personal" : "project";
  const readOnly = Boolean(agent.source);
  const tabs = TABS.filter((item) => !readOnly || !item.editable);
  const activeTab = tabs.some((item) => item.id === tab) ? tab : "brief";

  const handleFolders = (folders: string[]) => {
    void saveAgent({ ...agent, folders, updatedAt: Date.now() }).catch(() =>
      toast.error("Could not save folders"),
    );
  };

  const handleCopy = () => {
    void copyAgent(agent, copyTarget)
      .then(({ agent: copy, droppedFolders }) => {
        toast.success(`Copied ${agent.name} to ${SCOPE_LABELS[copyTarget].toLowerCase()} agents`, {
          description:
            droppedFolders > 0 ? "Folders outside the workspace were not copied." : undefined,
        });
        useNamedAgentsUiStore.getState().selectAgent(copy.id);
      })
      .catch((err: unknown) =>
        toast.error("Could not copy the agent", { description: String(err) }),
      );
  };

  const handleCopyToPragma = () => {
    void copyCliAgent(agent)
      .then((copy) => {
        toast.success(`Copied ${agent.name} to .pragma/agents`);
        useNamedAgentsUiStore.getState().selectAgent(copy.id);
      })
      .catch((err: unknown) =>
        toast.error("Could not copy the agent", { description: String(err) }),
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
              {`${agentOriginLabel(agent)} - ${engineLabel(agent.engine, cliName)}`}
            </span>
          </div>
          <span className="flex-1" />
          {!readOnly && (
            <button
              type="button"
              aria-label="Delete agent"
              title="Delete agent"
              onClick={() => setConfirmingDelete(true)}
              className="flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-status-error"
            >
              <Trash size={14} />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Export or copy agent"
                  title="Export or copy agent"
                  className="flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
                />
              }
            >
              <Export size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={() => void exportAgent(agent, false)}>
                Export
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={agent.memory.length === 0}
                onClick={() => void exportAgent(agent, true)}
              >
                Export with memory
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportAgentMarkdown(agent)}>
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {readOnly ? (
                <DropdownMenuItem onClick={handleCopyToPragma}>Copy to .pragma</DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={copyTarget === "project" && rootPath === "default"}
                  onClick={handleCopy}
                >
                  {copyTarget === "project" ? "Copy to project" : "Copy to personal agents"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <PencilSimple size={13} />
              Edit
            </Button>
          )}
          <Button type="button" size="sm" onClick={onNewChat}>
            <Plus size={13} />
            New chat
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(value: AgentTab) => setTab(value)}>
          <TabsList variant="line">
            {tabs.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="px-2.5">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "brief" ? (
          <div className="p-4">
            <p className="text-ui-sm whitespace-pre-wrap text-fg-default">{agent.brief}</p>
          </div>
        ) : activeTab === "memory" ? (
          <AgentMemoryTab agentId={agent.id} memory={agent.memory} />
        ) : activeTab === "skills" ? (
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
