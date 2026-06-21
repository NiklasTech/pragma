use app_lib::modules::git::operations::log;
use criterion::{criterion_group, criterion_main, Criterion};
use std::path::PathBuf;
use std::process::Command;

fn run_git(args: &[&str], cwd: &std::path::Path) {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .expect("git binary is required for benchmarks");
    if !output.status.success() {
        panic!(
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

fn create_temp_repo_with_commits(count: usize) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("pragma_bench_git_log_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    run_git(&["init"], &dir);
    run_git(&["config", "user.email", "bench@pragma.dev"], &dir);
    run_git(&["config", "user.name", "Bench"], &dir);

    for i in 0..count {
        let file = dir.join(format!("file_{}.txt", i));
        std::fs::write(&file, format!("content {}", i)).unwrap();
        run_git(&["add", file.to_str().unwrap()], &dir);
        run_git(&["commit", "-m", &format!("Commit {}", i)], &dir);
    }

    dir
}

fn bench_git_log(c: &mut Criterion) {
    let commit_count = 200;
    let dir = create_temp_repo_with_commits(commit_count);

    c.bench_function("git_log 200 commits", |b| {
        b.iter(|| {
            let entries = log(&dir.to_string_lossy(), commit_count as u32, None).unwrap();
            assert_eq!(entries.len(), commit_count);
        })
    });

    let _ = std::fs::remove_dir_all(&dir);
}

criterion_group!(benches, bench_git_log);
criterion_main!(benches);
