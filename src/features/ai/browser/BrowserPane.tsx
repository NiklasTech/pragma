"use client";

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Browser,
  ProhibitInset,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

import { useFramePolicy } from "./framePolicy";
import { NativeBrowserView } from "./NativeBrowserView";
import { registerBrowserFrame } from "./frames";
import { currentUrl, useBrowserHistoryStore } from "./history";
import { parseBrowserUrl } from "./url";

const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-modals";

export function BrowserPane({ leafId }: { leafId: string }) {
  const history = useBrowserHistoryStore((state) => state.byLeaf[leafId]);
  const navigate = useBrowserHistoryStore((state) => state.navigate);
  const back = useBrowserHistoryStore((state) => state.back);
  const forward = useBrowserHistoryStore((state) => state.forward);
  const reload = useBrowserHistoryStore((state) => state.reload);

  const url = currentUrl(history);
  const frameRef = useCallback(
    (frame: HTMLIFrameElement | null) => registerBrowserFrame(leafId, frame),
    [leafId],
  );
  const [draft, setDraft] = useState(url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const framePolicy = useFramePolicy(url);

  useEffect(() => {
    setDraft(url ?? "");
    setError(null);
    setNativeError(null);
  }, [url]);

  // Sites that refuse framing open in a native webview, which frame rules do not apply to.
  const native = url !== null && framePolicy?.blocked === true && nativeError === null;

  const canGoBack = history !== undefined && history.index > 0;
  const canGoForward = history !== undefined && history.index < history.entries.length - 1;

  const openExternally = () => {
    if (!url) return;
    invoke("open_external_url", { url }).catch((err: unknown) => toast.error(String(err)));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseBrowserUrl(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    navigate(leafId, parsed.url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-1 border-b border-border-subtle px-1.5 py-1"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => back(leafId)}
          disabled={!canGoBack}
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft size={13} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => forward(leafId)}
          disabled={!canGoForward}
          aria-label="Forward"
          title="Forward"
        >
          <ArrowRight size={13} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => reload(leafId)}
          disabled={url === null}
          aria-label="Reload"
          title="Reload"
        >
          <ArrowClockwise size={13} />
        </Button>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="http://localhost:5173"
          aria-label="URL"
          aria-invalid={error !== null}
          autoFocus={url === null}
          spellCheck={false}
          className="h-7 flex-1 font-mono text-ui-xs"
        />
      </form>
      {error && (
        <p role="alert" className="shrink-0 px-3 py-1 text-ui-xs text-status-error">
          {error}
        </p>
      )}
      <div className="relative min-h-0 flex-1 bg-white">
        {url && native && (
          <NativeBrowserView
            key={`${history?.index ?? 0}-${history?.reloadToken ?? 0}`}
            leafId={leafId}
            url={url}
            onError={setNativeError}
          />
        )}
        {url && framePolicy?.blocked && nativeError !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-root px-6 text-center">
            <ProhibitInset size={28} className="text-fg-subtle" />
            <div className="flex flex-col gap-1">
              <span className="text-ui-sm font-medium text-fg-default">
                This site does not allow being shown inside Pragma
              </span>
              {framePolicy.reason && (
                <span className="font-mono text-ui-xs text-fg-muted">{framePolicy.reason}</span>
              )}
              <span className="text-ui-xs text-fg-muted">{nativeError}</span>
            </div>
            <Button variant="outline" size="sm" onClick={openExternally}>
              <ArrowSquareOut size={13} />
              Open in system browser
            </Button>
          </div>
        )}
        {native ? null : url ? (
          <iframe
            key={`${history?.index ?? 0}-${history?.reloadToken ?? 0}`}
            ref={frameRef}
            title={url}
            src={url}
            sandbox={IFRAME_SANDBOX}
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-bg-root text-ui-sm text-fg-muted">
            <Browser size={28} className="text-fg-subtle" />
            <span>Open a local URL</span>
          </div>
        )}
      </div>
    </div>
  );
}
