<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `pnpm exec vp help` to print a list of commands and `pnpm exec vp <command> --help` for information about a specific command.

If `vp` is installed globally, you can omit the `pnpm exec` prefix.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `pnpm install` after pulling remote changes and before getting started.
- [ ] Run `pnpm exec vp check` and `pnpm exec vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `pnpm exec vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `pnpm exec vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
