"use client";

interface ColorSwatchProps {
  color: string;
}

export function ColorSwatch({ color }: ColorSwatchProps) {
  return (
    <span
      className="size-4 rounded-full border border-border-subtle"
      style={{ backgroundColor: color }}
    />
  );
}
