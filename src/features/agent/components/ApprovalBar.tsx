import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";

import { allowsEnterToApprove } from "./approvalKeys";

const EXIT_MS = 140;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

function canAnimate(): boolean {
  return (
    typeof Element.prototype.animate === "function" &&
    !document.documentElement.hasAttribute("data-reduce-motion") &&
    !(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
  );
}

interface ApprovalBarProps {
  /** The question, for example "Claude Code asks for permission". */
  title: string;
  /** What it wants to do: a command, a path or a tool title. */
  request: string;
  description?: string;
  /** Label of the "always allow" choice; the button shows only when the agent offers it. */
  alwaysLabel?: string;
  /** Only the first open request in a pane answers Enter. */
  takesEnter?: boolean;
  /** What the request would change, e.g. the diff of an edit, shown under the bar's line. */
  details?: ReactNode;
  onDeny: () => void;
  onAllow: () => void;
  onAllowAlways?: () => void;
}

/// One pending permission request at the bottom of an agent pane.
export function ApprovalBar({
  title,
  request,
  description,
  alwaysLabel,
  takesEnter = false,
  details,
  onDeny,
  onAllow,
  onAllowAlways,
}: ApprovalBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);

  const answer = (action: () => void) => {
    if (leaving) return;
    setLeaving(true);
    const bar = ref.current;
    if (!bar || !canAnimate()) {
      action();
      return;
    }
    bar.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(6px)" },
      ],
      { duration: EXIT_MS, easing: EASING, fill: "forwards" },
    );
    // A timer, not the animation, sends the answer, so a re-render cannot swallow it.
    window.setTimeout(action, EXIT_MS);
  };

  const allowRef = useRef(() => answer(onAllow));
  allowRef.current = () => answer(onAllow);

  useEffect(() => {
    if (!takesEnter) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!allowsEnterToApprove(event, ref.current)) return;
      event.preventDefault();
      event.stopPropagation();
      allowRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [takesEnter]);

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Permission request"
      // Answering from a pane in the background must not first swap it for the focused view.
      onPointerDown={(event) => event.stopPropagation()}
      className="mb-2 flex animate-in flex-wrap items-center gap-x-2.5 gap-y-2 rounded-well bg-bg-sheet py-2.5 pr-2.5 pl-3.5 ring-1 ring-state-needs-you/40 duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ring-inset fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      <span className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
        <span className="text-ui-sm font-medium text-fg-default">{title}</span>
        <code className="truncate font-mono text-ui-xs text-state-needs-you" title={request}>
          {request}
        </code>
        {description && (
          <span className="truncate text-ui-xs text-fg-muted" title={description}>
            {description}
          </span>
        )}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => answer(onDeny)}>
          Deny
        </Button>
        {alwaysLabel && onAllowAlways && (
          <Button variant="secondary" size="sm" onClick={() => answer(onAllowAlways)}>
            {alwaysLabel}
          </Button>
        )}
        <Button size="sm" onClick={() => answer(onAllow)}>
          Allow
          {takesEnter && (
            <Kbd className="border-0 bg-black/10 text-primary-foreground/70" aria-hidden="true">
              ⏎
            </Kbd>
          )}
        </Button>
      </span>
      {details && <div className="max-h-64 w-full overflow-y-auto">{details}</div>}
    </div>
  );
}
