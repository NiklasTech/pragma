import {
  PRAGMA_MARK_CELLS,
  PRAGMA_MARK_KEY,
  PRAGMA_MARK_SMALL_RINGS,
} from "@/shared/lib/pragma-mark-paths";
import { cn } from "@/shared/lib/utils";

interface PragmaMarkProps {
  className?: string;
  variant?: "full" | "compact";
  animation?: "none" | "intro" | "thinking";
  title?: string;
}

export function PragmaMark({
  className,
  variant = "full",
  animation = "none",
  title,
}: PragmaMarkProps) {
  const isIntro = animation === "intro";
  const isThinking = animation === "thinking";

  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <g
        className={cn(
          "[transform-box:view-box] [transform-origin:128px_128px]",
          isThinking && "animate-thinking motion-reduce:animate-none",
        )}
      >
        {variant === "compact" ? (
          <path d={PRAGMA_MARK_SMALL_RINGS} className="fill-current" />
        ) : (
          PRAGMA_MARK_CELLS.map((cell) => (
            <path
              key={cell.d}
              d={cell.d}
              className={cn(
                "origin-center fill-current [transform-box:fill-box]",
                isIntro && "animate-intro-cell motion-reduce:animate-none",
              )}
              style={isIntro ? { animationDelay: `${cell.step * 130}ms` } : undefined}
            />
          ))
        )}
        <path
          d={PRAGMA_MARK_KEY}
          className={cn(
            "origin-center fill-brand-key [transform-box:fill-box] dark:fill-brand-key-bright",
            isIntro && "animate-intro-key motion-reduce:animate-none",
            isThinking && "animate-thinking-key motion-reduce:animate-none",
          )}
        />
      </g>
    </svg>
  );
}
