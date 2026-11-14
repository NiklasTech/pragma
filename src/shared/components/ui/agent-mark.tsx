import { agentIdentity, type AgentColor } from "@/shared/lib/agentIdentity";
import { cn } from "@/shared/lib/utils";
import { AGENT_STATE_LABELS, StatusDot, type AgentState } from "./status-dot";

const COLOR_CLASSES: Record<AgentColor, string> = {
  claude: "bg-agent-claude",
  codex: "bg-agent-codex",
  gemini: "bg-agent-gemini",
  opencode: "bg-agent-opencode",
  other: "bg-agent-other",
};

const SIZE_CLASSES = {
  sm: "size-3.75 rounded-[4px] text-[8.5px]",
  md: "size-4.5 rounded-[5px] text-[10px]",
  lg: "size-6.5 rounded-[7px] text-[13px]",
} as const;

interface AgentMarkProps {
  /** CLI manifest id, for example "anthropic-claude". */
  agentId: string | undefined;
  /** Display name, read by screen readers and used for unknown CLIs. */
  name: string;
  state?: AgentState;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/** A letter cell in the agent's color with an optional state dot in the corner. */
export function AgentMark({ agentId, name, state, size = "md", className }: AgentMarkProps) {
  const { letter, color } = agentIdentity(agentId, name);
  const label = state ? `${name}, ${AGENT_STATE_LABELS[state].toLowerCase()}` : name;
  return (
    <span
      data-slot="agent-mark"
      role="img"
      aria-label={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-bold text-agent-ink select-none",
        COLOR_CLASSES[color],
        SIZE_CLASSES[size],
        className,
      )}
    >
      <span aria-hidden="true">{letter}</span>
      {state && (
        <StatusDot
          state={state}
          decorative
          className="absolute -right-0.75 -bottom-0.75 ring-2 ring-bg-well"
        />
      )}
    </span>
  );
}
