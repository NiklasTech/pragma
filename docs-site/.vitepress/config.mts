import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Pragma",
  description: "Documentation for Pragma, a lightweight and AI-native desktop IDE.",
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
        text: "Agents",
        items: [
          { text: "Agents Workspace", link: "/agents/" },
          { text: "Worktrees", link: "/agents/worktrees" },
          { text: "Named Agents", link: "/agents/named-agents" },
          { text: "Workspace Skills", link: "/agents/skills" },
          { text: "Local Tasks", link: "/agents/tasks" },
          { text: "Child Sessions", link: "/agents/child-sessions" },
          { text: "Follow-ups and Steering", link: "/agents/follow-ups" },
          { text: "Review Pane", link: "/agents/review-pane" },
          { text: "Coding CLIs", link: "/agents/coding-clis" },
          { text: "Browser Pane", link: "/agents/browser-pane" },
          { text: "Voice Dictation", link: "/agents/voice-dictation" },
          { text: "Tool Approvals", link: "/agents/tool-approvals" },
        ],
      },
      {
        text: "Run and Debug",
        items: [
          { text: "Run Configurations", link: "/run-configurations" },
          { text: "Debugging", link: "/debugging" },
        ],
      },
      {
        text: "Customization",
        items: [
          { text: "Theming Guide", link: "/theming" },
          { text: "Keyboard Shortcuts", link: "/keyboard-shortcuts" },
          { text: "Extensions", link: "/extensions" },
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
