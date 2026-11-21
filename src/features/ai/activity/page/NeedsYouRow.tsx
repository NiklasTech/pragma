import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";
import { cn } from "@/shared/lib/utils";
import { questionChoices, questionSummary } from "@/shell/chrome/commandLine/questionChoices";
import { useSessionQuestion } from "@/shell/chrome/commandLine/useSessionQuestion";
import { useSessionIdentity } from "@/shell/chrome/SessionMark";

import type { DashboardItem } from "../dashboard";
import { formatStateDuration } from "../dashboard";
import { goToSession } from "./goToSession";
import { SessionDetails } from "./SessionDetails";
import { TitleToggle } from "./SessionRows";
import { useSessionFacts } from "./useSessionFacts";
import { useAgentMenu } from "../../panes/useAgentMenu";
import { ActionContextMenu } from "@/shared/components/ui/action-menu";

/// An agent that waits for an answer, answered here with y, a or n, or opened in its pane.
export function NeedsYouRow({
  item,
  now,
  expanded,
  onToggle,
}: {
  item: DashboardItem;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { session } = item;
  const identity = useSessionIdentity(session.id);
  const menu = useAgentMenu(session.id);
  const facts = useSessionFacts(session);
  const question = useSessionQuestion(session.id);
  const choices = questionChoices(question, () => goToSession(session.id, session.rootPath));
  const { text, request } = questionSummary(question, identity.name);

  return (
    <ActionContextMenu menu={menu}>
      <div className="flex flex-col overflow-hidden rounded-lg ring-1 ring-state-needs-you/35 ring-inset">
        <article
          aria-label={`${identity.title}: ${text}`}
          className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-4.5 bg-state-needs-you/8 px-4 py-3.5"
        >
          <span className="flex items-center gap-2 font-mono text-ui-xs font-semibold text-state-needs-you">
            <span aria-hidden="true" className="size-2.25 bg-state-needs-you" />
            asks · {formatStateDuration(now - item.since)}
          </span>
          <div className="flex min-w-0 flex-col gap-1.25">
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="min-w-0 font-medium">
                <TitleToggle title={identity.title} expanded={expanded} onToggle={onToggle} />
              </span>
              <span className="min-w-0 truncate font-mono text-ui-2xs text-fg-subtle">
                {[facts.agent, facts.account, facts.where].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className="flex min-w-0 items-center gap-2 font-mono text-ui-xs text-fg-default">
              <span className="shrink-0">{text}</span>
              {request && <code className="min-w-0 truncate text-fg-muted">{request}</code>}
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1.5">
            {choices.map((choice) => (
              <Button
                key={choice.key}
                variant={choice.main ? "default" : choice.key === "⏎" ? "ghost" : "secondary"}
                size="sm"
                onClick={choice.run}
                className={cn(
                  "h-7 gap-1.5 pr-2.5 pl-1.5 font-mono font-normal",
                  choice.main && "font-medium",
                )}
              >
                <Kbd>{choice.key}</Kbd>
                {choice.label}
              </Button>
            ))}
          </span>
        </article>
        {expanded && <SessionDetails item={item} now={now} />}
      </div>
    </ActionContextMenu>
  );
}
