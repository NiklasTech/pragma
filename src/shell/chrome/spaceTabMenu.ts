import type { ActionMenuSpec } from "@/shared/components/ui/action-menu";
import type { Space, SpaceTab } from "@/shared/stores/spaces/model";

export interface SpaceTabActions {
  rename: () => void;
  newAgentsTab: () => void;
  showCode: () => void;
  showActivity: () => void;
  close: (tabIds: string[]) => void;
}

/// Right-click on a space tab: rename it, open the other tab kinds, or close tabs.
export function spaceTabMenu(
  space: Space,
  tab: SpaceTab,
  actions: SpaceTabActions,
): ActionMenuSpec {
  const index = space.tabs.findIndex((item) => item.id === tab.id);
  const others = space.tabs.filter((item) => item.id !== tab.id);
  const toTheRight = space.tabs.slice(index + 1);
  return {
    head: `tab ${index + 1} · ${tab.name} · ${space.name}`,
    tone: "idle",
    groups: [
      {
        items: [
          { key: "r", label: "rename", onSelect: actions.rename },
          { key: "n", label: "new agents tab", onSelect: actions.newAgentsTab },
          ...(tab.kind !== "code"
            ? [{ key: "c", label: "show code tab", onSelect: actions.showCode }]
            : []),
          ...(tab.kind !== "activity"
            ? [{ key: "a", label: "show activity tab", onSelect: actions.showActivity }]
            : []),
        ],
      },
      {
        items: [
          {
            key: "w",
            label: "close",
            disabled: others.length === 0,
            onSelect: () => actions.close([tab.id]),
          },
          {
            key: "o",
            label: "close other tabs",
            disabled: others.length === 0,
            onSelect: () => actions.close(others.map((item) => item.id)),
          },
          {
            key: "l",
            label: "close tabs to the right",
            disabled: toTheRight.length === 0,
            onSelect: () => actions.close(toTheRight.map((item) => item.id)),
          },
        ],
      },
    ],
  };
}
