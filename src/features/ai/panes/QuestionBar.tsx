import { Button } from "@/shared/components/ui/button";

interface QuestionBarProps {
  /** Who asks, for example "Claude Code asks". */
  title: string;
  question: string;
  options: string[];
  onChoose: (option: string) => void;
  onDismiss: () => void;
}

/// A question an agent asks with answers to pick from, at the bottom of its pane.
export function QuestionBar({ title, question, options, onChoose, onDismiss }: QuestionBarProps) {
  return (
    <div
      role="group"
      aria-label="Question from the agent"
      // Answering from a pane in the background must not first swap it for the focused view.
      onPointerDown={(event) => event.stopPropagation()}
      className="mb-2 flex animate-in flex-col gap-2 rounded-well bg-bg-sheet py-2.5 pr-2.5 pl-3.5 ring-1 ring-state-needs-you/40 duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ring-inset fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ui-sm font-medium text-fg-default">{title}</span>
        <span className="text-ui-sm text-state-needs-you">{question}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {options.map((option, index) => (
          <Button
            key={option}
            size="sm"
            variant={index === 0 ? "default" : "secondary"}
            onClick={() => onChoose(option)}
          >
            {option}
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onDismiss}>
          Dismiss
        </Button>
      </span>
    </div>
  );
}
