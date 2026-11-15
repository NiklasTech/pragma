import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { sendExtensionCommand } from "../host";
import { useExtensionsStore } from "../store";

const CHIP_CLASSES =
  "flex h-5 max-w-[200px] items-center rounded-full px-2 text-ui-2xs text-fg-subtle";

/// Status items contributed by extensions, shown in the top strip.
export function ExtensionStatusItems({ alignment }: { alignment: "left" | "right" }) {
  const items = useExtensionsStore((state) => state.statusBarItems);

  return items
    .filter((item) => item.alignment === alignment)
    .map((item) => {
      const key = `${item.extensionId}:${item.id}`;
      const text = <span className="truncate">{item.text}</span>;
      const command = item.command;
      if (!command) {
        return (
          <div key={key} className={CHIP_CLASSES} title={item.tooltip}>
            {text}
          </div>
        );
      }
      return (
        <Button
          variant="ghost"
          size="xs"
          key={key}
          title={item.tooltip}
          onClick={() => sendExtensionCommand(item.extensionId, command)}
          className={cn(CHIP_CLASSES, "font-normal")}
        >
          {text}
        </Button>
      );
    });
}
