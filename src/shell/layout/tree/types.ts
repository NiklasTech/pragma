export type SidebarPosition = "left" | "right" | "hidden";

export type SidebarTab = "explorer" | "search" | "git" | "git-status" | "docker" | "processes";

export type AIMode = "hidden" | "floating" | "drawer-left" | "drawer-right" | "bottom-sheet";

export type TerminalMode = "docked-bottom" | "floating-tab" | "hidden";

export interface SidebarState {
  position: SidebarPosition;
  width: number;
  collapsed: boolean;
  tab: SidebarTab;
}

export interface FloatingState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AIState {
  mode: AIMode;
  floating: FloatingState;
  size: number;
}

export interface TerminalState {
  mode: TerminalMode;
  height: number;
  floating: FloatingState;
}

export interface WorkspaceState {
  editorHeight: number;
}

export type PanelKind =
  | "welcome"
  | "editor"
  | "terminal"
  | "run-output"
  | "git-diff"
  | "git-history"
  | "ai-diff"
  | "output"
  | "problems"
  | "preview"
  | "markdown"
  | "settings";

export interface BaseNode {
  id: string;
}

export interface PanelNode extends BaseNode {
  type: "panel";
  kind: PanelKind;
}

export interface TabsNode extends BaseNode {
  type: "tabs";
  activeTabId: string | null;
  children: PanelNode[];
}

export interface SplitNode extends BaseNode {
  type: "split";
  direction: "horizontal" | "vertical";
  children: LayoutNode[];
  sizes: number[];
}

export interface FloatingNode extends BaseNode {
  type: "floating";
  x: number;
  y: number;
  width: number;
  height: number;
  child: LayoutNode;
  external?: string;
}

export type LayoutNode = SplitNode | TabsNode | PanelNode | FloatingNode;

export type DropZone = "left" | "right" | "top" | "bottom" | "center" | "tabs" | "floating";

export interface DropTarget {
  nodeId: string;
  zone: DropZone;
}

export interface LayoutTreeState {
  sidebar: SidebarState;
  ai: AIState;
  terminal: TerminalState;
  root: LayoutNode;
  floating: FloatingNode[];
  activePreset: string | null;
  isCustomized: boolean;
}

export interface LayoutTreeActions {
  setSidebarPosition: (position: SidebarPosition) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  toggleSidebar: () => void;

  setAIMode: (mode: AIMode) => void;
  setAIFloating: (floating: Partial<FloatingState>) => void;
  setAISize: (size: number) => void;
  toggleAI: () => void;

  setTerminalMode: (mode: TerminalMode) => void;
  setTerminalHeight: (height: number) => void;
  setTerminalFloating: (floating: Partial<FloatingState>) => void;
  toggleTerminal: () => void;

  setRoot: (root: LayoutNode) => void;
  movePanel: (panelId: string, target: DropTarget) => void;
  splitPanel: (panelId: string, direction: "horizontal" | "vertical", kind?: PanelKind) => void;
  closePanel: (panelId: string) => void;
  floatPanel: (panelId: string) => void;
  dockFloatingPanel: (floatingId: string, target?: DropTarget) => void;
  addFloatingPanel: (kind: PanelKind) => void;
  moveFloatingToExternal: (floatingId: string, label: string) => void;
  dockExternalWindow: (label: string, bounds?: Partial<FloatingState>) => void;
  setActiveTab: (tabsNodeId: string, panelId: string) => void;
  updateSplitSizes: (splitId: string, sizes: number[]) => void;

  applyPreset: (presetId: string) => void;
  setActivePreset: (presetId: string | null) => void;
  markCustomized: () => void;
}

export type FullLayoutTreeState = LayoutTreeState & LayoutTreeActions;
