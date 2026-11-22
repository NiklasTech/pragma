import { PragmaMark } from "@/shared/components/PragmaMark";
import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";

const FACTS: { cell: string; name: string; text: string }[] = [
  { cell: "bg-primary", name: "agents", text: "up to 8 at once, each in its own worktree" },
  { cell: "bg-status-success", name: "review", text: "keep or undo every change before it lands" },
  { cell: "bg-status-info", name: "code", text: "editor, git, terminal and language servers" },
];

interface OnboardingWelcomeProps {
  onSetUp: () => void;
  onSkip: () => void;
}

/// The first screen: what Pragma is, in one line and three facts.
export function OnboardingWelcome({ onSetUp, onSkip }: OnboardingWelcomeProps) {
  return (
    <div className="flex w-[640px] max-w-full animate-in flex-col gap-[22px] duration-(--motion-slow) fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
      <div className="flex items-center gap-2.5 font-mono text-ui-xs text-fg-subtle">
        <span className="text-primary">›</span>pragma setup
      </div>
      <PragmaMark animation="intro" className="size-16 text-fg-default" />
      <h1 className="text-[36px] leading-[1.15] font-semibold tracking-[-0.02em] text-fg-default">
        Agents and code in one window.
      </h1>
      <p className="text-ui-md leading-relaxed text-fg-muted">
        Run Claude Code, Codex and the other coding CLIs side by side, review what they changed, and
        keep a full editor one tab away. Setup is one page and takes about a minute.
      </p>
      <div className="flex flex-col overflow-hidden rounded-well font-mono text-ui-sm ring-1 ring-border ring-inset">
        {FACTS.map((fact) => (
          <div
            key={fact.name}
            className="flex items-center gap-3.5 border-t border-border-subtle px-4 py-3 first:border-t-0"
          >
            <span aria-hidden="true" className={`size-[9px] shrink-0 rounded-[2px] ${fact.cell}`} />
            <span className="w-[70px] text-fg-default">{fact.name}</span>
            <span className="text-fg-muted">{fact.text}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button size="lg" onClick={onSetUp} className="gap-2.5">
          Set up Pragma <Kbd>⏎</Kbd>
        </Button>
        <Button variant="ghost" size="lg" onClick={onSkip} className="text-fg-muted">
          I know my way around
        </Button>
      </div>
    </div>
  );
}
