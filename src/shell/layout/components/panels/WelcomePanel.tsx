export default function WelcomePanel() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 text-fg-muted">
      <div className="relative">
        <div className="absolute inset-0 size-20 rounded-3xl bg-gradient-to-br from-primary/20 to-accent-secondary/10 blur-2xl" />
        <img src="/pragma_logo.svg" alt="Pragma logo" className="relative h-16 w-16 opacity-80" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-ui-lg font-bold text-fg-default tracking-tight">Pragma</h1>
        <p className="text-ui-sm text-fg-muted">Open a file or folder to get started.</p>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-bg-elevated px-3 py-1.5 text-ui-xs text-fg-subtle border border-border/30">
          <kbd className="font-mono text-[10px] bg-bg-input px-1 rounded">Ctrl</kbd>
          <span>+</span>
          <kbd className="font-mono text-[10px] bg-bg-input px-1 rounded">O</kbd>
          <span className="ml-1">Open File</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-bg-elevated px-3 py-1.5 text-ui-xs text-fg-subtle border border-border/30">
          <kbd className="font-mono text-[10px] bg-bg-input px-1 rounded">Ctrl</kbd>
          <span>+</span>
          <kbd className="font-mono text-[10px] bg-bg-input px-1 rounded">Shift</kbd>
          <span>+</span>
          <kbd className="font-mono text-[10px] bg-bg-input px-1 rounded">O</kbd>
          <span className="ml-1">Open Folder</span>
        </div>
      </div>
    </div>
  );
}
