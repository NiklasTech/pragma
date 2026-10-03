use std::path::PathBuf;
use std::process::Command;

/// A throwaway repository in `<tempdir>/repo`, so tests can also place files outside it.
pub struct TestRepo {
    dir: tempfile::TempDir,
    pub root: String,
}

impl TestRepo {
    /// Creates a repository on `main` with one commit that adds `file.txt`.
    pub fn new() -> Self {
        let dir = tempfile::tempdir().expect("tempdir");
        let root_path = dir.path().join("repo");
        std::fs::create_dir(&root_path).expect("create repo dir");
        let repo = Self {
            root: root_path.to_string_lossy().into_owned(),
            dir,
        };
        repo.git(&["init", "-q"]);
        repo.git(&["symbolic-ref", "HEAD", "refs/heads/main"]);
        repo.git(&["config", "user.email", "test@example.com"]);
        repo.git(&["config", "user.name", "Pragma Test"]);
        repo.git(&["config", "commit.gpgsign", "false"]);
        repo.git(&["config", "core.autocrlf", "false"]);
        repo.git(&["config", "core.hooksPath", ""]);
        repo.write("file.txt", "base\n");
        repo.commit_all("init");
        repo
    }

    pub fn outside_path(&self, name: &str) -> PathBuf {
        self.dir.path().join(name)
    }

    pub fn path(&self, rel: &str) -> PathBuf {
        PathBuf::from(&self.root).join(rel)
    }

    pub fn write(&self, rel: &str, content: &str) {
        let path = self.path(rel);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("create parent dir");
        }
        std::fs::write(path, content).expect("write file");
    }

    pub fn read(&self, rel: &str) -> String {
        std::fs::read_to_string(self.path(rel)).expect("read file")
    }

    pub fn git(&self, args: &[&str]) -> String {
        let output = Command::new("git")
            .args(args)
            .current_dir(&self.root)
            .output()
            .expect("spawn git");
        assert!(
            output.status.success(),
            "git {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    pub fn commit_all(&self, message: &str) {
        self.git(&["add", "-A"]);
        self.git(&["commit", "-q", "-m", message]);
    }

    /// Leaves `file.txt` conflicted: `main` and `feature` both change it, then `feature` is merged.
    pub fn create_merge_conflict(&self) {
        self.git(&["checkout", "-q", "-b", "feature"]);
        self.write("file.txt", "incoming\n");
        self.commit_all("feature change");
        self.git(&["checkout", "-q", "main"]);
        self.write("file.txt", "current\n");
        self.commit_all("main change");
        let output = Command::new("git")
            .args(["merge", "feature"])
            .current_dir(&self.root)
            .output()
            .expect("spawn git");
        assert!(!output.status.success(), "merge was expected to conflict");
    }
}
