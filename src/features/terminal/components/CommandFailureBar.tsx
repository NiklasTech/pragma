import { useState } from "react";
import { PaperPlaneRight, Sparkle, WarningCircle, X } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import type { FinishedCommand } from "../shellIntegration/commandTracker";
import type { FailureIntent } from "../shellIntegration/failureMessage";
import { sendCommandFailure } from "../shellIntegration/sendFailure";

interface CommandFailureBarProps {
  command: FinishedCommand;
  onDismiss: () => void;
}

export function CommandFailureBar({ command, onDismiss }: CommandFailureBarProps) {
  const [sending, setSending] = useState(false);

  const send = async (intent: FailureIntent) => {
    setSending(true);
    const sent = await sendCommandFailure(command, intent);
    setSending(false);
    if (sent) onDismiss();
  };

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-bg-elevated p-1 shadow-md">
      <WarningCircle size={13} weight="fill" className="ml-1 shrink-0 text-status-error" />
      <span
        className="max-w-48 truncate px-1 text-ui-xs text-fg-muted"
        title={command.command || undefined}
      >
        Exit code {command.exitCode ?? "unknown"}
      </span>
      <Button variant="ghost" size="xs" disabled={sending} onClick={() => void send("explain")}>
        <Sparkle size={12} />
        Explain
      </Button>
      <Button variant="ghost" size="xs" disabled={sending} onClick={() => void send("session")}>
        <PaperPlaneRight size={12} />
        Send to session
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onDismiss} title="Dismiss">
        <X size={13} />
      </Button>
    </div>
  );
}
