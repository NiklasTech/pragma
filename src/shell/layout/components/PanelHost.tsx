import { Suspense, lazy } from "react";
import type { PanelKind } from "../tree/types";

const EditorPanel = lazy(() => import("./panels/EditorPanel"));
const TerminalPanel = lazy(() => import("./panels/TerminalPanel"));
const RunOutputPanel = lazy(() => import("./panels/RunOutputPanel"));
const GitDiffPanel = lazy(() => import("./panels/GitDiffPanel"));
const GitHistoryPanel = lazy(() => import("./panels/GitHistoryPanel"));
const AIDiffPanel = lazy(() => import("./panels/AIDiffPanel"));
const MarkdownPanel = lazy(() => import("./panels/MarkdownPanel"));
const PreviewPanel = lazy(() => import("./panels/PreviewPanel"));
const ProblemsPanel = lazy(() => import("./panels/ProblemsPanel"));
const SettingsPanel = lazy(() => import("./panels/SettingsPanel"));
const WelcomePanel = lazy(() => import("./panels/WelcomePanel"));

interface PanelHostProps {
  panelId: string;
  kind: PanelKind;
}

export function PanelHost({ panelId, kind }: PanelHostProps) {
  return (
    <div className="group relative flex h-full w-full flex-col overflow-hidden border border-border/40 bg-bg-root">
      <div className="min-h-0 flex-1">
        <Suspense fallback={<PanelSkeleton />}>
          <PanelContent kind={kind} panelId={panelId} />
        </Suspense>
      </div>
    </div>
  );
}

function PanelContent({ kind, panelId }: { kind: PanelKind; panelId: string }) {
  switch (kind) {
    case "editor":
      return <EditorPanel panelId={panelId} />;
    case "terminal":
      return <TerminalPanel />;
    case "run-output":
    case "output":
      return <RunOutputPanel />;
    case "git-diff":
      return <GitDiffPanel />;
    case "git-history":
      return <GitHistoryPanel />;
    case "ai-diff":
      return <AIDiffPanel />;
    case "markdown":
      return <MarkdownPanel />;
    case "preview":
      return <PreviewPanel />;
    case "problems":
      return <ProblemsPanel />;
    case "welcome":
      return <WelcomePanel />;
    case "settings":
      return <SettingsPanel />;
    default:
      return null;
  }
}

function PanelSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center text-ui-sm text-fg-muted">
      Loading panel…
    </div>
  );
}
