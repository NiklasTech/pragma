use std::path::{Component, Path, PathBuf};

use crate::modules::git::process::run_git;
use crate::modules::git::types::DEFAULT_TIMEOUT_SECS;

/// Files directly in the git dir whose change alters HEAD, the index or a running operation.
const GIT_DIR_STATE_FILES: &[&str] = &[
    "HEAD",
    "ORIG_HEAD",
    "FETCH_HEAD",
    "index",
    "MERGE_HEAD",
    "REBASE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "rebase-merge",
    "rebase-apply",
];

/// Entries of the common dir that hold refs or upstream config, shared by all worktrees.
const COMMON_DIR_STATE_FILES: &[&str] = &["refs", "packed-refs", "config"];

/// The git dir of a workspace and its common dir, which differ in linked worktrees.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitStateDirs {
    git_dir: PathBuf,
    common_dir: PathBuf,
}

impl GitStateDirs {
    /// Resolves the git dirs of `root` with `git rev-parse`, since `.git` is a file in worktrees.
    pub fn resolve(root: &Path) -> Option<Self> {
        let output = run_git(
            Some(&root.to_string_lossy()),
            ["rev-parse", "--git-dir", "--git-common-dir"],
            DEFAULT_TIMEOUT_SECS,
        )
        .ok()?;
        if output.timed_out || output.exit_code != Some(0) {
            return None;
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut lines = stdout
            .lines()
            .map(|line| line.trim_end_matches('\r'))
            .filter(|line| !line.is_empty());
        let git_dir = std::fs::canonicalize(root.join(lines.next()?)).ok()?;
        let common_dir = lines
            .next()
            .and_then(|line| std::fs::canonicalize(root.join(line)).ok())
            .unwrap_or_else(|| git_dir.clone());
        Some(Self {
            git_dir,
            common_dir,
        })
    }

    pub fn is_state_path(&self, path: &Path) -> bool {
        first_name_in(&self.git_dir, path, GIT_DIR_STATE_FILES)
            || first_name_in(&self.common_dir, path, COMMON_DIR_STATE_FILES)
    }

    /// Paths a recursive watch on `watched_root` misses, with whether to watch them recursively.
    pub fn extra_watches(&self, watched_root: &Path) -> Vec<(PathBuf, bool)> {
        let mut watches = Vec::new();
        if !self.git_dir.starts_with(watched_root) {
            watches.push((self.git_dir.clone(), false));
        }
        if !self.common_dir.starts_with(watched_root) {
            if self.common_dir != self.git_dir {
                watches.push((self.common_dir.clone(), false));
            }
            let refs = self.common_dir.join("refs");
            if refs.is_dir() {
                watches.push((refs, true));
            }
        }
        watches
    }
}

fn first_name_in(dir: &Path, path: &Path, names: &[&str]) -> bool {
    let Ok(relative) = path.strip_prefix(dir) else {
        return false;
    };
    matches!(
        relative.components().next(),
        Some(Component::Normal(name)) if names.iter().any(|candidate| name == *candidate)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn dirs(git_dir: &Path, common_dir: &Path) -> GitStateDirs {
        GitStateDirs {
            git_dir: git_dir.to_path_buf(),
            common_dir: common_dir.to_path_buf(),
        }
    }

    #[test]
    fn detects_head_index_and_ref_changes() {
        let git = Path::new("/repo/.git");
        let state = dirs(git, git);

        assert!(state.is_state_path(&git.join("HEAD")));
        assert!(state.is_state_path(&git.join("index")));
        assert!(state.is_state_path(&git.join("packed-refs")));
        assert!(state.is_state_path(&git.join("refs/heads/feat/test")));
        assert!(state.is_state_path(&git.join("refs/remotes/origin/main")));
        assert!(state.is_state_path(&git.join("rebase-merge/done")));
    }

    #[test]
    fn ignores_objects_logs_and_lock_files() {
        let git = Path::new("/repo/.git");
        let state = dirs(git, git);

        assert!(!state.is_state_path(&git.join("objects/ab/cdef")));
        assert!(!state.is_state_path(&git.join("logs/HEAD")));
        assert!(!state.is_state_path(&git.join("index.lock")));
        assert!(!state.is_state_path(Path::new("/repo/src/HEAD")));
    }

    #[test]
    fn splits_worktree_and_common_dir_state() {
        let common = Path::new("/main/.git");
        let git = Path::new("/main/.git/worktrees/feature");
        let state = dirs(git, common);

        assert!(state.is_state_path(&git.join("HEAD")));
        assert!(state.is_state_path(&git.join("index")));
        assert!(state.is_state_path(&common.join("refs/heads/feature")));
        assert!(!state.is_state_path(&common.join("worktrees/other/HEAD")));
    }

    #[test]
    fn watches_only_git_dirs_outside_the_root() {
        let dir = tempfile::tempdir().unwrap();
        let common = dir.path().join("main").join(".git");
        fs::create_dir_all(common.join("refs")).unwrap();
        let git = common.join("worktrees").join("feature");
        let state = dirs(&git, &common);

        assert!(state.extra_watches(&dir.path().join("main")).is_empty());
        assert_eq!(
            state.extra_watches(&dir.path().join("feature")),
            vec![
                (git, false),
                (common.clone(), false),
                (common.join("refs"), true)
            ]
        );
    }

    #[test]
    fn resolves_the_git_dir_of_a_repository() {
        let dir = tempfile::tempdir().unwrap();
        let root = fs::canonicalize(dir.path()).unwrap();
        assert_eq!(GitStateDirs::resolve(&root), None);
        let Ok(output) = run_git(Some(&root.to_string_lossy()), ["init", "-q"], 10) else {
            return;
        };
        if output.exit_code != Some(0) {
            return;
        }

        let state = GitStateDirs::resolve(&root).unwrap();

        assert_eq!(state, dirs(&root.join(".git"), &root.join(".git")));
    }
}
