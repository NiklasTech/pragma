import { useEffect, useMemo } from "react";

import type { ChatSession } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAgentStore } from "@/features/agent/store";
import { AGENT_TOOL_DEFINITIONS, buildAgentSystemPrompt } from "@/features/agent/tools";
import { formatRulesForPrompt, loadProjectRules } from "@/features/agent/rules";
import { BROWSER_TOOL_DEFINITIONS } from "@/features/agent/browserTool";
import { INSIGHT_TOOL_DEFINITIONS } from "@/features/agent/insightTools";
import { SPAWN_SESSION_TOOL_DEFINITION } from "@/features/agent/spawnTool";
import { extensionToolDefinitions } from "@/features/extensions/agentTools";
import { useExtensionsStore } from "@/features/extensions/store";
import {
  buildAgentContextBlock,
  composeAgentSystemPrompt,
} from "@/features/ai/named-agents/prompt";
import type { AgentAccess } from "@/features/ai/named-agents/folders";
import type { Agent } from "@/features/ai/named-agents/types";
import { formatSkillCatalog, selectCatalogSkills } from "@/features/ai/skills/catalog";
import { skillsDir } from "@/features/ai/skills/paths";
import { useSkillsStore } from "@/features/ai/skills/store";

interface ChatPromptOptions {
  activeSession: ChatSession | undefined;
  activeAgent: Agent | null;
  cwd: string;
  rootPath: string;
}

export function useChatPrompt({ activeSession, activeAgent, cwd, rootPath }: ChatPromptOptions) {
  const useProjectRules = useSettingsStore((state) => state.agent.useProjectRules);
  const agentModeActive = useAgentStore((state) => state.modeActive);
  const agentActive = agentModeActive;

  const activeSessionKind = activeSession?.kind;
  const extensionTools = useExtensionsStore((state) => state.agentTools);
  const agentToolDefinitions = useMemo(() => {
    if (!agentActive) return [];
    const extensionDefinitions = extensionToolDefinitions(extensionTools);
    return activeSessionKind === "ask"
      ? [...AGENT_TOOL_DEFINITIONS, ...INSIGHT_TOOL_DEFINITIONS, ...extensionDefinitions]
      : [
          ...AGENT_TOOL_DEFINITIONS,
          ...INSIGHT_TOOL_DEFINITIONS,
          SPAWN_SESSION_TOOL_DEFINITION,
          ...BROWSER_TOOL_DEFINITIONS,
          ...extensionDefinitions,
        ];
  }, [agentActive, activeSessionKind, extensionTools]);

  const projectRules = useAgentStore((state) => state.rules);

  useEffect(() => {
    let cancelled = false;
    if (!cwd || cwd === "default") {
      useAgentStore.getState().setRules(null);
      return;
    }
    void loadProjectRules(cwd).then((loaded) => {
      if (!cancelled) useAgentStore.getState().setRules(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [cwd]);

  const workspaceSkills = useSkillsStore((state) => state.skills);

  useEffect(() => {
    void useSkillsStore.getState().loadSkills(rootPath === "default" ? null : rootPath);
  }, [rootPath]);

  const skillsBlock = useMemo(
    () => formatSkillCatalog(selectCatalogSkills(workspaceSkills, activeAgent?.skills ?? null)),
    [activeAgent, workspaceSkills],
  );

  const systemPrompt = useMemo(() => {
    const rules = useProjectRules ? projectRules : null;
    const agentBlock = activeAgent ? buildAgentContextBlock(activeAgent) : null;
    if (agentActive) {
      return composeAgentSystemPrompt(buildAgentSystemPrompt(cwd, rules, agentBlock), skillsBlock);
    }
    return composeAgentSystemPrompt(agentBlock, formatRulesForPrompt(rules), skillsBlock);
  }, [activeAgent, agentActive, cwd, projectRules, skillsBlock, useProjectRules]);

  const leadingSystemMessage = useMemo(() => {
    if (!activeAgent) return null;
    const rules = useProjectRules ? formatRulesForPrompt(projectRules) : null;
    return (
      composeAgentSystemPrompt(buildAgentContextBlock(activeAgent), rules, skillsBlock) ?? null
    );
  }, [activeAgent, projectRules, skillsBlock, useProjectRules]);

  const agentAccess = useMemo<AgentAccess | null>(() => {
    if (!activeAgent) return null;
    // Skill files live in the workspace, which a worktree session's folder does not contain.
    const folders =
      rootPath === "default" ? activeAgent.folders : [...activeAgent.folders, skillsDir(rootPath)];
    return { agentId: activeAgent.id, folders };
  }, [activeAgent, rootPath]);

  return {
    agentActive,
    agentToolDefinitions,
    systemPrompt,
    leadingSystemMessage,
    agentAccess,
  };
}
