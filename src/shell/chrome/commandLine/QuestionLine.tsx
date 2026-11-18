import type { KeyboardEvent } from "react";

import { resolveAcpApproval } from "@/features/ai/acp/acpApprovals";
import { resolveSpawnApproval } from "@/features/ai/children/acpSpawn";
import { stepLabel } from "@/features/agent/executor";
import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";
import { cn } from "@/shared/lib/utils";

import { SessionMark, type SessionIdentity } from "../SessionMark";
import { requestText, type Question } from "./question";

interface Choice {
  key: string;
  label: string;
  main?: boolean;
  run: () => void;
}

function choicesFor(question: Question, onGo: () => void): Choice[] {
  const go: Choice = { key: "⏎", label: "go to pane", run: onGo };
  if (question.kind === "acp") {
    const { chatSessionId, toolCallId, alwaysLabel } = question.approval;
    const answer = (decision: "allow" | "allow_always" | "deny") => () =>
      void resolveAcpApproval(chatSessionId, toolCallId, decision);
    return [
      { key: "y", label: "allow once", main: true, run: answer("allow") },
      ...(alwaysLabel ? [{ key: "a", label: alwaysLabel, run: answer("allow_always") }] : []),
      { key: "n", label: "deny", run: answer("deny") },
      go,
    ];
  }
  if (question.kind === "spawn") {
    const { sessionId } = question.entry;
    const { toolCallId } = question.approval;
    return [
      {
        key: "y",
        label: "allow",
        main: true,
        run: () => resolveSpawnApproval(sessionId, toolCallId, true),
      },
      { key: "n", label: "deny", run: () => resolveSpawnApproval(sessionId, toolCallId, false) },
      go,
    ];
  }
  return [go];
}

function summary(question: Question, name: string): { text: string; request?: string } {
  if (question.kind === "acp") {
    return { text: `${name} wants to run`, request: requestText(question.approval.toolName) };
  }
  if (question.kind === "spawn") {
    const { label, detail } = stepLabel(question.approval.toolName, question.approval.args);
    return { text: `${name} wants to ${label.toLowerCase()}`, request: detail };
  }
  return { text: `${name} needs you` };
}

interface QuestionLineProps {
  question: Question;
  identity: SessionIdentity;
  /** Whether the agent sits in another tab than the one on screen. */
  elsewhere: boolean;
  onGo: () => void;
  /** Leaves the question for typing; the key that was pressed starts the text. */
  onType: (initial: string) => void;
}

/// An agent's question in the command line, answered with y, a and n or a click.
export function QuestionLine({ question, identity, elsewhere, onGo, onType }: QuestionLineProps) {
  const choices = choicesFor(question, onGo);
  const { text, request } = summary(question, identity.name);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key === "Enter" ? "⏎" : event.key.toLowerCase();
    const choice = choices.find((item) => item.key === key);
    if (choice) {
      event.preventDefault();
      choice.run();
    } else if (event.key === "Escape" || event.key.length === 1) {
      // Any other key leaves the question for typing and starts the text with itself.
      event.preventDefault();
      onType(event.key === "Escape" ? "" : event.key);
    }
  };

  return (
    <div
      role="group"
      aria-label={text}
      onKeyDown={handleKeyDown}
      className="flex min-w-0 flex-1 items-center gap-2.5"
    >
      <span className="flex h-5.5 max-w-[220px] min-w-0 shrink-0 items-center gap-1.5 rounded-[4px] pr-2 pl-1 text-fg-default ring-1 ring-fg-default/15 ring-inset">
        <SessionMark identity={identity} surface="chrome" />
        <span className="truncate">
          {elsewhere ? `tab ${question.entry.tabNumber} · ${identity.name}` : identity.name}
        </span>
      </span>
      <span className="shrink-0 text-ui-xs text-fg-default">{text}</span>
      {request && (
        <code className="min-w-0 truncate rounded-[4px] bg-bg-well px-1.75 py-0.5 text-ui-xs text-fg-default ring-1 ring-fg-default/15 ring-inset">
          {request}
        </code>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {choices.map((choice, index) => (
          <Button
            key={choice.key}
            data-command-line-choice={index === 0 ? "" : undefined}
            variant={choice.main ? "default" : "secondary"}
            size="sm"
            onClick={choice.run}
            className={cn("h-6 gap-1.5 pr-2.25 pl-1.25 font-normal", choice.main && "font-medium")}
          >
            <Kbd>{choice.key}</Kbd>
            {choice.label}
          </Button>
        ))}
      </span>
    </div>
  );
}
