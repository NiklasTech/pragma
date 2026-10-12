"use client";

import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";

import { skillFormat } from "./paths";
import type { Skill } from "./types";

interface SkillListProps {
  skills: Skill[];
  isEnabled: (skill: Skill) => boolean;
  onToggle: (skill: Skill, enabled: boolean) => void;
  /** Shows a Convert to SKILL.md action on single-file skills. */
  onConvert?: (skill: Skill) => void;
}

export function SkillList({ skills, isEnabled, onToggle, onConvert }: SkillListProps) {
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
        <div key={skill.path} className="flex items-start gap-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-ui-sm font-medium text-fg-default">{skill.name}</span>
            {skill.description && (
              <span className="text-ui-xs text-fg-muted">{skill.description}</span>
            )}
            {skill.error && <span className="text-ui-xs text-status-error">{skill.error}</span>}
            {onConvert && skillFormat(skill.id, skill.path) === "legacy" && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="mt-1 self-start"
                onClick={() => onConvert(skill)}
              >
                Convert to SKILL.md
              </Button>
            )}
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
