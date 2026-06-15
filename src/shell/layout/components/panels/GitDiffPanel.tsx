export default function GitDiffPanel() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ui-sm text-fg-muted">
      <span>Git Diff</span>
      <span className="text-ui-xs">Select a changed file in Git Status to view its diff.</span>
    </div>
  );
}
