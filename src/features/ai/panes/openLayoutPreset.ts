import { toast } from "sonner";

import { useAIStore } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { findSpaceByFolder } from "@/shared/stores/spaces/model";

import { deliverTerminalPrompt } from "../children/terminalPrompt";
import type { StartSessionRequest } from "../sessions/start";
import { createShellSession } from "../terminal/shell";
import { createTerminalSession } from "./launch";
import { buildLayout, type LayoutPreset } from "./layoutPresets";
import { useAgentsPanesStore } from "./store";

export interface OpenLayoutOptions {
  /** The tab's title; defaults to the preset's name. */
  tabName?: string;
  /** Where the shells and CLIs run; unset follows the project setting. */
  environment?: Pick<StartSessionRequest, "environment" | "sameEnvironmentAs">;
  /** Typed into every coding CLI of the layout once it is ready. */
  task?: string;
}

/** Opens a layout as a new agents tab and starts its shells and CLIs in their panes. */
export async function openLayoutPreset(
  rootPath: string,
  preset: LayoutPreset,
  options: OpenLayoutOptions = {},
): Promise<void> {
  const repositories = useOpenRepositoriesStore.getState();
  const space = findSpaceByFolder(repositories.spaces, rootPath);
  if (!space) return;
  const tabId = repositories.addTab(space.id, options.tabName ?? preset.name, "agents");
  if (!tabId) return;

  const { root, starts } = buildLayout(preset.layout);
  const panes = useAgentsPanesStore.getState();
  panes.placeLayout(tabId, root);

  const manifests = useAIStore.getState().cliManifests;
  const task = options.task?.trim();
  for (const { leafId, pane } of starts) {
    try {
      if (pane.start === "shell") {
        const session = await createShellSession(rootPath, {
          activate: false,
          environment: options.environment,
        });
        panes.assignSession(rootPath, leafId, session.id);
      } else if (pane.start === "cli") {
        const manifest = manifests.find((item) => item.id === pane.cliProviderId);
        if (!manifest) continue;
        const session = await createTerminalSession(rootPath, manifest, {
          activate: false,
          environment: options.environment,
        });
        panes.assignSession(rootPath, leafId, session.id);
        if (task) deliverTerminalPrompt(session.id, task);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start a pane of the layout");
    }
  }
}
