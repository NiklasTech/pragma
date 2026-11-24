import { agentIdentity, type AgentColor } from "@/shared/lib/agentIdentity";
import { cn } from "@/shared/lib/utils";

import type { PresetNode } from "../panes/layoutPresets";

const AGENT_FILL: Record<AgentColor, string> = {
  claude: "bg-agent-claude/85",
  codex: "bg-agent-codex/85",
  gemini: "bg-agent-gemini/85",
  opencode: "bg-agent-opencode/85",
  other: "bg-agent-other/85",
};

function Node({ node, grow }: { node: PresetNode; grow: number }) {
  if (node.type === "pane") {
    const fill =
      node.start === "cli"
        ? AGENT_FILL[agentIdentity(node.cliProviderId, node.cliProviderId).color]
        : node.start === "shell"
          ? "bg-control-hover"
          : "bg-control";
    return (
      <span
        className={cn("flex min-h-0 min-w-0 flex-col justify-end rounded-[3px] p-1", fill)}
        style={{ flexGrow: grow, flexBasis: 0 }}
      >
        {node.start === "cli" && node.view === "chat" && (
          <span className="h-2 rounded-[2px] bg-bg-well/45" />
        )}
      </span>
    );
  }
  return (
    <span
      className={cn("flex min-h-0 min-w-0 gap-[3px]", node.direction === "vertical" && "flex-col")}
      style={{ flexGrow: grow, flexBasis: 0 }}
    >
      {node.children.map((child, index) => (
        <Node key={index} node={child} grow={node.sizes[index] ?? 1} />
      ))}
    </span>
  );
}

/// A small picture of a layout: agent panes in the agent's color, a chat with its message field, shells and empty panes in grey.
export function LayoutDiagram({ layout }: { layout: PresetNode }) {
  return (
    <span aria-hidden="true" className="flex h-15.5 rounded-[6px] bg-bg-well p-1 [&>*]:flex-1">
      <Node node={layout} grow={1} />
    </span>
  );
}
