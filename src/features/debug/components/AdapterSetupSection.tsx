import { useEffect, useState } from "react";
import { DownloadSimple, Spinner } from "@phosphor-icons/react";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { cn } from "@/shared/lib/utils";
import { dapListAdapters, listenDapInstallProgress, type DapAdapterInfo } from "../client";
import { installAdapter } from "../adapterSetup";
import { SectionLabel } from "./DebugPanelParts";

export function AdapterSetupSection() {
  const [adapters, setAdapters] = useState<DapAdapterInfo[] | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});

  const refresh = () => {
    dapListAdapters()
      .then(setAdapters)
      .catch(() => setAdapters([]));
  };

  useEffect(refresh, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listenDapInstallProgress((event) => {
      const suffix =
        event.stage === "downloading" && typeof event.percent === "number"
          ? ` ${event.percent}%`
          : "";
      setProgress((prev) => {
        const next = { ...prev };
        if (event.stage === "done" && next[event.adapterId]) {
          delete next[event.adapterId];
        } else {
          next[event.adapterId] = `${event.message}${suffix}`;
        }
        return next;
      });
      if (event.stage === "done" || event.stage === "error") {
        refresh();
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      void unlistenQuietly(unlisten);
    };
  }, []);

  const handleInstall = async (adapter: DapAdapterInfo) => {
    setInstallingId(adapter.id);
    await installAdapter(adapter);
    setInstallingId(null);
    refresh();
  };

  if (!adapters) return null;

  return (
    <div className="space-y-1.5">
      <SectionLabel title="Setup" />
      <div className="space-y-0.5">
        {adapters.map((adapter) => (
          <div key={adapter.id} className="rounded px-2 py-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    adapter.available ? "bg-status-success" : "bg-status-error",
                  )}
                />
                <span
                  className="truncate text-ui-xs text-fg-default"
                  title={adapter.install_hint ?? undefined}
                >
                  {adapter.label}
                </span>
              </div>
              {!adapter.available && (
                <button
                  type="button"
                  disabled={installingId !== null}
                  onClick={() => void handleInstall(adapter)}
                  title={adapter.install_hint ?? "Install adapter"}
                  className="flex h-5 shrink-0 items-center gap-1 rounded-md border border-border px-1.5 text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40"
                >
                  {installingId === adapter.id ? (
                    <Spinner size={10} className="animate-spin" />
                  ) : (
                    <DownloadSimple size={10} />
                  )}
                  Install
                </button>
              )}
            </div>
            {progress[adapter.id] && (
              <div className="truncate pl-4 text-ui-xs text-fg-muted" title={progress[adapter.id]}>
                {progress[adapter.id]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
