import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Pragma",
  description: "Documentation for Pragma, a lightweight and AI-native desktop IDE.",
  base: "/pragma/",
  cleanUrls: true,
  lastUpdated: true,
  head: [["meta", { name: "theme-color", content: "#101114" }]],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Customization", link: "/theming" },
      { text: "Help", link: "/troubleshooting" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Configuration", link: "/configuration" },
          { text: "AI Provider Setup", link: "/ai-providers" },
          { text: "MCP Server Setup", link: "/mcp-servers" },
        ],
      },
      {
        text: "Customization",
        items: [
          { text: "Theming Guide", link: "/theming" },
          { text: "Keyboard Shortcuts", link: "/keyboard-shortcuts" },
        ],
      },
      {
        text: "Help",
        items: [{ text: "Troubleshooting", link: "/troubleshooting" }],
      },
    ],
    search: {
      provider: "local",
    },
    socialLinks: [{ icon: "github", link: "https://github.com/NiklasTech/pragma" }],
    editLink: {
      pattern: "https://github.com/NiklasTech/pragma/edit/main/docs-site/:path",
      text: "Edit this page on GitHub",
    },
    outline: { level: [2, 3] },
    footer: {
      message: "Released under the Apache License 2.0.",
      copyright: "Copyright 2026 NiklasTech",
    },
  },
});
