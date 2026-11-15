import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { useDebugStore } from "../store";
import type { DebugVariable } from "../client";

export function VariableNode({
  variable,
  depth,
  expanded,
  onToggle,
}: {
  variable: DebugVariable;
  depth: number;
  expanded: Set<number>;
  onToggle: (variablesReference: number) => void;
}) {
  const children = useDebugStore((state) => state.variables[variable.variablesReference]);
  const hasChildren = variable.variablesReference > 0;
  const isExpanded = hasChildren && expanded.has(variable.variablesReference);

  return (
    <div>
      <Button
        variant="ghost"
        onClick={() => hasChildren && onToggle(variable.variablesReference)}
        className="w-full justify-start gap-1 rounded-[5px] px-1 py-0.5 text-left text-fg-default h-auto whitespace-normal font-normal"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          isExpanded ? (
            <CaretDown size={10} className="shrink-0 text-fg-muted" />
          ) : (
            <CaretRight size={10} className="shrink-0 text-fg-muted" />
          )
        ) : (
          <span className="w-2.5 shrink-0" />
        )}
        <span className="truncate text-ui-xs text-fg-default">{variable.name}</span>
        <span className="truncate text-ui-xs text-fg-muted">{variable.value}</span>
      </Button>
      {isExpanded &&
        children?.map((child) => (
          <VariableNode
            key={`${child.name}-${child.variablesReference}`}
            variable={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}
