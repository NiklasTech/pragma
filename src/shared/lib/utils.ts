import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Without the custom scales, `text-ui-xs text-fg-muted` would be merged as two colors and drop the size.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["ui-2xs", "ui-xs", "ui-sm", "ui-base", "ui-md", "ui-lg", "editor"],
      leading: ["ui-2xs", "ui-xs", "ui-sm", "ui-base", "ui-md", "ui-lg", "editor"],
      radius: ["pill", "tab"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
