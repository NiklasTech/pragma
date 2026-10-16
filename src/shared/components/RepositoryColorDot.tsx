import { useRepositoryColor } from "@/shared/hooks/useRepositoryColors";
import { cn } from "@/shared/lib/utils";

/// A small dot in the repository's color, shown wherever a repository is named.
export function RepositoryColorDot({
  path,
  className,
}: {
  path: string | null;
  className?: string;
}) {
  const color = useRepositoryColor(path);
  if (!color) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
