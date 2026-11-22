---
layout: home
markdownStyles: false

hero:
  name: Pragma
  image:
    light: /logo-light.svg
    dark: /logo-dark.svg
    alt: The Pragma mark
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

<div class="tour">

<img src="/screens/agents.webp" alt="Three Claude Code agents side by side in one agents tab, each on its own task">

<h2>Hand out tasks, one per line</h2>
<p>Write several tasks and pick who shares them. A Cmd-click adds another CLI or another account, and Pragma hands the tasks out in turn.</p>
<img src="/screens/start.webp" alt="The start card with three tasks handed to two Claude Code accounts and Grok Build">

<h2>Review before anything lands</h2>
<p>Keep or undo each part of a change, comment on lines and send the comments back to the agent, then commit or open a pull request from the same sheet.</p>
<img src="/screens/review.webp" alt="The review with a diff, a comment and the buttons to send feedback or commit and open a pull request">

<h2>A full editor one tab away</h2>
<p>Language servers, a file tree, workspace search, a terminal and a debugger in the code tab of every project.</p>
<img src="/screens/code.webp" alt="The code tab with the file tree, a TypeScript file and a terminal">

<h2>Git built in</h2>
<p>The commit graph with messages, pull requests and changed files, and the branches your agents work on.</p>
<img src="/screens/history.webp" alt="Git history with the commit graph and the details of a commit">

<h2>One space per project</h2>
<p>Every project keeps its own tabs, layouts and agent worktrees, and agents keep running while you work in another space.</p>
<img src="/screens/spaces.webp" alt="The spaces overview with worktrees, tabs and saved layouts of a project">

<h2>See it in action</h2>
<div class="video">
  <iframe src="https://www.youtube-nocookie.com/embed/1v0JitLk-8E" title="Pragma trailer" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>
<p>The <a href="https://www.youtube.com/watch?v=KRmWK-zc-c8">walkthrough</a> takes a small app from an idea to a commit. It was recorded with Pragma 0.7, before the current design.</p>

</div>
