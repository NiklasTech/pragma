"use client";

import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { SkillList } from "@/features/ai/skills/SkillList";
import { useSkillsStore } from "@/features/ai/skills/store";
import { useCreateSkill } from "@/features/ai/skills/useCreateSkill";
import { useWorkspaceSkills } from "@/features/ai/skills/useWorkspaceSkills";
import { SettingSection } from "./ui/SettingSection";

export function SkillsSettings() {
  const skills = useWorkspaceSkills();
  const setWorkspaceEnabled = useSkillsStore((state) => state.setWorkspaceEnabled);
  const { canCreate, creating, createSkill } = useCreateSkill();

  return (
    <SettingSection
      title="Skills"
      action={
        <Button
          size="sm"
          variant="outline"
          disabled={!canCreate || creating}
          onClick={() => void createSkill()}
        >
          <Plus size={13} />
          New skill
        </Button>
      }
    >
      <p className="py-3 text-ui-xs text-fg-muted">
        Enabled skills are listed in the prompt of sessions without a named agent.
      </p>
      <SkillList
        skills={skills}
        isEnabled={(skill) => skill.enabled}
        onToggle={(skill, enabled) =>
          void setWorkspaceEnabled(skill, enabled).catch((err: unknown) => toast.error(String(err)))
        }
      />
    </SettingSection>
  );
}
