export default function WelcomePanel() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-fg-muted">
      <h1 className="text-ui-lg font-semibold text-fg-default">Pragma</h1>
      <p className="text-ui-sm">Open a file or folder to get started.</p>
    </div>
  );
}
