import type { LayoutNode, SplitNode, TabsNode } from "../tree/types";
import { ResizableHandle, ResizablePanel } from "@/shared/components/ui/resizable";
import * as ResizablePrimitive from "react-resizable-panels";
import { PanelHost } from "./PanelHost";
import { TabsContainer } from "./TabsContainer";
import { useLayoutStore } from "../store";

interface LayoutTreeRendererProps {
  node: LayoutNode;
}

export function LayoutTreeRenderer({ node }: LayoutTreeRendererProps) {
  if (node.type === "panel") {
    return <PanelHost panelId={node.id} kind={node.kind} />;
  }

  if (node.type === "tabs") {
    return <TabsNodeRenderer node={node} />;
  }

  if (node.type === "split") {
    return <SplitNodeRenderer node={node} />;
  }

  return null;
}

function SplitNodeRenderer({ node }: { node: SplitNode }) {
  const updateSplitSizes = useLayoutStore((s) => s.updateSplitSizes);
  const orientation = node.direction === "horizontal" ? "horizontal" : "vertical";

  return (
    <ResizablePrimitive.Group
      id={node.id}
      className="flex h-full w-full aria-[orientation=vertical]:flex-col"
      orientation={orientation}
      onLayoutChanged={(layout) => {
        const sizes = node.children.map((c) => layout[c.id] ?? 100 / node.children.length);
        updateSplitSizes(node.id, sizes);
      }}
    >
      {node.children.flatMap((child, index) => [
        <ResizablePanel
          key={child.id}
          id={child.id}
          defaultSize={`${node.sizes[index]}%`}
          minSize="10%"
        >
          <LayoutTreeRenderer node={child} />
        </ResizablePanel>,
        index < node.children.length - 1 ? (
          <ResizableHandle key={`${child.id}-handle`} withHandle />
        ) : null,
      ])}
    </ResizablePrimitive.Group>
  );
}

function TabsNodeRenderer({ node }: { node: TabsNode }) {
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const activePanel = node.children.find((c) => c.id === node.activeTabId) ?? node.children[0];

  return (
    <TabsContainer
      tabs={node.children}
      activeTabId={activePanel?.id ?? null}
      onSelect={(panelId) => setActiveTab(node.id, panelId)}
    >
      {activePanel ? <LayoutTreeRenderer node={activePanel} /> : null}
    </TabsContainer>
  );
}
