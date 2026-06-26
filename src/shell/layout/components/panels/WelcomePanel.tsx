export default function WelcomePanel() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-fg-muted">
      <img src="/pragma_logo.svg" alt="Pragma logo" className="h-16 w-16 opacity-80" />
      <h1 className="text-ui-lg font-semibold text-fg-default">Pragma</h1>
      <p className="text-ui-sm">Open a file or folder to get started.</p>
    </div>
  );
}
