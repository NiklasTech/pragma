import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Pragma",
  description: "Documentation for Pragma, the desktop IDE that runs several coding agents at once.",
  base: "/pragma/",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#101114" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/pragma/favicon.svg" }],
  ],
  themeConfig: {
    logo: { light: "/logo-light.svg", dark: "/logo-dark.svg", alt: "Pragma" },
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Agents", link: "/agents/" },
      { text: "Code", link: "/editor" },
      { text: "Shortcuts", link: "/keyboard-shortcuts" },
      { text: "Help", link: "/troubleshooting" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/getting-started" },
          { text: "The Pragma window", link: "/window" },
          { text: "Spaces", link: "/spaces" },
          { text: "Coding CLIs and API keys", link: "/ai-providers" },
          { text: "Configuration", link: "/configuration" },
        ],
      },
      {
        text: "Agents",
        items: [
          { text: "The agents tab", link: "/agents/" },
          { text: "Hand out tasks", link: "/agents/start" },
          { text: "Watch your agents", link: "/agents/watching" },
          { text: "Review changes", link: "/agents/review" },
          { text: "Worktrees", link: "/agents/worktrees" },
          { text: "Coding CLIs in agents", link: "/agents/coding-clis" },
          { text: "Named agents", link: "/agents/named-agents" },
          { text: "Workspace skills", link: "/agents/skills" },
          { text: "Local tasks", link: "/agents/tasks" },
          { text: "Child sessions", link: "/agents/child-sessions" },
          { text: "Follow-ups and steering", link: "/agents/follow-ups" },
          { text: "Browser pane", link: "/agents/browser-pane" },
          { text: "Voice dictation", link: "/agents/voice-dictation" },
          { text: "Tool approvals", link: "/agents/tool-approvals" },
        ],
      },
      {
        text: "Code",
        items: [
          { text: "Editor", link: "/editor" },
          { text: "Git", link: "/git" },
          { text: "Terminal", link: "/terminal" },
          { text: "Run configurations", link: "/run-configurations" },
          { text: "Debugging", link: "/debugging" },
          { text: "Containers", link: "/containers" },
        ],
      },
      {
        text: "Customization",
        items: [
          { text: "Theming", link: "/theming" },
          { text: "Keyboard shortcuts", link: "/keyboard-shortcuts" },
          { text: "MCP servers", link: "/mcp-servers" },
          { text: "Extensions", link: "/extensions" },
          { text: "Extension API reference", link: "/extensions-api" },
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
