export function ChatTypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-muted [animation-delay:-0.6s] motion-reduce:animate-none" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-muted [animation-delay:-0.3s] motion-reduce:animate-none" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-muted motion-reduce:animate-none" />
    </div>
  );
}
