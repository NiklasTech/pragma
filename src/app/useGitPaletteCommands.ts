import { useMemo } from "react";
import { toast } from "sonner";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useGitStore } from "@/shared/stores/git";
import { useRegisterPaletteCommands } from "./useRegisterPaletteCommands";

const SMART_SWITCH_ID = "smart";
const NORMAL_SWITCH_ID = "normal";

function stagedFileCount(): number {
  return (
    useGitStore.getState().snapshot?.changed_files.filter((file) => file.is_staged).length ?? 0
  );
}

async function commitStaged(): Promise<void> {
  await useGitStore.getState().loadStatus();
  const staged = stagedFileCount();
  if (staged === 0) {
    toast.error("Stage files before committing.");
    return;
  }
  const draft = useGitStore.getState().commitMessage.trim();
  useCommandPaletteStore.getState().openPrompt({
    placeholder: "Commit message",
    initialValue: draft.includes("\n") ? "" : draft,
    submitLabel: () => `Commit ${staged} ${staged === 1 ? "file" : "files"}`,
    onSubmit: (message) => {
      void (async () => {
        const git = useGitStore.getState();
        git.setCommitMessage(message);
        await git.commit();
        const { commitMessage, error } = useGitStore.getState();
        if (commitMessage === "") toast.success("Changes committed");
        else if (error) toast.error(error);
      })();
    },
  });
}

async function switchToBranch(branchName: string): Promise<void> {
  const git = useGitStore.getState();
  if (branchName === git.snapshot?.repo.branch) return;
  if (!(await git.hasUncommittedChanges())) {
    await git.checkoutBranch(branchName);
    return;
  }
  useCommandPaletteStore.getState().openPicker({
    placeholder: `You have uncommitted changes. How do you want to switch to ${branchName}?`,
    emptyText: "No switch options found.",
    items: [
      {
        id: SMART_SWITCH_ID,
        label: "Smart Switch",
        detail: "Stash changes, switch branch, then restore them",
      },
      {
        id: NORMAL_SWITCH_ID,
        label: "Normal Switch",
        detail: "Switch without stashing (may fail or conflict)",
      },
    ],
    onSelect: (item) => {
      const store = useGitStore.getState();
      void (item.id === SMART_SWITCH_ID
        ? store.smartCheckout(branchName)
        : store.checkoutBranch(branchName));
    },
  });
}

async function pickBranch(): Promise<void> {
  await useGitStore.getState().loadBranches();
  const { branches } = useGitStore.getState();
  useCommandPaletteStore.getState().openPicker({
    placeholder: "Switch to branch...",
    emptyText: "No branches found.",
    items: branches.map((branch) => ({
      id: branch.name,
      label: branch.name,
      detail: branch.is_head ? "current" : undefined,
    })),
    onSelect: (item) => void switchToBranch(item.id),
  });
}

function promptNewBranch(): void {
  useCommandPaletteStore.getState().openPrompt({
    placeholder: "New branch name",
    submitLabel: (name) => (name ? `Create and switch to ${name}` : "Type a branch name"),
    onSubmit: (name) => void useGitStore.getState().createBranch(name, true),
  });
}

function promptStash(): void {
  useCommandPaletteStore.getState().openPrompt({
    placeholder: "Stash message (optional)",
    allowEmpty: true,
    submitLabel: (message) => (message ? `Stash changes as "${message}"` : "Stash changes"),
    onSubmit: (message) => void useGitStore.getState().stashPush(message || undefined),
  });
}

function buildGitCommands(): CommandPaletteItem[] {
  return [
    {
      id: "git.commit",
      label: "Git: Commit Staged Changes...",
      category: "Git",
      keywords: ["commit", "git"],
      action: () => void commitStaged(),
    },
    {
      id: "git.push",
      label: "Git: Push",
      category: "Git",
      keywords: ["push", "upload", "git"],
      action: () => void useGitStore.getState().push(),
    },
    {
      id: "git.pull",
      label: "Git: Pull",
      category: "Git",
      keywords: ["pull", "merge", "git"],
      action: () => void useGitStore.getState().pull(),
    },
    {
      id: "git.pullRebase",
      label: "Git: Pull (Rebase)",
      category: "Git",
      keywords: ["pull", "rebase", "git"],
      action: () => void useGitStore.getState().pull(undefined, undefined, true),
    },
    {
      id: "git.fetch",
      label: "Git: Fetch",
      category: "Git",
      keywords: ["fetch", "git"],
      action: () => void useGitStore.getState().fetch(),
    },
    {
      id: "git.switchBranch",
      label: "Git: Switch Branch...",
      category: "Git",
      keywords: ["checkout", "branch", "switch", "git"],
      action: () => void pickBranch(),
    },
    {
      id: "git.createBranch",
      label: "Git: Create Branch...",
      category: "Git",
      keywords: ["new", "branch", "create", "git"],
      action: promptNewBranch,
    },
    {
      id: "git.stash",
      label: "Git: Stash Changes...",
      category: "Git",
      keywords: ["stash", "shelve", "git"],
      action: promptStash,
    },
  ];
}

export function useGitPaletteCommands(): void {
  const hasRepo = useGitStore((state) => state.repoPath !== null);
  const commands = useMemo(() => (hasRepo ? buildGitCommands() : []), [hasRepo]);
  useRegisterPaletteCommands(commands);
}
