// Sizes, fonts and motion are fixed in code so no theme can break the layout.
export const FIXED_TOKENS = {
  layout: {
    headerHeight: 40,
    tabHeight: 36,
    statusbarHeight: 26,
    breadcrumbHeight: 28,
    inputbarHeight: 42,
    sidebarWidth: 260,
    sidebarCollapsedWidth: 44,
    sidebarMinWidth: 180,
    sidebarMaxWidth: 480,
    panelMinHeight: 160,
    panelDefaultHeight: 240,
    rowHeight: 26,
    padding: {
      xs: 4,
      sm: 6,
      md: 8,
      lg: 12,
    },
  },
  typography: {
    ui: {
      "2xs": "11px",
      xs: "12px",
      sm: "13px",
      base: "13px",
      md: "14px",
      lg: "17px",
    },
    editor: "14px",
    lineHeight: {
      ui: {
        "2xs": "14px",
        xs: "16px",
        sm: "18px",
        base: "20px",
        md: "22px",
        lg: "24px",
      },
      editor: "22px",
    },
  },
  motion: {
    duration: {
      fast: "150ms",
      base: "200ms",
      slow: "250ms",
      layout: "300ms",
    },
    ease: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      out: "cubic-bezier(0.16, 1, 0.3, 1)",
      inOut: "cubic-bezier(0.2, 0, 0, 1)",
      spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
  },
};
