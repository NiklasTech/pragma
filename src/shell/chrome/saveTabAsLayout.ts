import { captureLayout, useLayoutPresetsStore } from "@/features/ai/panes/layoutPresets";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { useAIStore } from "@/shared/stores/ai";

/// Keeps a tab's panes and what runs in them as a layout for New Task and the pane layout menu.
export function saveTabAsLayout(tabId: string, name: string): void {
  const root = useAgentsPanesStore.getState().trees[tabId]?.root ?? null;
  const layout = captureLayout(root, useAIStore.getState().chatSessions);
  if (layout && name.trim()) useLayoutPresetsStore.getState().save(name, layout);
}
