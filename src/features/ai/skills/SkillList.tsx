"use client";

import { Switch } from "@/shared/components/ui/switch";

import type { Skill } from "./types";

interface SkillListProps {
  skills: Skill[];
  isEnabled: (skill: Skill) => boolean;
  onToggle: (skill: Skill, enabled: boolean) => void;
}

export function SkillList({ skills, isEnabled, onToggle }: SkillListProps) {
  if (skills.length === 0) {
    return (
      <p className="py-3 text-ui-xs text-fg-subtle">
        No skills in this workspace. Skills live in .pragma/skills.
      </p>
    );
  }

  return (
    <>
      {skills.map((skill) => (
        <div key={skill.id} className="flex items-start gap-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-ui-sm font-medium text-fg-default">{skill.name}</span>
            {skill.description && (
              <span className="text-ui-xs text-fg-muted">{skill.description}</span>
            )}
            {skill.error && <span className="text-ui-xs text-status-error">{skill.error}</span>}
          </div>
          <Switch
            aria-label={`Enable ${skill.name}`}
            checked={skill.error === null && isEnabled(skill)}
            disabled={skill.error !== null}
            onCheckedChange={(value) => onToggle(skill, value)}
          />
        </div>
      ))}
    </>
  );
}
