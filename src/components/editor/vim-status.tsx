interface VimStatusProps {
  mode: string | null;
}

export function VimStatus({ mode }: VimStatusProps) {
  if (!mode) return null;

  const label = mode.toUpperCase();
  const colorClass =
    mode === "insert"
      ? "text-blue-400"
      : mode === "replace"
        ? "text-orange-400"
        : mode.startsWith("visual")
          ? "text-purple-400"
          : "text-green-400";

  return (
    <div className="flex items-center gap-2 px-3 py-1 text-xs font-medium border-t border-border bg-muted select-none">
      <span className={colorClass}>{label}</span>
    </div>
  );
}
