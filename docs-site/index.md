---
layout: home

hero:
  name: Pragma
  text: Run several coding agents at once, and review every line they write.
  tagline: Give every coding CLI and every account its own task. Each agent works in its own Git worktree, you watch them side by side, and a full editor is one tab away.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Hand out tasks
      link: /agents/start
    - theme: alt
      text: GitHub
      link: https://github.com/NiklasTech/pragma

features:
  - title: One task per line
    details: Write several tasks and pick the CLIs and accounts that share them. Pragma hands them out in turn, so every plan you pay for gets work.
    link: /agents/start
    linkText: Hand out tasks
  - title: Review before it lands
    details: Keep or undo every part of a change, comment on lines and send the comments back, then commit or open a pull request.
    link: /agents/review
    linkText: Review changes
  - title: Worktrees by default
    details: Agents that start together each get their own branch and folder, so they never edit the same files or your checkout.
    link: /agents/worktrees
    linkText: Worktrees
  - title: Know who needs you
    details: The status pill, the overview and the activity tab show which agent waits, which works and how much of each plan is left.
    link: /agents/watching
    linkText: Watch your agents
  - title: A full editor
    details: Language servers, Git with a commit graph, a terminal and a debugger, in the same window as your agents.
    link: /editor
    linkText: Editor
  - title: Native and open source
    details: Built with Tauri and Rust, Apache 2.0, no account. API keys stay in the keychain of your system.
    link: /getting-started
    linkText: Install Pragma
---

## See it in action

<div style="position: relative; aspect-ratio: 16 / 9; margin-top: 16px; border-radius: 12px; overflow: hidden;">
  <iframe src="https://www.youtube-nocookie.com/embed/1v0JitLk-8E" title="Pragma trailer" style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

The [walkthrough](https://www.youtube.com/watch?v=KRmWK-zc-c8) takes a small app from an idea to a commit. It was recorded with Pragma 0.7, before the current design.
