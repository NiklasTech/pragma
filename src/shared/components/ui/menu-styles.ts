// Shared look for context menus and dropdown menus so both read as one system.
export const MENU_POPUP =
  "z-[80] max-h-(--available-height) min-w-48 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-bg-elevated p-1 text-ui-sm text-fg-default shadow-[var(--shadow-md)] duration-100 outline-none data-[side=bottom]:slide-in-from-top-1 data-[side=inline-end]:slide-in-from-left-1 data-[side=inline-start]:slide-in-from-right-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-[0.97]";

export const MENU_ITEM =
  "relative flex min-h-7 cursor-default items-center gap-2.5 rounded-md px-2 py-1 text-ui-sm text-fg-default outline-hidden select-none transition-colors duration-75 focus:bg-bg-hover data-highlighted:bg-bg-hover data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-40 data-[variant=destructive]:text-status-error data-[variant=destructive]:focus:bg-status-error/10 data-[variant=destructive]:data-highlighted:bg-status-error/10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 [&_svg:not([class*='text-'])]:text-fg-subtle focus:[&_svg:not([class*='text-'])]:text-fg-default data-highlighted:[&_svg:not([class*='text-'])]:text-fg-default data-[variant=destructive]:[&_svg:not([class*='text-'])]:text-status-error";

export const MENU_INDICATOR_ITEM = `${MENU_ITEM} pr-8`;

export const MENU_SUB_TRIGGER = `${MENU_ITEM} data-open:bg-bg-hover data-popup-open:bg-bg-hover`;

export const MENU_LABEL =
  "px-2 pt-2 pb-1 text-ui-2xs font-semibold tracking-wider text-fg-subtle uppercase data-inset:pl-8";

export const MENU_SEPARATOR = "-mx-1 my-1 h-px bg-border-subtle";

export const MENU_SHORTCUT = "ml-auto pl-4 font-mono text-ui-2xs tracking-normal text-fg-subtle";
