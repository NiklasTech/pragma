"use client";

import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";

import { WEEKDAYS, formatTime, nextRunAt, parseTime } from "./schedule";
import type { TaskSchedule } from "./types";

const NONE = "none";

const FREQUENCY_LABELS: Record<string, string> = {
  [NONE]: "No schedule",
  daily: "Daily",
  weekly: "Weekly",
};

interface TaskScheduleFieldsProps {
  schedule: TaskSchedule | undefined;
  onChange: (schedule: TaskSchedule | undefined) => void;
}

/// Daily or weekly local start time; a scheduled run starts in its own worktree while Pragma is open.
export function TaskScheduleFields({ schedule, onChange }: TaskScheduleFieldsProps) {
  const setFrequency = (value: unknown) => {
    if (value === "daily")
      onChange({ ...(schedule ?? { hour: 9, minute: 0 }), frequency: "daily", weekday: undefined });
    else if (value === "weekly") {
      onChange({
        ...(schedule ?? { hour: 9, minute: 0 }),
        frequency: "weekly",
        weekday: schedule?.weekday ?? 1,
      });
    } else if (value === NONE) onChange(undefined);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ui-xs font-medium text-fg-muted">Schedule</span>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={schedule?.frequency ?? NONE} onValueChange={setFrequency}>
          <SelectTrigger aria-label="Schedule" className="w-36">
            <SelectValue>{FREQUENCY_LABELS[schedule?.frequency ?? NONE]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {schedule?.frequency === "weekly" && (
          <Select
            value={String(schedule.weekday ?? 1)}
            onValueChange={(value) => onChange({ ...schedule, weekday: Number(value) })}
          >
            <SelectTrigger aria-label="Weekday" className="w-36">
              <SelectValue>{WEEKDAYS[schedule.weekday ?? 1]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((day, index) => (
                <SelectItem key={day} value={String(index)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {schedule && (
          <>
            <Input
              type="time"
              aria-label="Start time"
              value={formatTime(schedule.hour, schedule.minute)}
              onChange={(event) => {
                const time = parseTime(event.target.value);
                if (time) onChange({ ...schedule, ...time });
              }}
              className="w-28 text-ui-sm"
            />
            <label className="flex items-center gap-1.5 text-ui-xs text-fg-muted">
              <Switch
                checked={schedule.paused === true}
                onCheckedChange={(paused) => onChange({ ...schedule, paused: paused || undefined })}
              />
              Paused
            </label>
          </>
        )}
      </div>
      {schedule && !schedule.paused && (
        <span className="text-ui-2xs text-fg-subtle">
          Next run {new Date(nextRunAt(schedule, Date.now())).toLocaleString()}, in a new worktree
          session while Pragma is open.
        </span>
      )}
    </div>
  );
}
