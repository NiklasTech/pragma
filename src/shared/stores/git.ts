import { create } from "zustand";
import type { GitActions, GitState } from "./git/types";
import { createBlameSlice } from "./git/blame";
import { createBranchesSlice } from "./git/branches";
import { createCommitsSlice } from "./git/commits";
import { createConflictsSlice } from "./git/conflicts";
import { createDiffSlice } from "./git/diff";
import { createGraphSlice } from "./git/graph";
import { createIntegrationSlice } from "./git/integration";
import { createLastCommitSlice } from "./git/lastCommit";
import { createRemotesSlice } from "./git/remotes";
import { createReposSlice } from "./git/repo";
import { createStagingSlice } from "./git/staging";
import { createStashSlice } from "./git/stash";
import { createTagsSlice } from "./git/tags";

export type {
  CheckState,
  GitBlameLine,
  GitBranch,
  GitCommit,
  GitCommitDetails,
  GitCommitFileChange,
  GitConflictSides,
  GitDiffContentResult,
  GitGraphBranch,
  GitGraphData,
  GitGraphEdge,
  GitGraphNode,
  GitLastCommit,
  GitLineAction,
  GitLineSelection,
  GitMergeResult,
  GitOperationKind,
  GitProgress,
  GitRemote,
  GitRemoteBranch,
  GitRepoInfo,
  GitStatusEntry,
  GitStatusSnapshot,
  GitTag,
  StashEntry,
} from "./git/types";

const initialState: GitState = {
  repoPath: null,
  snapshot: null,
  branches: [],
  commits: [],
  graph: null,
  diffContent: null,
  diffPath: null,
  diffStaged: false,
  diffViewMode: "split",
  isLoading: false,
  error: null,
  commitMessage: "",
  commitAmend: false,
  actionBusy: null,
  actionStatus: null,
  actionProgress: null,
  remotes: [],
  remoteBranches: [],
  pushPullError: null,
  stashes: [],
  stashBusy: false,
  conflictPath: null,
  conflictSides: null,
  conflictLoading: false,
  blameEnabled: false,
  blamePath: null,
  blameLines: [],
  blameLoading: false,
  blameSelectedSha: null,
  tags: [],
  operation: null,
};

export const useGitStore = create<GitState & GitActions>()((...a) => ({
  ...initialState,
  ...createConflictsSlice(...a),
  ...createReposSlice(...a),
  ...createStagingSlice(...a),
  ...createBranchesSlice(...a),
  ...createCommitsSlice(...a),
  ...createLastCommitSlice(...a),
  ...createGraphSlice(...a),
  ...createDiffSlice(...a),
  ...createRemotesSlice(...a),
  ...createStashSlice(...a),
  ...createBlameSlice(...a),
  ...createIntegrationSlice(...a),
  ...createTagsSlice(...a),
}));
