"use client";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cliFolderLabel } from "@/features/ai/cli-folders/sources";
import { Switch } from "@/shared/components/ui/switch";

import { skillFormat } from "./paths";
import type { Skill } from "./types";

interface SkillListProps {
  skills: Skill[];
  isEnabled: (skill: Skill) => boolean;
  onToggle: (skill: Skill, enabled: boolean) => void;
  /** Shows a Convert to SKILL.md action on single-file skills. */
  onConvert?: (skill: Skill) => void;
  /** Shows a Copy to .pragma action on valid skills read from a coding CLI folder. */
  onCopyToPragma?: (skill: Skill) => void;
}

export function SkillList({
  skills,
  isEnabled,
  onToggle,
  onConvert,
  onCopyToPragma,
}: SkillListProps) {
  if (skills.length === 0) {
    return (
      <p className="py-3 text-ui-xs text-fg-subtle">
        No skills in this workspace. Skills live in .pragma/skills and in the skill folders of
        coding CLIs such as .claude/skills or .agents/skills.
      </p>
    );
  }

  return (
    <>
      {skills.map((skill) => (
        <div key={skill.path} className="flex items-start gap-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-ui-sm font-medium text-fg-default">{skill.name}</span>
              {skill.source && (
                <Badge variant="secondary" title={skill.path}>
                  {cliFolderLabel(skill.source)}
                </Badge>
              )}
            </span>
            {skill.description && (
              <span className="text-ui-xs text-fg-muted">{skill.description}</span>
            )}
            {skill.error && <span className="text-ui-xs text-status-error">{skill.error}</span>}
            {onConvert && !skill.source && skillFormat(skill.id, skill.path) === "legacy" && (
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
            {onCopyToPragma && skill.source && skill.error === null && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="mt-1 self-start"
                onClick={() => onCopyToPragma(skill)}
              >
                Copy to .pragma
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
