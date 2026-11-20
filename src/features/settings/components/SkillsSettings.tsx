"use client";

import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { convertSkill } from "@/features/ai/skills/convertSkill";
import { copySkill } from "@/features/ai/skills/copySkill";
import { SkillList } from "@/features/ai/skills/SkillList";
import { skillUsers } from "@/features/ai/skills/skillUsers";
import { useSkillsStore } from "@/features/ai/skills/store";
import { useCreateSkill } from "@/features/ai/skills/useCreateSkill";
import { useWorkspaceSkills } from "@/features/ai/skills/useWorkspaceSkills";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";
import { SettingSection } from "./ui/SettingSection";

export function SkillsSettings() {
  const skills = useWorkspaceSkills();
  const setWorkspaceEnabled = useSkillsStore((state) => state.setWorkspaceEnabled);
  const { canCreate, creating, createSkill } = useCreateSkill();
  const syncTargets = useWorkspaceSettingsStore((state) => state.settings?.cliSync?.targets);

  return (
    <SettingSection
      title="Skills"
      badge={skills.length > 0 ? { label: String(skills.length) } : undefined}
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
      <p className="py-2.5 text-[12.5px] leading-relaxed text-fg-muted">
        The CLIs in the &quot;used by&quot; column read a skill from its folder themselves. The
        switch lists it in the prompt of Pragma sessions without a named agent; skills from CLI
        folders start off.
      </p>
      <SkillList
        skills={skills}
        isEnabled={(skill) => skill.enabled}
        usedBy={(skill) => skillUsers(skill, syncTargets)}
        onToggle={(skill, enabled) =>
          void setWorkspaceEnabled(skill, enabled).catch((err: unknown) => toast.error(String(err)))
        }
        onConvert={(skill) =>
          void convertSkill(skill).catch((err: unknown) => toast.error(String(err)))
        }
        onCopyToPragma={(skill) =>
          void copySkill(skill).catch((err: unknown) => toast.error(String(err)))
        }
      />
    </SettingSection>
  );
}
