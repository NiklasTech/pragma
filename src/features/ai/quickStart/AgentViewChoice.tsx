import { ChatCircle, TerminalWindow } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { useSettingsStore, type AgentView } from "@/shared/stores/settings";
import { openSettings } from "@/features/settings/openSettings";

import { AGENT_VIEW_LABELS, AGENT_VIEW_SETTING } from "../panes/agentView";

const HINTS: Record<AgentView, string> = {
  terminal: "the CLI's own interface",
  chat: "Pragma's own view of the agent",
};

const ICONS = { terminal: TerminalWindow, chat: ChatCircle };
const VIEWS: AgentView[] = ["terminal", "chat"];

interface AgentViewChoiceProps {
  agentName: string;
  view: AgentView;
  supports: (view: AgentView) => boolean;
  onPick: (view: AgentView) => void;
  /** Opening the settings closes the dialog, so a typed task takes the link away. */
  canLeave: boolean;
}

/** How the picked agent shows, and where the default for new agents is set. */
export function AgentViewChoice({
  agentName,
  view,
  supports,
  onPick,
  canLeave,
}: AgentViewChoiceProps) {
  const preferred = useSettingsStore((state) => state.agent.view);
  const setAgentSettings = useSettingsStore((state) => state.setAgentSettings);

  return (
    <section className="flex flex-col gap-2.5 px-5.5 pt-3 pb-1">
      <span className="text-ui-xs font-medium text-fg-muted">Show {agentName} as</span>
      <div className="flex items-center gap-2">
        <SegmentedControl<AgentView>
          label={`Show ${agentName} as`}
          value={view}
          onValueChange={onPick}
          options={VIEWS.filter(supports).map((value) => {
            const Icon = ICONS[value];
            return {
              value,
              label: (
                <>
                  <Icon size={13} aria-hidden="true" />
                  {AGENT_VIEW_LABELS[value]}
                </>
              ),
            };
          })}
        />
        <span className="flex h-8.5 min-w-0 flex-1 items-center gap-2 rounded-[9px] bg-bg-well pr-1 pl-2.5 font-mono text-ui-xs text-fg-muted ring-1 ring-border-subtle ring-inset">
          <span className="truncate">{HINTS[view]}</span>
          <span className="ml-auto shrink-0 pr-1.5 text-ui-2xs text-fg-subtle">
            {view !== preferred && supports(preferred) ? (
              <Button
                variant="ghost"
                size="xs"
                className="-mr-1.5"
                onClick={() => setAgentSettings({ view })}
              >
                make it the default
              </Button>
            ) : canLeave ? (
              <Button
                variant="ghost"
                size="xs"
                className="-mr-1.5"
                onClick={() => openSettings("agents", AGENT_VIEW_SETTING)}
              >
                Settings › Agents
              </Button>
            ) : (
              "Settings › Agents"
            )}
          </span>
        </span>
      </div>
    </section>
  );
}
