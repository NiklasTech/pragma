"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

/// On, Off, or "Use my setting" to leave the value to each person's own settings; `personal` is this user's value.
export function InheritSelect({
  label,
  value,
  personal,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  personal: boolean;
  onChange: (value: boolean | undefined) => void;
}) {
  const options = [
    { value: "inherit", label: `Use my setting (${personal ? "On" : "Off"})` },
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
  ];
  const current = value === undefined ? "inherit" : value ? "on" : "off";
  return (
    <Select
      value={current}
      onValueChange={(next) => onChange(next === "inherit" ? undefined : next === "on")}
    >
      <SelectTrigger aria-label={label} className="w-44">
        <SelectValue>{options.find((option) => option.value === current)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/// A whole number from 1 to `max`, or undefined for empty or invalid input.
export function parsePositiveInt(raw: string, max: number): number | undefined {
  const value = Number(raw.trim());
  return raw.trim() && Number.isInteger(value) && value >= 1 && value <= max ? value : undefined;
}

/// Comma separated columns from 1 to `max`; undefined when nothing valid is left.
export function parseNumberList(raw: string, max: number): number[] | undefined {
  const values = raw
    .split(",")
    .map((part) => parsePositiveInt(part, max))
    .filter((value): value is number => value !== undefined);
  return values.length > 0 ? [...new Set(values)].slice(0, 10) : undefined;
}
