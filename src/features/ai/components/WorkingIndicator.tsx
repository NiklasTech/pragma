import { PulseDot } from "./PulseDot";
import { Shimmer } from "./Shimmer";
import { useElapsedSeconds } from "./useElapsedSeconds";

export function WorkingIndicator({ label }: { label: string }) {
  const seconds = useElapsedSeconds(true);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-7 animate-in items-center gap-2 text-ui-xs duration-300 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none"
    >
      <PulseDot />
      <Shimmer as="span" duration={1.8}>
        {label}
      </Shimmer>
      {seconds > 0 && <span className="text-fg-subtle tabular-nums">{seconds}s</span>}
    </div>
  );
}
