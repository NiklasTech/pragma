import { useCliSyncStore } from "@/features/ai/cli-sync/store";
import { Button } from "@/shared/components/ui/button";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";

import { SettingRow } from "../ui/SettingRow";
import { SettingSection } from "../ui/SettingSection";

/// The `cliSync` setting, the result of the last sync and its conflicts, with a Sync now action.
export function CliSyncSection({ rootPath, trusted }: { rootPath: string; trusted: boolean }) {
  const cliSync = useWorkspaceSettingsStore((state) => state.settings?.cliSync);
  const syncedRoot = useCliSyncStore((state) => state.rootPath);
  const running = useCliSyncStore((state) => state.running);
  const result = useCliSyncStore((state) => state.result);
  const error = useCliSyncStore((state) => state.error);
  const syncedAt = useCliSyncStore((state) => state.syncedAt);

  const targets = cliSync?.targets ?? [];
  const current = syncedRoot === rootPath;
  const conflicts = current ? (result?.conflicts ?? []) : [];

  return (
    <SettingSection
      title="Coding CLI sync"
      badge={cliSync && !trusted ? { label: "Folder not trusted", variant: "warning" } : undefined}
      action={
        <Button
          size="xs"
          variant="ghost"
          disabled={!cliSync || !trusted || running}
          onClick={() => void useCliSyncStore.getState().sync(rootPath, targets)}
        >
          Sync now
        </Button>
      }
    >
      {!cliSync ? (
        <SettingRow
          label="Not set up"
          description='Add "cliSync" to .pragma/settings.json to copy the skills and agents of .pragma into the folders each coding CLI reads.'
          control={null}
        />
      ) : (
        <>
          <SettingRow
            label="Targets"
            description={
              cliSync.commit
                ? "Generated files are committed with the project."
                : "Generated files are listed in .gitignore."
            }
            control={
              <span className="text-ui-sm text-fg-muted">
                {targets.length > 0 ? targets.join(", ") : "None"}
              </span>
            }
          />
          <SettingRow
            label="Last sync"
            description={
              current && error ? (
                <span className="text-status-error">{error}</span>
              ) : current && result ? (
                `${result.written.length} written, ${result.unchanged.length} unchanged, ${result.removed.length} removed, ${result.conflicts.length} conflicts`
              ) : undefined
            }
            control={
              <span className="text-ui-sm text-fg-muted">
                {running
                  ? "Syncing"
                  : current && syncedAt
                    ? new Date(syncedAt).toLocaleTimeString()
                    : "Not yet"}
              </span>
            }
          />
          {conflicts.length > 0 && (
            <div className="flex flex-col gap-1 py-3">
              <span className="text-ui-sm font-medium text-fg-default">Conflicts</span>
              <span className="text-ui-xs text-fg-subtle">
                Pragma leaves these files alone. Delete or rename them to let the next sync write
                them.
              </span>
              {conflicts.map((conflict) => (
                <div key={conflict.path} className="flex items-baseline justify-between gap-3">
                  <code className="min-w-0 truncate font-mono text-ui-xs text-fg-muted">
                    {conflict.path}
                  </code>
                  <span className="shrink-0 text-ui-xs text-fg-subtle">{conflict.reason}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </SettingSection>
  );
}
