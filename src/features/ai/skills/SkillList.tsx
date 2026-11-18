"use client";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";
import { STATE_CELL_CLASSES } from "@/shell/chrome/SessionMark";

import { skillFormat } from "./paths";
import { skillFolder, type SkillUser } from "./skillUsers";
import type { Skill } from "./types";

interface SkillListProps {
  skills: Skill[];
  isEnabled: (skill: Skill) => boolean;
  onToggle: (skill: Skill, enabled: boolean) => void;
  /** Shows a Convert to SKILL.md action on single-file skills. */
  onConvert?: (skill: Skill) => void;
  /** Shows a Copy to .pragma action on valid skills read from a coding CLI folder. */
  onCopyToPragma?: (skill: Skill) => void;
  /** Adds a "used by" column with the marks of the coding CLIs that read each skill. */
  usedBy?: (skill: Skill) => SkillUser[];
}

const GRID = "grid items-center gap-3";
const COLUMNS = "grid-cols-[10px_minmax(0,1fr)_8.5rem_auto]";
const COLUMNS_USED_BY = "grid-cols-[10px_minmax(0,1fr)_8.5rem_minmax(4.5rem,auto)_auto]";

/// Skills as D rows: a green or red cell, name and description or error, the folder, the CLIs
/// that read it and the switch.
export function SkillList({
  skills,
  isEnabled,
  onToggle,
  onConvert,
  onCopyToPragma,
  usedBy,
}: SkillListProps) {
  if (skills.length === 0) {
    return (
      <p className="py-3 text-[12.5px] text-fg-subtle">
        No skills in this workspace. Skills live in .pragma/skills and in the skill folders of
        coding CLIs such as .claude/skills or .agents/skills.
      </p>
    );
  }

  const columns = usedBy ? COLUMNS_USED_BY : COLUMNS;

  return (
    <div className="flex flex-col">
      <div className={cn(GRID, columns, "pt-1 pb-1 font-mono text-[10px] text-fg-subtle")}>
        <span />
        <span>skill</span>
        <span>folder</span>
        {usedBy && <span>used by</span>}
        <span />
      </div>
      {skills.map((skill) => {
        const users = usedBy?.(skill) ?? [];
        const legacy = !skill.source && skillFormat(skill.id, skill.path) === "legacy";
        return (
          <div
            key={skill.path}
            className={cn(GRID, columns, "min-h-11 border-t border-border-subtle py-1.5")}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2 justify-self-center rounded-[1.5px]",
                skill.error ? "bg-status-error" : STATE_CELL_CLASSES.done,
              )}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-mono text-[12.5px] font-medium text-fg-default">
                {skill.name}
              </span>
              {skill.error ? (
                <span className="font-mono text-[11px] break-words text-status-error">
                  {skill.error}
                </span>
              ) : (
                skill.description && (
                  <span className="truncate font-mono text-[11px] text-fg-subtle">
                    {skill.description}
                  </span>
                )
              )}
              {((onConvert && legacy) ||
                (onCopyToPragma && skill.source && skill.error === null)) && (
                <span className="flex gap-1.5 pt-1">
                  {onConvert && legacy && (
                    <Button variant="outline" size="xs" onClick={() => onConvert(skill)}>
                      Convert to SKILL.md
                    </Button>
                  )}
                  {onCopyToPragma && skill.source && skill.error === null && (
                    <Button variant="outline" size="xs" onClick={() => onCopyToPragma(skill)}>
                      Copy to .pragma
                    </Button>
                  )}
                </span>
              )}
            </span>
            <span
              title={skill.path}
              className={cn(
                "truncate font-mono text-[11.5px]",
                skill.error ? "text-status-error" : "text-fg-muted",
              )}
            >
              {skillFolder(skill)}
            </span>
            {usedBy && (
              <span className="flex items-center gap-1">
                {users.length === 0 ? (
                  <span className="font-mono text-[11px] text-fg-subtle">–</span>
                ) : (
                  users.map((user) => (
                    <AgentMark key={user.manifestId} agentId={user.manifestId} name={user.name} />
                  ))
                )}
              </span>
            )}
            <span className="flex justify-end">
              <Switch
                aria-label={`Enable ${skill.name}`}
                checked={skill.error === null && isEnabled(skill)}
                disabled={skill.error !== null}
                onCheckedChange={(value) => onToggle(skill, value)}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
