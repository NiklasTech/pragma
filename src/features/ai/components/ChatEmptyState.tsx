"use client";

export function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <p className="max-w-[40ch] text-ui-base leading-relaxed text-fg-muted">
        Ask Pragma to work in this folder.
      </p>
    </div>
  );
}
