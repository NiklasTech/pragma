"use client";

import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { SkillList } from "@/features/ai/skills/SkillList";
import { useCreateSkill } from "@/features/ai/skills/useCreateSkill";
import { useWorkspaceSkills } from "@/features/ai/skills/useWorkspaceSkills";

import { useNamedAgentsStore } from "./store";
import type { Agent } from "./types";

interface AgentSkillsTabProps {
  agent: Agent;
}

export function AgentSkillsTab({ agent }: AgentSkillsTabProps) {
  const skills = useWorkspaceSkills();
  const saveAgent = useNamedAgentsStore((state) => state.saveAgent);
  const { canCreate, creating, createSkill } = useCreateSkill();

  const handleToggle = (skillId: string, enabled: boolean) => {
    const others = agent.skills.filter((id) => id !== skillId);
    const next = enabled ? [...others, skillId] : others;
    void saveAgent({ ...agent, skills: next, updatedAt: Date.now() }).catch(() =>
      toast.error("Could not save skills"),
    );
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-ui-xs text-fg-muted">
          Enabled skills are listed in this agent's prompt.
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canCreate || creating}
          onClick={() => void createSkill()}
        >
          <Plus size={13} />
          New skill
        </Button>
      </div>
      <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle bg-bg-surface px-3">
        <SkillList
          skills={skills}
          isEnabled={(skill) => agent.skills.includes(skill.id)}
          onToggle={(skill, enabled) => handleToggle(skill.id, enabled)}
        />
      </div>
    </div>
  );
}
